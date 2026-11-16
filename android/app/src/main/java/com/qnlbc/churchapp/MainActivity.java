package com.qnlbc.churchapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Match the web app's CSS text sizes at Chrome's 100% Page Zoom.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
