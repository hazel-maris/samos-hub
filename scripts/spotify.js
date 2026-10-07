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
  "user-read-recently-played",
  "user-modify-playback-state",
  "playlist-read-private"
];

let selectedPlaylistUri = null;
let spotifyPlaybackPoll = null;
let spotifyIsPlaying = false;

let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyPlayerReady = null;
let spotifySdkLoad = null;

let hubControlBusy = false;

let spotifyShuffleEnabled =
  localStorage.getItem("samos_spotify_shuffle") !== "false";

let spotifyConnected = false;

function setSpotifyConnectionState(connected) {
  spotifyConnected = connected;

  const button = document.getElementById("spotify-login");

  button.hidden = false;
  button.textContent = connected ? "Connected" : "Connect";
  button.disabled = connected;

  button.setAttribute(
    "data-connected",
    String(connected)
  );
}


// ============================================================
// STATUS
// ============================================================

function setSpotifyStatus(message) {
  document.getElementById(
    "spotify-status"
  ).textContent = message;
}


function showSelectPlaylist() {
  const placeholder =
    document.getElementById("album-placeholder");

  document.getElementById(
    "album-art"
  ).hidden = true;

  placeholder.hidden = false;
  placeholder.textContent = "Select playlist";
  placeholder.style.fontSize =
    "clamp(1.25rem, 2vw, 2rem)";
  placeholder.style.padding = "12px";
  placeholder.style.lineHeight = "1.15";

  placeholder.removeAttribute("aria-hidden");
  placeholder.setAttribute("role", "status");

  document.getElementById(
    "playlist-menu"
  ).hidden = true;

  setSpotifyStatus("Select playlist");
}


// ============================================================
// LOCAL PLAYBACK DEVICE
// ============================================================

let spotifyHasPlaybackSession = false;

function updateSpotifyControlAvailability() {
  const disabled =
    !spotifyHasPlaybackSession || hubControlBusy;

  for (const id of [
    "play-pause",
    "previous-track",
    "next-track"
  ]) {
    document.getElementById(id).disabled = disabled;
  }
}

function loadSpotifyPlaybackSdk() {
  if (window.Spotify?.Player) {
    return Promise.resolve();
  }

  if (spotifySdkLoad) {
    return spotifySdkLoad;
  }

  spotifySdkLoad = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(
        new Error("Spotify player timed out; reopen the hub")
      ),
      20000
    );

    window.onSpotifyWebPlaybackSDKReady = () => {
      clearTimeout(timeout);
      resolve();
    };

    const script = document.createElement("script");

    script.src =
      "https://sdk.scdn.co/spotify-player.js";

    script.onerror = () => {
      clearTimeout(timeout);

      reject(
        new Error(
          "Could not load Spotify player; check your connection"
        )
      );
    };

    document.head.appendChild(script);
  }).catch(error => {
    spotifySdkLoad = null;
    throw error;
  });

  return spotifySdkLoad;
}


async function connectHubPlayer() {
  if (spotifyDeviceId) {
    return spotifyDeviceId;
  }

  if (spotifyPlayerReady) {
    return spotifyPlayerReady;
  }

  spotifyPlayerReady = (async () => {
    await loadSpotifyPlaybackSdk();

    if (spotifyPlayer) {
      spotifyPlayer.disconnect();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => fail(
          "Spotify player did not connect; reopen the hub"
        ),
        20000
      );

      const fail = message => {
        clearTimeout(timeout);
        setSpotifyStatus(message);
        reject(new Error(message));
      };

      spotifyPlayer = new Spotify.Player({
        name: "SamOS Hub",

        getOAuthToken: callback =>
          getValidSpotifyToken().then(
            token => callback(token || "")
          ),

        volume: 0.8
      });

      spotifyPlayer.addListener(
        "ready",
        ({ device_id }) => {
          clearTimeout(timeout);
          spotifyDeviceId = device_id;
          setSpotifyStatus("SamOS Hub ready");
          resolve(device_id);
        }
      );

      spotifyPlayer.addListener(
        "not_ready",
        () => {
          spotifyDeviceId = null;
          spotifyPlayerReady = null;

          setSpotifyStatus(
            "SamOS Hub disconnected; press play to reconnect"
          );
        }
      );

      for (const event of [
        "initialization_error",
        "authentication_error",
        "account_error"
      ]) {
        spotifyPlayer.addListener(
          event,
          ({ message }) => fail(message)
        );
      }

      spotifyPlayer.addListener(
        "playback_error",
        ({ message }) => setSpotifyStatus(message)
      );

      spotifyPlayer.addListener(
        "autoplay_failed",
        () => setSpotifyStatus(
          "Press play on the hub to enable audio"
        )
      );

      spotifyPlayer.addListener(
        "player_state_changed",
        state => renderLocalPlayback(state)
      );

      spotifyPlayer.connect()
        .then(ok => {
          if (!ok) {
            fail("Spotify player could not connect");
          }
        })
        .catch(error => fail(error.message));
    });
  })().catch(error => {
    spotifyPlayerReady = null;
    spotifyDeviceId = null;
    throw error;
  });

  return spotifyPlayerReady;
}


function activateHubAudio() {
  if (spotifyPlayer) {
    spotifyPlayer.activateElement().catch(error => {
      console.warn(
        "Spotify audio activation failed:",
        error
      );
    });
  }
}


document.addEventListener(
  "click",
  event => {
    if (
      event.target.closest?.(
        "#play-pause, #next-track, #previous-track, #spotify-shuffle, .playlist-item"
      )
    ) {
      activateHubAudio();
    }
  },
  true
);


async function transferToHub(deviceId, options, play) {
  return fetch(
    "https://api.spotify.com/v1/me/player",
    {
      method: "PUT",

      headers: {
        ...options.headers,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        device_ids: [deviceId],
        play
      })
    }
  );
}


async function hubSpotifyRequest(url, options) {
  try {
    const deviceId = await connectHubPlayer();
    const target = new URL(url);

    target.searchParams.set("device_id", deviceId);

    const startingPlayback =
      target.pathname.endsWith("/play");

    if (startingPlayback && !options.body) {
      const current = await fetch(
        "https://api.spotify.com/v1/me/player",
        { headers: options.headers }
      );

      if (current.status !== 204 && !current.ok) {
        return current;
      }

      const state =
        current.status === 204
          ? null
          : await current.json();

      if (!state?.item) {
        const recent = await fetch(
          "https://api.spotify.com/v1/me/player/recently-played?limit=1",
          { headers: options.headers }
        );

        if (recent.status === 403) {
          document.getElementById(
            "spotify-login"
          ).hidden = false;

          setSpotifyStatus(
            "Reconnect Spotify to allow listening history"
          );

          return {
            ok: false,
            status: 403,
            samosMessageShown: true
          };
        }

        if (!recent.ok) {
          return recent;
        }

        const history = await recent.json();
        const lastPlayed = history.items?.[0];
        const trackUri = lastPlayed?.track?.uri;

        if (!trackUri) {
          showSelectPlaylist();

          return {
            ok: false,
            status: 409,
            samosMessageShown: true
          };
        }

        const contextUri = lastPlayed.context?.uri;

        const playback =
          contextUri &&
          /^spotify:(playlist|album):/.test(contextUri)
            ? {
                context_uri: contextUri,
                offset: { uri: trackUri }
              }
            : {
                uris: [trackUri]
              };

        options = {
          ...options,

          headers: {
            ...options.headers,
            "Content-Type": "application/json"
          },

          body: JSON.stringify(playback)
        };
      } else if (state.device?.id !== deviceId) {
        return transferToHub(
          deviceId,
          options,
          true
        );
      }
    }

    let response =
      await fetch(target.toString(), options);

    if (startingPlayback && response.status === 404) {
      const transfer =
        await transferToHub(
          deviceId,
          options,
          false
        );

      if (!transfer.ok) {
        return transfer;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve =>
          setTimeout(resolve, 300)
        );

        response =
          await fetch(target.toString(), options);

        if (response.status !== 404) {
          break;
        }
      }
    }

    return response;
  } catch (error) {
    setSpotifyStatus(error.message);

    return {
      ok: false,
      status: 503,
      samosMessageShown: true
    };
  }
}


// ============================================================
// PKCE HELPERS
// ============================================================

function randomString(length = 64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  const values =
    crypto.getRandomValues(
      new Uint8Array(length)
    );

  return Array.from(
    values,
    value => chars[value % chars.length]
  ).join("");
}


async function sha256(value) {
  return crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
}


function base64Url(buffer) {
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
// LOGIN
// ============================================================

let spotifyLoginBusy = false;

async function loginToSpotify() {
  if (spotifyLoginBusy) return;

  if (!SPOTIFY_CLIENT_ID) {
    setSpotifyStatus("Spotify client ID is missing");
    return;
  }

  spotifyLoginBusy = true;

  const button = document.getElementById("spotify-login");
  button.disabled = true;

  try {
    const verifier = randomString(64);
    const challenge = base64Url(await sha256(verifier));
    const state = randomString(24);

    localStorage.setItem("spotify_verifier", verifier);
    localStorage.setItem("spotify_state", state);
    localStorage.setItem("spotify_login_pending", "true");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_SCOPES.join(" "),
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state,
      code_challenge_method: "S256",
      code_challenge: challenge
    });

    setSpotifyStatus("Waiting for Spotify sign-in...");

    window.location.href =
      `https://accounts.spotify.com/authorize?${params}`;
  } catch (error) {
    setSpotifyStatus(
      `Could not start Spotify login: ${error.message}`
    );
  } finally {
    spotifyLoginBusy = false;
    setSpotifyConnectionState(spotifyConnected);
  }
}


// ============================================================
// TOKEN STORAGE
// ============================================================

function saveSpotifyToken(token) {
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
    Number(token.expires_in || 3600);

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

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const response = await fetch(
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

  const token = await response.json();

  saveSpotifyToken(token);

  return token.access_token;
}


async function getValidSpotifyToken() {
  const token =
    localStorage.getItem("spotify_access_token");

  const expiresAt = Number(
    localStorage.getItem("spotify_expires_at") || 0
  );

  if (token && Date.now() < expiresAt) {
    return token;
  }

  try {
    const refreshedToken = await refreshSpotifyToken();

    if (!refreshedToken) {
      setSpotifyConnectionState(false);
    }

    return refreshedToken;
  } catch (error) {
    setSpotifyConnectionState(false);
    throw error;
  }
}


// ============================================================
// OAUTH RETURN
// ============================================================

let spotifyRedirectBusy = false;

async function handleSpotifyRedirect() {
  if (spotifyRedirectBusy) return;

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const oauthError = params.get("error");

  if (!code && !oauthError) {
    if (
      localStorage.getItem("spotify_access_token") ||
      localStorage.getItem("spotify_refresh_token")
    ) {
      await startSpotify();
    }

    return;
  }

  spotifyRedirectBusy = true;

  // Remove callback parameters so refreshing cannot reuse the code.
  const cleanUrl = new URL(window.location.href);

  for (const key of [
    "code",
    "state",
    "error",
    "error_description"
  ]) {
    cleanUrl.searchParams.delete(key);
  }

  history.replaceState(
    {},
    document.title,
    cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
  );

  const button = document.getElementById("spotify-login");
  button.disabled = true;

  try {
    if (oauthError) {
      button.hidden = false;
      setSpotifyStatus(`Spotify login failed: ${oauthError}`);
      return;
    }

    const returnedState = params.get("state");
    const expectedState = localStorage.getItem("spotify_state");
    const verifier = localStorage.getItem("spotify_verifier");

    if (
      !verifier ||
      !returnedState ||
      returnedState !== expectedState
    ) {
      button.hidden = false;

      setSpotifyStatus(
        "This sign-in link expired. Press Connect to try again."
      );

      return;
    }

    const response = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "authorization_code",
          code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          code_verifier: verifier
        })
      }
    );

    if (!response.ok) {
      button.hidden = false;

      setSpotifyStatus(
        `Spotify login failed (${response.status}). Press Connect to retry.`
      );

      return;
    }

    saveSpotifyToken(await response.json());

    for (const key of [
      "spotify_login_pending",
      "spotify_state",
      "spotify_verifier"
    ]) {
      localStorage.removeItem(key);
    }

    window.dispatchEvent(
      new Event("samos-spotify-connected")
    );

    await startSpotify();
  } catch (error) {
    button.hidden = false;

    setSpotifyStatus(
      `Spotify connection failed: ${error.message}`
    );
  } finally {
    spotifyRedirectBusy = false;
    setSpotifyConnectionState(spotifyConnected);
  }
}


// ============================================================
// LOCAL PLAYBACK STATE
// ============================================================

async function updateSpotifyPlaybackState() {
  if (!spotifyPlayer) {
    return;
  }

  try {
    const state =
      await spotifyPlayer.getCurrentState();

    renderLocalPlayback(state);
  } catch (error) {
    console.warn(
      "Could not read hub playback:",
      error
    );
  }
}


function renderLocalPlayback(state) {
  spotifyIsPlaying = Boolean(state && !state.paused);

  const track = state?.track_window?.current_track;

  spotifyHasPlaybackSession = Boolean(track);
  updateSpotifyControlAvailability();

  document.getElementById("play-pause-icon").src =
    spotifyIsPlaying
      ? "./icons/player-pause.png"
      : "./icons/player-play.png";

  document.getElementById("track-name").textContent =
    track?.name || "";

  document.getElementById("track-artist").textContent =
    (track?.artists || [])
      .map(artist => artist.name)
      .join(", ");

  const placeholder =
    document.getElementById("album-placeholder");

  if (track) {
    setSpotifyConnectionState(true);

    placeholder.textContent = "♫";
    placeholder.style.fontSize = "clamp(4rem, 5vw, 6rem)";
    placeholder.style.padding = "0";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.removeAttribute("role");
  }

  const art = track?.album?.images?.[0]?.url;
  const artEl = document.getElementById("album-art");

  artEl.hidden = !art;
  placeholder.hidden = Boolean(art);

  if (art) {
    artEl.src = art;
  } else {
    artEl.removeAttribute("src");
  }
}


async function waitForHubSession() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const state =
      await spotifyPlayer.getCurrentState();

    if (state?.track_window?.current_track) {
      renderLocalPlayback(state);
      return state;
    }

    await new Promise(resolve =>
      setTimeout(resolve, 250)
    );
  }

  throw new Error(
    "Spotify is still connecting playback; try Play again"
  );
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
  const token = await getValidSpotifyToken();

  setSpotifyConnectionState(Boolean(token));

  if (!token) {
    setSpotifyStatus(
      "Connect Spotify to load your playlists"
    );
    return;
  }

  setSpotifyStatus("Spotify connected");

  connectHubPlayer().catch(error => {
    setSpotifyStatus(error.message);
  });

  await loadPlaylists();
  await updateSpotifyPlaybackState();

  clearInterval(spotifyPlaybackPoll);

  spotifyPlaybackPoll = setInterval(
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

  menu.innerHTML = "";

  let url =
    "https://api.spotify.com/v1/me/playlists?limit=50";

  while (url) {
    const response = await fetch(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      setSpotifyStatus(
        `Could not load playlists (${response.status})`
      );

      return;
    }

    const data = await response.json();

    for (const playlist of data.items || []) {
      if (!playlist) {
        continue;
      }

      const item =
        document.createElement("button");

      item.type = "button";
      item.className = "playlist-item";
      item.textContent = playlist.name;

      item.addEventListener(
        "click",
        async () => {
          selectedPlaylistUri =
            playlist.uri;

          document.getElementById(
            "playlist-button"
          ).textContent =
            playlist.name;

          menu.hidden = true;

          await startPlaylist(
            playlist.uri
          );
        }
      );

      menu.appendChild(item);
    }

    url = data.next;
  }
}


// ============================================================
// START PLAYLIST
// ============================================================

async function startPlaylist(playlistUri) {
  return runHubControl(async () => {
    const token =
      await getValidSpotifyToken();

    if (!token) {
      throw new Error("Reconnect Spotify");
    }

    const response =
      await hubSpotifyRequest(
        "https://api.spotify.com/v1/me/player/play",
        {
          method: "PUT",

          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            context_uri: playlistUri
          })
        }
      );

    if (!response.ok) {
      if (!response.samosMessageShown) {
        throw new Error(
          `Could not start playlist (${response.status})`
        );
      }

      return;
    }

    await waitForHubSession();

    await applyHubShuffle(
      token,
      spotifyShuffleEnabled
    );

    setSpotifyStatus(
      "Playing on SamOS Hub"
    );
  });
}


// ============================================================
// CONTROLS
// ============================================================

document.getElementById(
  "spotify-login"
).addEventListener(
  "click",
  loginToSpotify
);


document.getElementById(
  "playlist-button"
).addEventListener(
  "click",
  () => {
    const menu =
      document.getElementById(
        "playlist-menu"
      );

    menu.hidden = !menu.hidden;
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
      !picker.contains(event.target)
    ) {
      menu.hidden = true;
    }
  }
);


async function runHubControl(action) {
  if (hubControlBusy) return;

  hubControlBusy = true;

  const buttons = document.querySelectorAll(
    "#play-pause, #next-track, #previous-track, #spotify-shuffle, .playlist-item"
  );

  buttons.forEach(button => {
    button.disabled = true;
  });

  try {
    await connectHubPlayer();
    await action();
    await updateSpotifyPlaybackState();
  } catch (error) {
    setSpotifyStatus(error.message);
  } finally {
    hubControlBusy = false;

    buttons.forEach(button => {
      button.disabled = false;
    });

    updateSpotifyControlAvailability();
  }
}


document.getElementById(
  "play-pause"
).addEventListener(
  "click",
  () => {
    runHubControl(async () => {
      const state =
        await spotifyPlayer.getCurrentState();

      if (state?.track_window?.current_track) {
        if (state.paused) {
          await spotifyPlayer.resume();
        } else {
          await spotifyPlayer.pause();
        }

        setSpotifyStatus(
          state.paused
            ? "Playing on SamOS Hub"
            : "Paused on SamOS Hub"
        );

        return;
      }

      const token =
        await getValidSpotifyToken();

      if (!token) {
        throw new Error("Reconnect Spotify");
      }

      const response =
        await hubSpotifyRequest(
          "https://api.spotify.com/v1/me/player/play",
          {
            method: "PUT",

            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

      if (!response.ok) {
        if (!response.samosMessageShown) {
          throw new Error(
            `Could not start playback (${response.status})`
          );
        }

        return;
      }

      await waitForHubSession();

      await applyHubShuffle(
        token,
        spotifyShuffleEnabled
      );

      setSpotifyStatus(
        "Playing on SamOS Hub"
      );
    });
  }
);


document.getElementById(
  "next-track"
).addEventListener(
  "click",
  () => {
    runHubControl(async () => {
      await waitForHubSession();
      await spotifyPlayer.nextTrack();
      refreshSpotifyAfterControl();
    });
  }
);


document.getElementById(
  "previous-track"
).addEventListener(
  "click",
  () => {
    runHubControl(async () => {
      await waitForHubSession();
      await spotifyPlayer.previousTrack();
      refreshSpotifyAfterControl();
    });
  }
);


// ============================================================
// SHUFFLE SWITCH
// ============================================================

const shuffleButton =
  document.getElementById("spotify-shuffle");

function renderShuffleButton() {
  shuffleButton.setAttribute(
    "aria-checked",
    String(spotifyShuffleEnabled)
  );
}

async function applyHubShuffle(token, desired) {
  const response = await hubSpotifyRequest(
    `https://api.spotify.com/v1/me/player/shuffle?state=${desired}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Could not change shuffle (${response.status})`
    );
  }

  // Confirm Spotify actually applied the change.
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise(resolve =>
      setTimeout(resolve, 350)
    );

    const current = await fetch(
      "https://api.spotify.com/v1/me/player",
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (current.status === 429) {
      throw new Error(
        "Spotify is busy; wait a moment and try shuffle again"
      );
    }

    if (current.ok && current.status !== 204) {
      const state = await current.json();

      if (
        state.device?.id === spotifyDeviceId &&
        state.shuffle_state === desired
      ) {
        return;
      }
    }
  }

  throw new Error(
    "Spotify has not confirmed the shuffle change; try again"
  );
}

shuffleButton.addEventListener("click", () => {
  runHubControl(async () => {
    const desired = !spotifyShuffleEnabled;
    const token = await getValidSpotifyToken();

    if (!token) {
      spotifyShuffleEnabled = desired;
    } else {
      const state = await spotifyPlayer.getCurrentState();

      if (!state?.track_window?.current_track) {
        spotifyShuffleEnabled = desired;

        setSpotifyStatus(
          "Shuffle preference saved for when music starts"
        );
      } else {
        await applyHubShuffle(token, desired);
        spotifyShuffleEnabled = desired;
      }
    }

    localStorage.setItem(
      "samos_spotify_shuffle",
      String(spotifyShuffleEnabled)
    );

    renderShuffleButton();
  });
});

renderShuffleButton();
updateSpotifyControlAvailability();
setSpotifyConnectionState(false);
handleSpotifyRedirect();