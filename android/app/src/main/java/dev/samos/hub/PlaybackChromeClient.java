package dev.samos.hub;

import android.net.Uri;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

// Reconstructed from the working 1.3.0 APK's permission handler.
public class PlaybackChromeClient extends WebChromeClient {

    @Override
    public void onPermissionRequest(PermissionRequest request) {
        Uri origin = request.getOrigin();

        if (!"https".equals(origin.getScheme())) {
            request.deny();
            return;
        }

        String host = origin.getHost();

        if (host == null || !(
                "appassets.androidplatform.net".equals(host)
                        || "sdk.scdn.co".equals(host)
                        || "spotify.com".equals(host)
                        || host.endsWith(".spotify.com")
        )) {
            request.deny();
            return;
        }

        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID.equals(resource)) {
                request.grant(new String[] {
                        PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID
                });
                return;
            }
        }

        request.deny();
    }
}
