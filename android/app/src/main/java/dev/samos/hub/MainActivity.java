package dev.samos.hub;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {

    private WebView webView;

    private static final String HOME_URL =
            "https://appassets.androidplatform.net/assets/web/index.html";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        );

        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams attributes =
                    getWindow().getAttributes();

            attributes.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams
                            .LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;

            if (Build.VERSION.SDK_INT >= 30) {
                attributes.layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams
                                .LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
            }

            getWindow().setAttributes(attributes);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(0xffe4d4b8);
        setContentView(webView);

        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebChromeClient(
                new WebChromeClient()
        );

        WebViewAssetLoader assetLoader =
                new WebViewAssetLoader.Builder()
                        .addPathHandler(
                                "/assets/",
                                new WebViewAssetLoader.AssetsPathHandler(this)
                        )
                        .build();

        webView.setWebViewClient(
                new WebViewClient() {

                    @Override
                    public WebResourceResponse shouldInterceptRequest(
                            WebView view,
                            WebResourceRequest request
                    ) {
                        return assetLoader.shouldInterceptRequest(
                                request.getUrl()
                        );
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(
                            WebView view,
                            WebResourceRequest request
                    ) {
                        String url = request.getUrl().toString();

                        if (url.startsWith("https://hazel-maris.github.io/samos-hub/")) {
                            String query = request.getUrl().getEncodedQuery();

                            String localUrl =
                                    "https://appassets.androidplatform.net/assets/web/index.html";

                            if (query != null && !query.isEmpty()) {
                                localUrl += "?" + query;
                            }

                            view.loadUrl(localUrl);
                            return true;
                        }

                        return false;
                    }
                }
        );

        fullscreen();

        webView.loadUrl(HOME_URL);
    }

    private void fullscreen() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);

            WindowInsetsController controller =
                    getWindow().getInsetsController();

            if (controller != null) {
                controller.hide(
                        WindowInsets.Type.statusBars()
                                | WindowInsets.Type.navigationBars()
                );

                controller.setSystemBarsBehavior(
                        WindowInsetsController
                                .BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );

                if (Build.VERSION.SDK_INT >= 35) {
                    controller.setSystemBarsAppearance(
                            WindowInsetsController
                                    .APPEARANCE_TRANSPARENT_CAPTION_BAR_BACKGROUND,
                            WindowInsetsController
                                    .APPEARANCE_TRANSPARENT_CAPTION_BAR_BACKGROUND
                    );
                }
            }
        } else {
            getWindow()
                    .getDecorView()
                    .setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    );
        }
    }

    @Override
    public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);

        if (focused) {
            fullscreen();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (webView != null) {
            webView.onResume();
        }

        fullscreen();
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }

        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (
                webView != null &&
                        webView.canGoBack()
        ) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}