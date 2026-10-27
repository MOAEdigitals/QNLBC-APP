package com.qnlbc.churchapp;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SongDownloadsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
