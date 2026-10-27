package com.qnlbc.churchapp;

import android.net.Uri;
import android.util.AtomicFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.ffmpeg.FFmpeg;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import kotlin.Unit;
import org.json.*;

/** Device-only song media. No storage permission, cookies, cloud upload or web converter. */
@CapacitorPlugin(name = "SongDownloads")
public class SongDownloadsPlugin extends Plugin {
    private static final long LIMIT = 250L * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ConcurrentHashMap<String, AtomicBoolean> jobs = new ConcurrentHashMap<>();
    private final Object catalogLock = new Object();
    private boolean extractorChecked = false;
    private File root() throws IOException {
        File dir = new File(getContext().getNoBackupFilesDir(), "song-downloads");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cannot create local downloads folder.");
        return dir;
    }
    private JSONObject readCatalog() throws Exception {
        AtomicFile file = new AtomicFile(new File(root(), "catalog.json"));
        try (FileInputStream in = file.openRead(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count; while ((count = in.read(buffer)) != -1) bytes.write(buffer, 0, count);
            return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        }
        catch (FileNotFoundException missing) { return new JSONObject(); }
    }
    private void writeCatalog(JSONObject value) throws Exception {
        AtomicFile file = new AtomicFile(new File(root(), "catalog.json"));
        FileOutputStream out = null;
        try { out = file.startWrite(); out.write(value.toString().getBytes(StandardCharsets.UTF_8)); file.finishWrite(out); }
        catch (Exception e) { if (out != null) file.failWrite(out); throw e; }
    }
    private String idFor(String source) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(source.getBytes(StandardCharsets.UTF_8));
        StringBuilder id = new StringBuilder(); for (byte b : bytes) id.append(String.format(Locale.US, "%02x", b & 255));
        return id.toString();
    }
    private File mediaFile(JSONObject record) throws Exception {
        String name = record.getString("fileName");
        if (!name.matches("[a-f0-9]{64}\\.(mp4|webm|m4a|mp3|ogg|wav|mov|aac)")) throw new IOException("Invalid local file.");
        return new File(root(), name);
    }
    private JSObject publicRecord(JSONObject record) throws Exception {
        JSObject result = JSObject.fromJSONObject(record);
        result.put("uri", Uri.fromFile(mediaFile(record)).toString());
        return result;
    }
    @PluginMethod public void list(PluginCall call) {
        try { synchronized (catalogLock) {
            JSONObject catalog = readCatalog(); JSArray items = new JSArray();
            for (Iterator<String> it = catalog.keys(); it.hasNext();) {
                JSONObject record = catalog.getJSONObject(it.next()); File file = mediaFile(record);
                if (file.isFile() && file.length() > 0) items.put(publicRecord(record));
            }
            JSObject result = new JSObject(); result.put("items", items); call.resolve(result);
        }} catch (Exception e) { call.reject("Could not read local downloads.", e); }
    }
    @PluginMethod public void remove(PluginCall call) {
        String id = call.getString("id", "");
        if (!id.matches("[a-f0-9]{64}")) { call.reject("Invalid download."); return; }
        try { synchronized (catalogLock) {
            JSONObject catalog = readCatalog(), record = catalog.optJSONObject(id);
            if (record != null) {
                if (jobs.containsKey(record.getString("sourceKey"))) throw new IOException("Wait for the current download.");
                File file = mediaFile(record);
                if (file.exists() && !file.delete()) throw new IOException("Could not remove local file.");
                catalog.remove(id); writeCatalog(catalog);
            }
            call.resolve();
        }} catch (Exception e) { call.reject(e.getMessage(), e); }
    }
    @PluginMethod public void cancel(PluginCall call) {
        String key = call.getString("sourceKey", ""); AtomicBoolean cancelled = jobs.get(key);
        if (cancelled != null) cancelled.set(true);
        try { YoutubeDL.getInstance().destroyProcessById(idFor(key)); } catch (Exception ignored) {}
        call.resolve();
    }
    private void progress(String key, float value, String stage) {
        JSObject event = new JSObject(); event.put("sourceKey", key); event.put("progress", Math.max(0, Math.min(99, (int)value))); event.put("stage", stage);
        notifyListeners("progress", event);
    }
    private URL safeURL(String raw) throws Exception {
        URL url = new URL(raw);
        if (!url.getProtocol().equals("https") || url.getUserInfo() != null) throw new IOException("Use a public HTTPS media link.");
        for (InetAddress address : InetAddress.getAllByName(url.getHost())) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() || address.isSiteLocalAddress() || address.isMulticastAddress()) throw new IOException("Use a public media link.");
        }
        return url;
    }
    private String youtubeId(URL url) throws Exception {
        String host = url.getHost().toLowerCase(Locale.ROOT), id = null;
        if (host.equals("youtu.be")) id = url.getPath().substring(1);
        else if (host.equals("youtube.com") || host.endsWith(".youtube.com") || host.equals("youtube-nocookie.com") || host.endsWith(".youtube-nocookie.com")) {
            Uri uri = Uri.parse(url.toString());
            if (url.getPath().equals("/watch")) id = uri.getQueryParameter("v");
            else if (url.getPath().matches("/(shorts|embed|live)/[^/]+/?")) id = uri.getPathSegments().get(1);
        }
        if (id != null && !id.matches("[A-Za-z0-9_-]{11}")) throw new IOException("Invalid YouTube video link.");
        return id;
    }
    private String extension(String mime, String url) throws Exception {
        String type = mime.toLowerCase(Locale.ROOT).split(";")[0].trim();
        switch(type) {
            case "audio/mpeg": return "mp3";
            case "audio/mp4": case "audio/x-m4a": return "m4a";
            case "audio/aac": return "aac";
            case "audio/ogg": case "application/ogg": return "ogg";
            case "audio/wav": case "audio/x-wav": return "wav";
            case "audio/webm": case "video/webm": return "webm";
            case "video/mp4": return "mp4";
            case "video/quicktime": return "mov";
        }
        if (type.equals("application/octet-stream")) {
            String path = new URL(url).getPath().toLowerCase(Locale.ROOT);
            for (String ext : new String[]{"mp3","mp4","m4a","ogg","wav","webm","mov","aac"}) if (path.endsWith("."+ext)) return ext;
        }
        throw new IOException("This link is a webpage, not an audio/video file.");
    }
    private File direct(String source, File directory, AtomicBoolean cancelled, String kind) throws Exception {
        URL url = safeURL(source); HttpURLConnection connection = null;
        try {
            for (int redirects=0; redirects<=5; redirects++) {
                connection=(HttpURLConnection)url.openConnection(); connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(20000); connection.setReadTimeout(20000); connection.setRequestProperty("Accept", "audio/*,video/*,application/octet-stream");
                int code=connection.getResponseCode();
                if (code>=300 && code<400) { String next=connection.getHeaderField("Location"); connection.disconnect(); url=safeURL(new URL(url,next).toString()); continue; }
                if (code!=200) throw new IOException("Download failed (HTTP "+code+").");
                String ext=extension(connection.getContentType()==null?"":connection.getContentType(),url.toString());
                long length=connection.getContentLengthLong(); if(length>LIMIT)throw new IOException("File is larger than 250 MB.");
                File file=new File(directory,"media."+ext); long total=0,last=0;
                try(InputStream in=connection.getInputStream();FileOutputStream out=new FileOutputStream(file)) {
                    byte[] buffer=new byte[64*1024];int n;
                    while((n=in.read(buffer))!=-1){if(cancelled.get())throw new InterruptedException();total+=n;if(total>LIMIT)throw new IOException("File is larger than 250 MB.");out.write(buffer,0,n);
                        long now=System.currentTimeMillis();if(now-last>250){progress(source,length>0?100f*total/length:0,"Downloading");last=now;}}
                }
                if(total==0)throw new IOException("Downloaded file was empty.");return file;
            }
            throw new IOException("Too many download redirects.");
        } finally { if(connection!=null)connection.disconnect(); }
    }
    @PluginMethod public void download(PluginCall call) {
        final String source=call.getString("sourceUrl","");
        final AtomicBoolean cancelled=new AtomicBoolean(false);
        if(jobs.putIfAbsent(source,cancelled)!=null){call.reject("This file is already downloading.");return;}
        worker.execute(()->{
            File temporary=null;File completed=null;
            try {
                URL url=safeURL(source);String videoId=youtubeId(url),id=idFor(source);
                synchronized(catalogLock){JSONObject existing=readCatalog().optJSONObject(id);if(existing!=null&&mediaFile(existing).isFile()){call.resolve(publicRecord(existing));return;}}
                temporary=new File(root(),"pending-"+id);if(!temporary.isDirectory()&&!temporary.mkdirs())throw new IOException("Cannot prepare local download.");
                if(cancelled.get())throw new InterruptedException();
                File downloaded;
                if(videoId!=null){
                    progress(source,0,"Preparing video"); YoutubeDL.getInstance().init(getContext()); FFmpeg.getInstance().init(getContext());
                    // Maintain the bundled extractor from its official upstream. No converter subscription.
                    if (!extractorChecked) { try { YoutubeDL.getInstance().updateYoutubeDL(getContext(),YoutubeDL.UpdateChannel._STABLE); } catch(Exception ignored) {} extractorChecked = true; }
                    if(cancelled.get())throw new InterruptedException();
                    YoutubeDLRequest request=new YoutubeDLRequest("https://www.youtube.com/watch?v="+videoId);
                    request.addOption("--no-playlist");request.addOption("--ignore-config");request.addOption("--max-filesize","250M");request.addOption("--socket-timeout","20");request.addOption("--retries","2");
                    request.addOption("-f","bestvideo[vcodec^=avc1][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best");
                    request.addOption("--merge-output-format","mp4"); request.addOption("-o",new File(temporary,"media.%(ext)s").getAbsolutePath());
                    YoutubeDL.getInstance().execute(request,id,(value,eta,line)->{progress(source,value,"Downloading video");return Unit.INSTANCE;});
                    if(cancelled.get())throw new InterruptedException();
                    File[] candidates=temporary.listFiles((dir,name)->name.matches("media\\.(mp4|webm|m4a|mp3|ogg|wav|mov|aac)"));
                    if(candidates==null||candidates.length!=1)throw new IOException("Video could not be downloaded. Try again later.");downloaded=candidates[0];
                }else downloaded=direct(call.getString("downloadUrl",source),temporary,cancelled,call.getString("type","video"));
                if(cancelled.get())throw new InterruptedException();
                if(downloaded.length()==0||downloaded.length()>LIMIT)throw new IOException("Downloaded file is empty or larger than 250 MB.");
                String ext=downloaded.getName().substring(downloaded.getName().lastIndexOf('.')+1);
                completed=new File(root(),id+"."+ext);if(!downloaded.renameTo(completed))throw new IOException("Cannot save local download.");
                JSObject record=new JSObject();record.put("id",id);record.put("sourceKey",source);record.put("sourceUrl",source);record.put("title",call.getString("title","Song track"));record.put("songId",call.getString("songId",""));record.put("fileName",completed.getName());record.put("size",completed.length());
                java.text.SimpleDateFormat timestamp=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.US);timestamp.setTimeZone(TimeZone.getTimeZone("UTC"));record.put("downloadedAt",timestamp.format(new Date()));
                String type=videoId!=null||Arrays.asList("mp4","webm","mov").contains(ext)?"video":"audio";record.put("type",type);
                synchronized(catalogLock){JSONObject catalog=readCatalog();catalog.put(id,record);writeCatalog(catalog);}
                call.resolve(publicRecord(record));completed=null;
            }catch(Exception e){if(completed!=null)completed.delete();call.reject(cancelled.get()||e instanceof InterruptedException?"Download cancelled.":"Download failed. Check your connection and try again. Some videos may be unavailable.",e);}
            finally{if(temporary!=null){File[] files=temporary.listFiles();if(files!=null)for(File f:files)if(f.isFile())f.delete();temporary.delete();}jobs.remove(source,cancelled);}
        });
    }
}
