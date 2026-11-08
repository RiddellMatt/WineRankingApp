package com.northline.decanti;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        disableWebViewZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
        disableWebViewZoom();
    }

    private void disableWebViewZoom() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) return;
        webView.getSettings().setSupportZoom(false);
        webView.getSettings().setBuiltInZoomControls(false);
        webView.getSettings().setDisplayZoomControls(false);
    }
}
