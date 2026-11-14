package com.learningcenter.bridge;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * window.print() does nothing in an Android WebView. This plugin (JS name "PrintPage", used by src/native.ts) hands the WebView's current page
 * to the system print framework: the system print dialog opens with "Save as PDF", the share button and the printers. The page's own
 * @media print rules decide what is printed (practice sheet, story sheets, certificate). NOT compiled or run in the sandbox that wrote it
 * (no Android SDK): see packaging/README.md, "Test on a real device".
 */
@CapacitorPlugin(name = "PrintPage")
public class PrintPagePlugin extends Plugin {
    @PluginMethod
    public void print(final PluginCall call) {
        final String name = call.getString("name", "LearningCenter");
        getActivity().runOnUiThread(() -> {
            try {
                WebView web = getBridge().getWebView();
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(name);
                PrintAttributes attrs = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
                pm.print(name, adapter, attrs);
                call.resolve(new JSObject());
            } catch (Exception e) {
                call.reject("print failed: " + e.getMessage());
            }
        });
    }
}
