package com.qnlbc.churchapp;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.core.app.ActivityScenario;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import com.yausername.ffmpeg.FFmpeg;
import java.io.File;
import java.util.Collections;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Runs the bundled native/Python executable on Android, without downloading a third-party video. */
@RunWith(AndroidJUnit4.class)
public class SongDownloaderRuntimeTest {
    @Test public void bundledDownloaderAndFfmpegInitializeAndExecuteOnAndroid() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        YoutubeDL.getInstance().init(context);
        FFmpeg.getInstance().init(context);
        File nativeDir = new File(context.getApplicationInfo().nativeLibraryDir);
        assertTrue(new File(nativeDir, "libpython.so").isFile());
        assertTrue(new File(nativeDir, "libffmpeg.so").isFile());
        YoutubeDLRequest request = new YoutubeDLRequest(Collections.emptyList());
        request.addOption("--version");
        YoutubeDLResponse response = YoutubeDL.getInstance().execute(request, "runtime-smoke", null);
        assertEquals(0, response.getExitCode());
        assertTrue(response.getOut().trim().matches("[0-9]{4}\\.[0-9]{2}\\.[0-9]{2}.*"));
    }

    @Test public void registeredPluginListsPrivateFilesAndWebViewCanPlayThem() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File dir = new File(context.getNoBackupFilesDir(), "song-downloads"); assertTrue(dir.isDirectory() || dir.mkdirs());
        String id = String.join("", Collections.nCopies(64, "a")); File audio = new File(dir, id + ".wav");
        ByteBuffer wave = ByteBuffer.allocate(8044).order(ByteOrder.LITTLE_ENDIAN);
        wave.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(8036).put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short)1).putShort((short)1).putInt(8000).putInt(8000).putShort((short)1).putShort((short)8).put("data".getBytes(StandardCharsets.US_ASCII)).putInt(8000);
        while (wave.hasRemaining()) wave.put((byte)128);
        try (FileOutputStream out = new FileOutputStream(audio)) { out.write(wave.array()); }
        JSONObject record = new JSONObject().put("id", id).put("sourceKey", "https://example.test/smoke.wav").put("sourceUrl", "https://example.test/smoke.wav").put("title", "Runtime audio test").put("songId", "test").put("fileName", audio.getName()).put("size", audio.length()).put("downloadedAt", "2026-10-27T00:00:00Z").put("type", "audio");
        File catalog = new File(dir, "catalog.json");
        try (FileOutputStream out = new FileOutputStream(catalog)) { out.write(new JSONObject().put(id, record).toString().getBytes(StandardCharsets.UTF_8)); }
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            String script = "window.__localPlaybackTest='waiting';(async()=>{try{const result=await window.Capacitor.Plugins.SongDownloads.list();const item=result.items.find(x=>x.id==='"+id+"');if(!item)throw Error('Native file not listed');const audio=document.createElement('audio');audio.preload='auto';audio.oncanplay=()=>window.__localPlaybackTest='ready';audio.onerror=()=>window.__localPlaybackTest='media-error';audio.src=window.Capacitor.convertFileSrc(item.uri);document.body.appendChild(audio);audio.load();}catch(e){window.__localPlaybackTest='error:'+e.message;}})();";
            // Wait for the bundled page and Capacitor bridge, without external network access.
            long deadline=System.currentTimeMillis()+30000;
            boolean bridgeReady=false;
            while(System.currentTimeMillis()<deadline){
                AtomicReference<String> reply=new AtomicReference<>();CountDownLatch latch=new CountDownLatch(1);
                scenario.onActivity(activity->activity.getBridge().getWebView().evaluateJavascript("Boolean(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.SongDownloads)",value->{reply.set(value);latch.countDown();}));
                assertTrue(latch.await(5,TimeUnit.SECONDS));if("true".equals(reply.get())){bridgeReady=true;break;}Thread.sleep(200);
            }
            assertTrue("Native download plugin was not registered",bridgeReady);
            scenario.onActivity(activity->activity.getBridge().getWebView().evaluateJavascript(script,null));
            String result="waiting";deadline=System.currentTimeMillis()+20000;
            while(System.currentTimeMillis()<deadline){
                AtomicReference<String> reply=new AtomicReference<>();CountDownLatch latch=new CountDownLatch(1);
                scenario.onActivity(activity->activity.getBridge().getWebView().evaluateJavascript("window.__localPlaybackTest",value->{reply.set(value);latch.countDown();}));
                assertTrue(latch.await(5,TimeUnit.SECONDS));result=reply.get();if(!"\"waiting\"".equals(result))break;Thread.sleep(200);
            }
            assertEquals("Private local audio could not be opened by the real Android player", "\"ready\"", result);
        } finally { audio.delete(); catalog.delete(); }
    }
}
