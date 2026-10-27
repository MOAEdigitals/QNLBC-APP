package com.qnlbc.churchapp;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import com.yausername.ffmpeg.FFmpeg;
import java.io.File;
import java.util.Collections;
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
}
