// ============================================================
// SamOS Hub — Spotify
// ============================================================


const SPOTIFY_CLIENT_ID =
  CONFIG.spotifyClientId || "";


const IS_ANDROID_APP =
  window.location.hostname ===
    "appassets.androidplatform.net";


const SPOTIFY_REDIRECT_URI =
  IS_ANDROID_APP
    ? "samoshub://spotify-callback"
    : "https://hazel-maris.github.io/samos-hub/";


const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private"
];


let selectedPlaylistUri = null;

let spotifyPlaybackPoll = null;

let spotifyIsPlaying = false;


// ============================================================
// SPOTIFY — PKCE HELPERS
// ============================================================

function randomString(
  length = 64
) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";


  const values =
    crypto.getRandomValues(
      new Uint8Array(length)
    );


  return Array
    .from(
      values,

      value =>
        chars[
          value %
          chars.length
        ]
    )

    .join("");
}


async function sha256(
  value
) {
  return crypto.subtle.digest(
    "SHA-256",

    new TextEncoder()
      .encode(value)
  );
}


function base64Url(
  buffer
) {
  return btoa(
    String.fromCharCode(
      ...new Uint8Array(buffer)
    )
  )

    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


// ============================================================
// SPOTIFY STATUS
// ============================================================

function setSpotifyStatus(
  message
) {
  document.getElementById(
    "spotify-status"
  ).textContent =
    message;
}


// ============================================================
// SPOTIFY LOGIN
// ============================================================

async function loginToSpotify() {
  if (!SPOTIFY_CLIENT_ID) {
    setSpotifyStatus(
      "Spotify client ID is missing"
    );


    return;
  }


  const verifier =
    randomString(64);


  const challenge =
    base64Url(
      await sha256(
        verifier
      )
    );


  const state =
    randomString(24);


  localStorage.setItem(
    "spotify_verifier",
    verifier
  );


  localStorage.setItem(
    "spotify_state",
    state
  );


  const params =
    new URLSearchParams({
      response_type:
        "code",

      client_id:
        SPOTIFY_CLIENT_ID,

      scope:
        SPOTIFY_SCOPES.join(" "),

      redirect_uri:
        SPOTIFY_REDIRECT_URI,

      state,

      code_challenge_method:
        "S256",

      code_challenge:
        challenge
    });


  localStorage.setItem(
    "spotify_login_pending",
    "true"
  );


  setSpotifyStatus(
    "Waiting for Spotify sign-in..."
  );


  window.location.href =
    `https://accounts.spotify.com/authorize?${params}`;
}


// ============================================================
// SPOTIFY TOKEN STORAGE
// ============================================================

function saveSpotifyToken(
  token
) {
  localStorage.setItem(
    "spotify_access_token",
    token.access_token || ""
  );


  if (token.refresh_token) {
    localStorage.setItem(
      "spotify_refresh_token",
      token.refresh_token
    );
  }


  const expiresIn =
    Number(
      token.expires_in || 3600
    );


  localStorage.setItem(
    "spotify_expires_at",

    String(
      Date.now() +
      (expiresIn - 60) * 1000
    )
  );
}


async function refreshSpotifyToken() {
  const refreshToken =
    localStorage.getItem(
      "spotify_refresh_token"
    );


  if (!refreshToken) {
    return null;
  }


  const body =
    new URLSearchParams({
      client_id:
        SPOTIFY_CLIENT_ID,

      grant_type:
        "refresh_token",

      refresh_token:
        refreshToken
    });


  const response =
    await fetch(
      "https://accounts.spotify.com/api/token",

      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body
      }
    );


  if (!response.ok) {
    console.error(
      "Spotify refresh failed:",
      response.status
    );


    return null;
  }


  const token =
    await response.json();


  saveSpotifyToken(
    token
  );


  return token.access_token;
}


async function getValidSpotifyToken() {
  const token =
    localStorage.getItem(
      "spotify_access_token"
    );


  const expiresAt =
    Number(
      localStorage.getItem(
        "spotify_expires_at"
      ) || 0
    );


  if (
    token &&
    Date.now() <
      expiresAt
  ) {
    return token;
  }


  return refreshSpotifyToken();
}


// ============================================================
// SPOTIFY OAUTH RETURN
// ============================================================

async function handleSpotifyRedirect() {
  const params =
    new URLSearchParams(
      window.location.search
    );


  const oauthError =
    params.get("error");


  if (oauthError) {
    console.error(
      "Spotify OAuth error:",
      oauthError
    );


    setSpotifyStatus(
      `Spotify login failed: ${oauthError}`
    );


    history.replaceState(
      {},

      document.title,

      window.location.pathname
    );


    return;
  }


  const code =
    params.get("code");


  if (!code) {
    if (
      localStorage.getItem(
        "spotify_access_token"
      )
    ) {
      startSpotify();
    }


    return;
  }


  const returnedState =
    params.get("state");


  const expectedState =
    localStorage.getItem(
      "spotify_state"
    );


  const verifier =
    localStorage.getItem(
      "spotify_verifier"
    );


  if (
    !verifier ||
    !returnedState ||
    returnedState !==
      expectedState
  ) {
    setSpotifyStatus(
      "Spotify login could not be verified"
    );


    console.error(
      "Spotify OAuth state verification failed"
    );


    return;
  }


  const body =
    new URLSearchParams({
      client_id:
        SPOTIFY_CLIENT_ID,

      grant_type:
        "authorization_code",

      code,

      redirect_uri:
        SPOTIFY_REDIRECT_URI,

      code_verifier:
        verifier
    });


  let response;


  try {
    response =
      await fetch(
        "https://accounts.spotify.com/api/token",

        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body
        }
      );
  }


  catch (error) {
    console.error(
      "Spotify token request failed:",
      error
    );


    setSpotifyStatus(
      "Spotify token request failed"
    );


    return;
  }


  if (!response.ok) {
    const text =
      await response.text();


    console.error(
      "Spotify token exchange failed:",
      response.status,
      text
    );


    setSpotifyStatus(
      `Spotify login failed (${response.status})`
    );


    return;
  }


  const token =
    await response.json();


  saveSpotifyToken(
    token
  );


  localStorage.removeItem(
    "spotify_login_pending"
  );


  localStorage.removeItem(
    "spotify_state"
  );


  localStorage.removeItem(
    "spotify_verifier"
  );


  history.replaceState(
    {},

    document.title,

    window.location.pathname
  );


  startSpotify();
}


// ============================================================
// SPOTIFY PLAYBACK STATE
// ============================================================

async function updateSpotifyPlaybackState() {
  const token =
    await getValidSpotifyToken();


  if (!token) {
    return;
  }


  try {
    const response =
      await fetch(
        "https://api.spotify.com/v1/me/player",

        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );


    if (response.status === 204) {
      spotifyIsPlaying = false;


      document.getElementById(
        "play-pause-icon"
      ).src =
        "./icons/player-play.png";


      setSpotifyStatus(
        "Paused"
      );


      return;
    }


    if (!response.ok) {
      console.error(
        "Spotify playback state failed:",
        response.status
      );


      return;
    }


    const state =
      await response.json();


    spotifyIsPlaying =
      Boolean(
        state.is_playing
      );


    const track =
      state.item;


    if (!track) {
      return;
    }


    document.getElementById(
      "track-name"
    ).textContent =
      track.name ||
      "Nothing playing";


    document.getElementById(
      "track-artist"
    ).textContent =
      (track.artists || [])
        .map(
          artist =>
            artist.name
        )
        .join(", ");


    const art =
      track.album
        ?.images?.[0]
        ?.url || "";


    const artEl =
      document.getElementById(
        "album-art"
      );


    const placeholderEl =
      document.getElementById(
        "album-placeholder"
      );


    if (art) {
      artEl.src =
        art;

      artEl.hidden =
        false;

      placeholderEl.hidden =
        true;
    }

    else {
      artEl.removeAttribute(
        "src"
      );

      artEl.hidden =
        true;

      placeholderEl.hidden =
        false;
    }


    document.getElementById(
      "play-pause-icon"
    ).src =
      state.is_playing
        ? "./icons/player-pause.png"
        : "./icons/player-play.png";


    if (state.device?.name) {
      setSpotifyStatus(
        `Playing on ${state.device.name}`
      );
    }
  }


  catch (error) {
    console.error(
      "Spotify playback state error:",
      error
    );
  }
}


function refreshSpotifyAfterControl() {
  setTimeout(
    updateSpotifyPlaybackState,
    150
  );


  setTimeout(
    updateSpotifyPlaybackState,
    500
  );


  setTimeout(
    updateSpotifyPlaybackState,
    1000
  );
}


// ============================================================
// START SPOTIFY
// ============================================================

async function startSpotify() {
  const token =
    await getValidSpotifyToken();


  if (!token) {
    setSpotifyStatus(
      "Connect Spotify to load your playlists"
    );


    document.getElementById(
      "spotify-login"
    ).hidden =
      false;


    return;
  }


  document.getElementById(
    "spotify-login"
  ).hidden =
    true;


  setSpotifyStatus(
    "Spotify connected"
  );


  await loadPlaylists();


  await updateSpotifyPlaybackState();


  clearInterval(
    spotifyPlaybackPoll
  );


  spotifyPlaybackPoll =
    setInterval(
      updateSpotifyPlaybackState,
      3000
    );
}


// ============================================================
// PLAYLISTS
// ============================================================

async function loadPlaylists() {
  const token =
    await getValidSpotifyToken();


  if (!token) {
    return;
  }


  const menu =
    document.getElementById(
      "playlist-menu"
    );


  menu.innerHTML =
    "";


  let url =
    "https://api.spotify.com/v1/me/playlists?limit=50";


  while (url) {
    const response =
      await fetch(
        url,

        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );


    if (!response.ok) {
      console.error(
        "Spotify playlist load failed:",
        response.status
      );


      setSpotifyStatus(
        `Could not load playlists (${response.status})`
      );


      return;
    }


    const data =
      await response.json();


    for (
      const playlist
      of data.items || []
    ) {
      if (!playlist) {
        continue;
      }


      const item =
        document.createElement(
          "button"
        );


      item.type =
        "button";


      item.className =
        "playlist-item";


      item.textContent =
        playlist.name;


      item.addEventListener(
        "click",

        async () => {
          selectedPlaylistUri =
            playlist.uri;


          document.getElementById(
            "playlist-button"
          ).textContent =
            playlist.name;


          menu.hidden =
            true;


          await startPlaylist(
            playlist.uri
          );
        }
      );


      menu.appendChild(
        item
      );
    }


    url =
      data.next;
  }
}


// ============================================================
// START PLAYLIST
// ============================================================

async function startPlaylist(
  playlistUri
) {
  const token =
    await getValidSpotifyToken();


  if (!token) {
    setSpotifyStatus(
      "Reconnect Spotify"
    );


    return;
  }


  // Turn shuffle on for the currently active Spotify device.

  await fetch(
    "https://api.spotify.com/v1/me/player/shuffle?state=true",

    {
      method: "PUT",

      headers: {
        Authorization:
          `Bearer ${token}`
      }
    }
  );


  const response =
    await fetch(
      "https://api.spotify.com/v1/me/player/play",

      {
        method: "PUT",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            context_uri:
              playlistUri
          })
      }
    );


  if (!response.ok) {
    console.error(
      "Could not start Spotify playlist:",
      response.status
    );


    if (
      response.status === 404
    ) {
      setSpotifyStatus(
        "Open Spotify on a device first"
      );
    }

    else {
      setSpotifyStatus(
        `Could not start playlist (${response.status})`
      );
    }


    return;
  }


  setSpotifyStatus(
    "Shuffle on"
  );


  setTimeout(
    updateSpotifyPlaybackState,
    500
  );
}


// ============================================================
// SPOTIFY CONTROLS
// ============================================================

document
  .getElementById(
    "spotify-login"
  )

  .addEventListener(
    "click",
    loginToSpotify
  );


document
  .getElementById(
    "playlist-button"
  )

  .addEventListener(
    "click",

    () => {
      const menu =
        document.getElementById(
          "playlist-menu"
        );


      menu.hidden =
        !menu.hidden;
    }
  );


document.addEventListener(
  "click",

  event => {
    const picker =
      document.querySelector(
        ".playlist-picker"
      );


    const menu =
      document.getElementById(
        "playlist-menu"
      );


    if (
      picker &&
      !picker.contains(
        event.target
      )
    ) {
      menu.hidden =
        true;
    }
  }
);


document
  .getElementById(
    "play-pause"
  )

  .addEventListener(
    "click",

    async () => {
      const token =
        await getValidSpotifyToken();


      if (!token) {
        return;
      }


      const wasPlaying =
        spotifyIsPlaying;


      spotifyIsPlaying =
        !spotifyIsPlaying;


      document.getElementById(
        "play-pause-icon"
      ).src =
        spotifyIsPlaying
          ? "./icons/player-pause.png"
          : "./icons/player-play.png";


      const endpoint =
        spotifyIsPlaying
          ? "play"
          : "pause";


      const response =
        await fetch(
          `https://api.spotify.com/v1/me/player/${endpoint}`,

          {
            method: "PUT",

            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );


      if (!response.ok) {
        spotifyIsPlaying =
          wasPlaying;


        document.getElementById(
          "play-pause-icon"
        ).src =
          spotifyIsPlaying
            ? "./icons/player-pause.png"
            : "./icons/player-play.png";


        console.error(
          "Spotify play/pause failed:",
          response.status
        );


        await updateSpotifyPlaybackState();


        return;
      }


      refreshSpotifyAfterControl();
    }
  );


document
  .getElementById(
    "next-track"
  )

  .addEventListener(
    "click",

    async () => {
      const token =
        await getValidSpotifyToken();


      if (!token) {
        return;
      }


      await fetch(
        "https://api.spotify.com/v1/me/player/next",

        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );


      refreshSpotifyAfterControl();
    }
  );


document
  .getElementById(
    "previous-track"
  )

  .addEventListener(
    "click",

    async () => {
      const token =
        await getValidSpotifyToken();


      if (!token) {
        return;
      }


      await fetch(
        "https://api.spotify.com/v1/me/player/previous",

        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );


      refreshSpotifyAfterControl();
    }
  );


// ============================================================
// START SPOTIFY
// ============================================================

handleSpotifyRedirect();