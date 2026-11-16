package com.qnlbc.churchapp;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        super.load();
        // Match the web app's CSS text sizes at Chrome's 100% Page Zoom.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
