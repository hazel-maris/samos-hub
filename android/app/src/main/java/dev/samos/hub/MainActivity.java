package dev.samos.hub;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {

    // Change this only if the GitHub Pages address changes.
    private static final String HOME_URL =
            "https://hazel-maris.github.io/samos-hub/";

    private WebView web;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);

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

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xffe4d4b8);

        web = new WebView(this);
        web.setBackgroundColor(0xffe4d4b8);

        root.addView(
                web,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );

        setContentView(root);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request
            ) {
                Uri uri = request.getUrl();

                String host = uri.getHost();

                if (host != null && (
                        host.equals("hazel-maris.github.io")
                                || host.equals("accounts.spotify.com")
                                || host.endsWith(".spotify.com")
                )) {
                    return false;
                }

                if ("https".equals(uri.getScheme())
                        || "http".equals(uri.getScheme())) {
                    try {
                        startActivity(
                                new Intent(Intent.ACTION_VIEW, uri)
                        );
                    } catch (ActivityNotFoundException error) {
                        Toast.makeText(
                                MainActivity.this,
                                "No app can open this link",
                                Toast.LENGTH_SHORT
                        ).show();
                    }

                    return true;
                }

                return false;
            }
        });

        fullscreen();

        if (state == null || web.restoreState(state) == null) {
            web.loadUrl(HOME_URL);
        }
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
    public void onConfigurationChanged(
            Configuration newConfig
    ) {
        super.onConfigurationChanged(newConfig);
        fullscreen();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        web.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (web != null) {
            web.onResume();
        }

        fullscreen();
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.onPause();
        }

        CookieManager.getInstance().flush();

        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
        }

        super.onDestroy();
    }
}
