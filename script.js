// ============================================================
// SamOS Hub — external-display-first reset
// ============================================================

const CONFIG = window.SAMOS_CONFIG || {};
const SPOTIFY_CLIENT_ID = CONFIG.spotifyClientId || "";
const WEATHER = CONFIG.weather || {
  latitude: 39.92,
  longitude: -75.07,
  timezone: "America/New_York"
};

const SPOTIFY_REDIRECT_URI =
  window.location.origin + window.location.pathname;

const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private"
];

let spotifyPlayer = null;
let spotifyDeviceId = null;
let selectedPlaylistUri = null;

// TEMP
const debugSize = document.getElementById("debug-size");

debugSize.textContent =
  `${window.innerWidth} × ${window.innerHeight} | DPR ${window.devicePixelRatio}`;
//

// ============================================================
// CLOCK
// ============================================================

function updateClock() {
  const now = new Date();

  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  const parts = time.split(" ");

  document.getElementById("time-numbers").textContent = parts[0];
  document.getElementById("time-period").textContent = parts[1] || "";

  document.getElementById("date").textContent =
    now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
}

updateClock();
setInterval(updateClock, 1000);

// ============================================================
// QUOTE
// ============================================================

document.getElementById("quote").textContent =
  CONFIG.quote || "Build for Future Sam.";

// ============================================================
// WEATHER
// ============================================================

function weatherDescription(code) {
  const codes = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Foggy",
    48: "Foggy",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    95: "Thunderstorms",
    96: "Thunderstorms",
    99: "Thunderstorms"
  };

  return codes[code] || "Weather";
}

function formatWeatherTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function hoursFor(data, dateString, startHour, endHour) {
  return data.hourly.time
    .map((time, index) => ({
      time,
      hour: Number(time.slice(11, 13)),
      temperature: data.hourly.temperature_2m[index],
      precipitation: data.hourly.precipitation_probability[index],
      weatherCode: data.hourly.weather_code[index]
    }))
    .filter(item =>
      item.time.startsWith(dateString) &&
      item.hour >= startHour &&
      item.hour <= endHour
    );
}

function firstWeatherImpact(hours) {
  for (const hour of hours) {
    const code = hour.weatherCode;

    if ([95, 96, 99].includes(code)) {
      return { text: "Thunderstorms", time: hour.time };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      return { text: "Snow", time: hour.time };
    }

    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) {
      return { text: "Rain", time: hour.time };
    }
  }

  return null;
}

async function updateWeather() {
  const currentEl = document.getElementById("weather-current");
  const rangeEl = document.getElementById("weather-range");
  const afternoonEl = document.getElementById("weather-afternoon");
  const overnightEl = document.getElementById("weather-overnight");

  try {
    const params = new URLSearchParams({
      latitude: WEATHER.latitude,
      longitude: WEATHER.longitude,
      current: "temperature_2m,weather_code",
      hourly: "temperature_2m,precipitation_probability,weather_code",
      daily: "temperature_2m_max,temperature_2m_min,weather_code,snowfall_sum,wind_gusts_10m_max",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      precipitation_unit: "inch",
      timezone: WEATHER.timezone
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );

    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`);
    }

    const data = await response.json();

    const temp = Math.round(data.current.temperature_2m);
    const high = Math.round(data.daily.temperature_2m_max[0]);
    const low = Math.round(data.daily.temperature_2m_min[0]);

    currentEl.textContent =
      `${temp}° · ${weatherDescription(data.current.weather_code)}`;

    rangeEl.textContent = `High ${high}° · Low ${low}°`;

    const today = data.daily.time[0];
    const tomorrow = data.daily.time[1];

    const afternoonHours = hoursFor(data, today, 12, 18);
    const overnightHours = [
      ...hoursFor(data, today, 20, 23),
      ...hoursFor(data, tomorrow, 0, 6)
    ];

    const afternoon = firstWeatherImpact(afternoonHours);
    if (afternoon) {
      afternoonEl.textContent =
        `${afternoon.text} likely after ${formatWeatherTime(afternoon.time)}`;
      afternoonEl.hidden = false;
    } else {
      afternoonEl.hidden = true;
    }

    const overnight = firstWeatherImpact(overnightHours);
    const overnightLow = overnightHours.length
      ? Math.round(Math.min(...overnightHours.map(h => h.temperature)))
      : null;

    if (overnight) {
      overnightEl.textContent =
        `${overnight.text} overnight${overnightLow !== null ? ` · Low ${overnightLow}°` : ""}`;
      overnightEl.hidden = false;
    } else if (overnightLow !== null && overnightLow <= 32) {
      overnightEl.textContent = `Freezing overnight · Low ${overnightLow}°`;
      overnightEl.hidden = false;
    } else {
      overnightEl.hidden = true;
    }

  } catch (error) {
    console.error("Weather error:", error);
    currentEl.textContent = "Weather unavailable";
    rangeEl.textContent = "";
    afternoonEl.hidden = true;
    overnightEl.hidden = true;
  }
}

async function updateWeatherAlerts() {
  const alertEl = document.getElementById("weather-alerts");

  try {
    const response = await fetch(
      `https://api.weather.gov/alerts/active?point=${WEATHER.latitude},${WEATHER.longitude}`
    );

    if (!response.ok) {
      throw new Error(`NWS returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.features?.length) {
      alertEl.textContent = "";
      alertEl.hidden = true;
      return;
    }

    const alerts = data.features
      .map(feature => feature.properties)
      .filter(Boolean);

    const rank = alert => {
      const event = alert.event || "";
      if (event.includes("Warning")) return 3;
      if (event.includes("Watch")) return 2;
      if (event.includes("Advisory")) return 1;
      return 0;
    };

    alerts.sort((a, b) => rank(b) - rank(a));

    const alert = alerts[0];
    const end = alert.ends || alert.expires;

    alertEl.textContent =
      `${alert.event}${end ? ` · until ${formatWeatherTime(end)}` : ""}`;

    alertEl.hidden = false;

  } catch (error) {
    console.error("Weather alert error:", error);
    alertEl.hidden = true;
  }
}

updateWeather();
updateWeatherAlerts();
setInterval(updateWeather, 30 * 60 * 1000);
setInterval(updateWeatherAlerts, 15 * 60 * 1000);

// ============================================================
// SPOTIFY PKCE AUTH
// ============================================================

function randomString(length = 64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  const values = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(values, value => chars[value % chars.length]).join("");
}

async function sha256(value) {
  return crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
}

function base64Url(buffer) {
  return btoa(
    String.fromCharCode(...new Uint8Array(buffer))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function loginToSpotify() {
  if (!SPOTIFY_CLIENT_ID) {
    setSpotifyStatus("Spotify client ID is missing");
    return;
  }

  const verifier = randomString(64);
  const challenge = base64Url(await sha256(verifier));
  const state = randomString(24);

  sessionStorage.setItem("spotify_verifier", verifier);
  sessionStorage.setItem("spotify_state", state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge
  });

  window.location.href =
    `https://accounts.spotify.com/authorize?${params}`;
}

async function handleSpotifyRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const returnedState = params.get("state");

  if (!code) {
    if (localStorage.getItem("spotify_access_token")) {
      startSpotify();
    }
    return;
  }

  const expectedState = sessionStorage.getItem("spotify_state");
  const verifier = sessionStorage.getItem("spotify_verifier");

  if (!verifier || !returnedState || returnedState !== expectedState) {
    setSpotifyStatus("Spotify login could not be verified");
    return;
  }

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: verifier
  });

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  if (!response.ok) {
    setSpotifyStatus("Spotify login failed");
    return;
  }

  const token = await response.json();
  saveSpotifyToken(token);

  sessionStorage.removeItem("spotify_state");
  sessionStorage.removeItem("spotify_verifier");

  history.replaceState({}, document.title, SPOTIFY_REDIRECT_URI);

  startSpotify();
}

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

  const expiresIn = Number(token.expires_in || 3600);

  localStorage.setItem(
    "spotify_expires_at",
    String(Date.now() + (expiresIn - 60) * 1000)
  );
}

async function refreshSpotifyToken() {
  const refreshToken =
    localStorage.getItem("spotify_refresh_token");

  if (!refreshToken) return null;

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
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  if (!response.ok) return null;

  const token = await response.json();
  saveSpotifyToken(token);

  return token.access_token;
}

async function getValidSpotifyToken() {
  const token =
    localStorage.getItem("spotify_access_token");

  const expiresAt =
    Number(localStorage.getItem("spotify_expires_at") || 0);

  if (token && Date.now() < expiresAt) {
    return token;
  }

  return refreshSpotifyToken();
}

// ============================================================
// SPOTIFY PLAYER
// ============================================================

function setSpotifyStatus(message) {
  document.getElementById("spotify-status").textContent = message;
}

function loadSpotifySDK() {
  if (window.Spotify) {
    createSpotifyPlayer();
    return;
  }

  if (document.getElementById("spotify-sdk")) return;

  const script = document.createElement("script");
  script.id = "spotify-sdk";
  script.src = "https://sdk.scdn.co/spotify-player.js";
  document.body.appendChild(script);

  window.onSpotifyWebPlaybackSDKReady = createSpotifyPlayer;
}

async function createSpotifyPlayer() {
  if (spotifyPlayer || !window.Spotify) return;

  const token = await getValidSpotifyToken();

  if (!token) {
    setSpotifyStatus("Connect Spotify to load your playlists");
    return;
  }

  spotifyPlayer = new Spotify.Player({
    name: "SamOS Hub",
    getOAuthToken: async callback => {
      const freshToken = await getValidSpotifyToken();
      callback(freshToken || "");
    },
    volume: 0.75
  });

  spotifyPlayer.addListener("ready", async ({ device_id }) => {
    spotifyDeviceId = device_id;

    setSpotifyStatus("SamOS Hub connected");
    document.getElementById("spotify-login").hidden = true;

    await transferPlaybackToSamOS();
    await loadPlaylists();
  });

  spotifyPlayer.addListener("not_ready", () => {
    setSpotifyStatus("Spotify disconnected");
  });

  spotifyPlayer.addListener("authentication_error", ({ message }) => {
    console.error("Spotify authentication error:", message);
    setSpotifyStatus("Reconnect Spotify");
    document.getElementById("spotify-login").hidden = false;
  });

  spotifyPlayer.addListener("account_error", ({ message }) => {
    console.error("Spotify account error:", message);
    setSpotifyStatus("Spotify Premium is required");
  });

  spotifyPlayer.addListener("playback_error", ({ message }) => {
    console.error("Spotify playback error:", message);
  });

  spotifyPlayer.addListener("player_state_changed", state => {
    if (!state) return;

    const track = state.track_window?.current_track;
    if (!track) return;

    document.getElementById("track-name").textContent =
      track.name || "Nothing playing";

    document.getElementById("track-artist").textContent =
      (track.artists || []).map(artist => artist.name).join(", ");

    const art = track.album?.images?.[0]?.url || "";
    const artEl = document.getElementById("album-art");
    const placeholderEl =
      document.getElementById("album-placeholder");

    if (art) {
      artEl.src = art;
      artEl.hidden = false;
      placeholderEl.hidden = true;
    } else {
      artEl.hidden = true;
      placeholderEl.hidden = false;
    }

    document.getElementById("play-pause").textContent =
      state.paused ? "▶" : "⏸";
  });

  spotifyPlayer.connect();
}

async function transferPlaybackToSamOS() {
  if (!spotifyDeviceId) return;

  const token = await getValidSpotifyToken();
  if (!token) return;

  await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      device_ids: [spotifyDeviceId],
      play: false
    })
  });
}

async function loadPlaylists() {
  const token = await getValidSpotifyToken();
  if (!token) return;

  const menu = document.getElementById("playlist-menu");
  menu.innerHTML = "";

  let url =
    "https://api.spotify.com/v1/me/playlists?limit=50";

  while (url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      setSpotifyStatus("Could not load Spotify playlists");
      return;
    }

    const data = await response.json();

    for (const playlist of data.items || []) {
      if (!playlist) continue;

      const item = document.createElement("button");
      item.type = "button";
      item.className = "playlist-item";
      item.textContent = playlist.name;

      item.addEventListener("click", async () => {
        selectedPlaylistUri = playlist.uri;

        document.getElementById("playlist-button").textContent =
          playlist.name;

        menu.hidden = true;

        await startPlaylist(playlist.uri);
      });

      menu.appendChild(item);
    }

    url = data.next;
  }
}

async function startPlaylist(playlistUri) {
  if (!spotifyDeviceId) {
    setSpotifyStatus("Spotify player is not ready yet");
    return;
  }

  const token = await getValidSpotifyToken();
  if (!token) {
    setSpotifyStatus("Reconnect Spotify");
    return;
  }

  await transferPlaybackToSamOS();

  await fetch(
    `https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${encodeURIComponent(spotifyDeviceId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`,
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
    setSpotifyStatus("Could not start playlist");
    return;
  }

  setSpotifyStatus("Shuffle on");
}

// ============================================================
// CONTROLS
// ============================================================

document
  .getElementById("spotify-login")
  .addEventListener("click", loginToSpotify);

document
  .getElementById("playlist-button")
  .addEventListener("click", () => {
    const menu = document.getElementById("playlist-menu");
    menu.hidden = !menu.hidden;
  });

document.addEventListener("click", event => {
  const picker = document.querySelector(".playlist-picker");
  const menu = document.getElementById("playlist-menu");

  if (!picker.contains(event.target)) {
    menu.hidden = true;
  }
});

document
  .getElementById("play-pause")
  .addEventListener("click", async () => {
    if (!spotifyPlayer) return;

    const state = await spotifyPlayer.getCurrentState();

    if (!state) {
      if (selectedPlaylistUri) {
        await startPlaylist(selectedPlaylistUri);
      }
      return;
    }

    if (state.paused) {
      await spotifyPlayer.resume();
    } else {
      await spotifyPlayer.pause();
    }
  });

document
  .getElementById("next-track")
  .addEventListener("click", async () => {
    if (spotifyPlayer) await spotifyPlayer.nextTrack();
  });

document
  .getElementById("previous-track")
  .addEventListener("click", async () => {
    if (spotifyPlayer) await spotifyPlayer.previousTrack();
  });

// ============================================================
// START
// ============================================================

handleSpotifyRedirect();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}
