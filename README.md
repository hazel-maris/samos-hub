# SamOS Hub — external-display-first reset

This is the clean reset version of SamOS Hub.

## What this version is for

- The living-room / external display is the primary interface.
- Spotify is controlled directly from SamOS Hub.
- Your Spotify playlists load inside the Hub; you do not need to open Spotify to choose one.
- The Android app is a thin fullscreen WebView shell so the Hub can run cleanly on an attached display.
- Phone/mobile layout is intentionally basic. It can be redesigned later without driving the main interface.

## Repo layout

```text
samos-hub-reset/
├── index.html
├── style.css
├── script.js
├── config.js
├── service-worker.js
├── manifest.webmanifest
└── android/
    └── ...Android Studio project...
```

## GitHub Pages

Put the web files at the root of your `samos-hub` GitHub repository and enable GitHub Pages from the main branch.

The Android app currently loads:

```text
https://hazel-maris.github.io/samos-hub/
```

If the Pages URL changes, update `HOME_URL` in:

```text
android/app/src/main/java/dev/samos/hub/MainActivity.java
```

## Spotify

The Hub uses Spotify Authorization Code with PKCE plus the Spotify Web Playback SDK.

The existing Spotify client ID recovered from the earlier SamOS Hub code is already in `config.js`.

In the Spotify developer dashboard, the exact GitHub Pages URL must be listed as a redirect URI, for example:

```text
https://hazel-maris.github.io/samos-hub/
```

Spotify playback through the Web Playback SDK requires a Spotify Premium account.

## Android app

Open the `android/` folder in Android Studio.

The Android shell:
- stays awake;
- removes status/navigation bars;
- uses transparent system-bar colors;
- allows display cutouts;
- re-applies fullscreen when focus/configuration changes;
- loads the live GitHub Pages version of SamOS Hub.

This keeps the web repo authoritative instead of maintaining a second bundled copy of the site inside the APK.
