package com.example.learningcenter;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.learningcenter.bridge.PrintPagePlugin;

// NOTE: when you change the application id (packaging/README.md, section 0) also move this folder and the `package` line;
// the plugin lives in the fixed package com.learningcenter.bridge on purpose, so it does not move.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPagePlugin.class);   // window.print() replacement (src/native.ts)
        super.onCreate(savedInstanceState);
    }
}
