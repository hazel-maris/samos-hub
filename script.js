// ============================================================
// SAMOS HUB
// ============================================================


// ============================================================
// CLOCK
// ============================================================

function updateClock() {
  const now = new Date();

  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  const timeParts = time.split(" ");

  const timeNumbers = timeParts[0];
  const timePeriod = timeParts[1] || "";

  const isPortrait =
    window.matchMedia("(orientation: portrait)").matches;

  const date = now.toLocaleDateString([], {
    weekday: isPortrait ? "short" : "long",
    month: "long",
    day: "numeric",
    // year: "numeric"
  });

  document.getElementById("time-numbers").textContent = timeNumbers;
  document.getElementById("time-period").textContent = timePeriod;
  document.getElementById("date").textContent = date;

  // Leaving this here in case I decide to
  // revert time back to a single variable.

  // document.getElementById("time").textContent = time;
}

updateClock();
setInterval(updateClock, 1000);


// ============================================================
// WEATHER
// ============================================================

async function updateWeather() {
  try {
    const latitude = 39.92;
    const longitude = -75.07;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,weather_code` +
      `&hourly=temperature_2m,precipitation_probability,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=fahrenheit` +
      `&timezone=America%2FNew_York`;

    const response = await fetch(url);
    const data = await response.json();

    const currentTemp =
      Math.round(data.current.temperature_2m);

    const high =
      Math.round(data.daily.temperature_2m_max[0]);

    const low =
      Math.round(data.daily.temperature_2m_min[0]);

    const weatherText =
      getWeatherDescription(
        data.current.weather_code
      );

    document.getElementById(
      "weather-current"
    ).textContent =
      `${currentTemp}° · ${weatherText}`;

    document.getElementById(
      "weather-range"
    ).textContent =
      `High ${high}° · Low ${low}°`;

    updateWeatherImpacts(data);

  } catch (error) {
    console.error(
      "Weather error:",
      error
    );

    document.getElementById(
      "weather-current"
    ).textContent =
      "Weather unavailable";
  }
}

function updateWeatherImpacts(data) {
  const afternoonElement =
    document.getElementById("weather-afternoon");

  const overnightElement =
    document.getElementById("weather-overnight");

  const today =
    data.daily.time[0];

  const tomorrow =
    data.daily.time[1];

  const afternoonHours =
    getWeatherHours(
      data,
      today,
      12,
      18
    );

  const overnightHours = [
    ...getWeatherHours(
      data,
      today,
      20,
      23
    ),

    ...getWeatherHours(
      data,
      tomorrow,
      0,
      6
    )
  ];

  const afternoonImpact =
    getWeatherImpact(afternoonHours);

  const overnightImpact =
    getWeatherImpact(overnightHours);

  if (afternoonImpact) {
    const startTime =
      formatWeatherTime(
        afternoonImpact.time
      );

    afternoonElement.textContent =
      `${afternoonImpact.text} likely after ${startTime}`;

    afternoonElement.hidden = false;
  } else {
    afternoonElement.hidden = true;
  }

  const overnightLow =
    Math.round(
      Math.min(
        ...overnightHours.map(
          hour => hour.temperature
        )
      )
    );

  if (overnightImpact) {
    overnightElement.textContent =
      `${overnightImpact.text} overnight · Low ${overnightLow}°`;

    overnightElement.hidden = false;

  } else if (overnightLow <= 32) {
    overnightElement.textContent =
      `Freezing overnight · Low ${overnightLow}°`;

    overnightElement.hidden = false;

  } else {
    overnightElement.hidden = true;
  }
}

function getWeatherHours(
  data,
  date,
  startHour,
  endHour
) {
  return data.hourly.time
    .map((time, index) => ({
      time: time,
      hour: Number(
        time.slice(11, 13)
      ),
      temperature:
        data.hourly.temperature_2m[index],
      precipitation:
        data.hourly.precipitation_probability[index],
      weatherCode:
        data.hourly.weather_code[index]
    }))
    .filter(hour =>
      hour.time.startsWith(date) &&
      hour.hour >= startHour &&
      hour.hour <= endHour
    );
}

function getWeatherImpact(hours) {
  for (const hour of hours) {
    const code = hour.weatherCode;

    if ([95, 96, 99].includes(code)) {
      return {
        text: "Thunderstorms",
        time: hour.time
      };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      return {
        text: "Snow",
        time: hour.time
      };
    }

    if (
      [
        51, 53, 55,
        56, 57,
        61, 63, 65,
        66, 67,
        80, 81, 82
      ].includes(code)
    ) {
      return {
        text: "Rain",
        time: hour.time
      };
    }
  }

  return null;
}

function formatWeatherTime(time) {
  const hour =
    Number(
      time.slice(11, 13)
    );

  const period =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${displayHour} ${period}`;
}

function getWeatherDescription(code) {
  const weatherCodes = {
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

    95: "Thunderstorms"
  };

  return weatherCodes[code] || "Weather";
}

updateWeather();

setInterval(
  updateWeather,
  30 * 60 * 1000
);


// ============================================================
// SPOTIFY SETTINGS
// ============================================================

const clientId =
  "702e46e7746b4766a46edcfe13b01f50";

const redirectUri =
  window.location.origin +
  window.location.pathname;


const scopes = [
  "streaming",
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative"
];


let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyAccessToken = null;


// ============================================================
// SPOTIFY PKCE LOGIN
// ============================================================

function generateCodeVerifier(length = 64) {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  let text = "";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(
      Math.floor(
        Math.random() * possible.length
      )
    );
  }

  return text;
}


async function generateCodeChallenge(
  codeVerifier
) {
  const data =
    new TextEncoder().encode(
      codeVerifier
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return btoa(
    String.fromCharCode(
      ...new Uint8Array(digest)
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


async function loginToSpotify() {
  const codeVerifier =
    generateCodeVerifier();

  const codeChallenge =
    await generateCodeChallenge(
      codeVerifier
    );

  localStorage.setItem(
    "spotify_code_verifier",
    codeVerifier
  );

  const authUrl =
    new URL(
      "https://accounts.spotify.com/authorize"
    );

  const params = {
    client_id: clientId,

    response_type: "code",

    redirect_uri: redirectUri,

    scope: scopes.join(" "),

    code_challenge_method: "S256",

    code_challenge: codeChallenge
  };

  authUrl.search =
    new URLSearchParams(
      params
    ).toString();

  window.location.href =
    authUrl.toString();
}


// ============================================================
// SPOTIFY TOKENS
// ============================================================

async function getAccessToken(code) {
  const codeVerifier =
    localStorage.getItem(
      "spotify_code_verifier"
    );

  const response =
    await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({
          client_id: clientId,

          grant_type:
            "authorization_code",

          code: code,

          redirect_uri:
            redirectUri,

          code_verifier:
            codeVerifier
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "Spotify token error:",
      data
    );

    throw new Error(
      "Could not get Spotify token."
    );
  }

  saveSpotifyTokens(data);

  // Deleting the PKCE verifier because I don't need it anymore.
  localStorage.removeItem(
    "spotify_code_verifier"
  );

  return data.access_token;
}

function saveSpotifyTokens(data) {
  spotifyAccessToken =
    data.access_token;

  localStorage.setItem(
    "spotify_access_token",
    data.access_token
  );

  if (data.refresh_token) {
    localStorage.setItem(
      "spotify_refresh_token",
      data.refresh_token
    );
  }

  const expiresAt =
    Date.now() +
    data.expires_in * 1000;

  localStorage.setItem(
    "spotify_expires_at",
    expiresAt
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

  const response =
    await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({
          client_id: clientId,

          grant_type:
            "refresh_token",

          refresh_token:
            refreshToken
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "Spotify refresh error:",
      data
    );

    return null;
  }

  saveSpotifyTokens(data);

  return data.access_token;
}

async function getValidSpotifyToken() {
  const storedToken =
    localStorage.getItem(
      "spotify_access_token"
    );

  const expiresAt =
    Number(
      localStorage.getItem(
        "spotify_expires_at"
      )
    );

  // Still valid
  if (
    storedToken &&
    expiresAt &&
    Date.now() < expiresAt - 60000
  ) {
    spotifyAccessToken =
      storedToken;

    return storedToken;
  }

  // Try refreshing it
  const refreshed =
    await refreshSpotifyToken();

  if (refreshed) {
    return refreshed;
  }

  return null;
}


// ============================================================
// HANDLE SPOTIFY REDIRECT
// ============================================================

function showSpotifyLogin() {
  document.getElementById(
    "spotify-login-message"
  ).hidden = false;

  document.getElementById(
    "spotify-login"
  ).hidden = false;
}

function hideSpotifyLogin() {
  document.getElementById(
    "spotify-login-message"
  ).hidden = true;

  document.getElementById(
    "spotify-login"
  ).hidden = true;
}


async function handleSpotifyRedirect() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const code =
    params.get("code");

  if (code) {
    try {
      const accessToken =
        await getAccessToken(code);

      // Hide login button in the fresh OAuth callback path.  
      hideSpotifyLogin();

      // Remove ?code=blahblah from URL
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      initializeSpotifyPlayer(
        accessToken
      );

      return;

    } catch (error) {
      console.error(error);
    }
  }


  // If we've already connected before, try using the stored token.
  // If no stored token, tell me to reconnect.
  const storedToken =
    await getValidSpotifyToken();

  if (storedToken) {
    hideSpotifyLogin();

    initializeSpotifyPlayer(
      storedToken
    );

    return;
  }

  showSpotifyLogin();
}

// ============================================================
// LOAD SPOTIFY WEB PLAYBACK SDK
// ============================================================

function loadSpotifySDK() {

  // SDK already exists
  if (window.Spotify) {
    window.onSpotifyWebPlaybackSDKReady();
    return;
  }

  // Don't load it twice
  if (
    document.getElementById(
      "spotify-sdk"
    )
  ) {
    return;
  }

  const script =
    document.createElement(
      "script"
    );

  script.id =
    "spotify-sdk";

  script.src =
    "https://sdk.scdn.co/spotify-player.js";

  document.body.appendChild(
    script
  );
}


// ============================================================
// CREATE SAMOS HUB SPOTIFY PLAYER
// ============================================================

function initializeSpotifyPlayer(
  accessToken
) {
  spotifyAccessToken =
    accessToken;


  window.onSpotifyWebPlaybackSDKReady =
    () => {

      // Don't accidentally create two players
      if (spotifyPlayer) {
        return;
      }


      spotifyPlayer =
        new Spotify.Player({
          name: "SamOS Hub",

          getOAuthToken:
            async callback => {

              const token =
                await getValidSpotifyToken();

              callback(token);
            },

          volume: 0.5
        });


      // ------------------------------------------------------
      // READY
      // ------------------------------------------------------

      spotifyPlayer.addListener(
        "ready",

        async ({ device_id }) => {

          console.log(
            "SamOS Hub ready:",
            device_id
          );

          spotifyDeviceId =
            device_id;


          document.getElementById(
            "spotify-status"
          ).textContent =
            "SamOS Hub connected";


          document.getElementById(
            "spotify-player"
          ).hidden =
            false;


          hideSpotifyLogin();

          await transferPlaybackToSamOS();

          await loadPlaylists();
        }
      );


      // ------------------------------------------------------
      // NOT READY
      // ------------------------------------------------------

      spotifyPlayer.addListener(
        "not_ready",

        ({ device_id }) => {

          console.log(
            "Device offline:",
            device_id
          );

          document.getElementById(
            "spotify-status"
          ).textContent =
            "Spotify disconnected";
        }
      );


      // ------------------------------------------------------
      // AUTH ERROR
      // ------------------------------------------------------

      spotifyPlayer.addListener(
        "authentication_error",

        ({ message }) => {

          console.error(
            "Spotify auth error:",
            message
          );

          document.getElementById(
            "spotify-status"
          ).textContent =
            "Spotify authorization expired";
        }
      );


      // ------------------------------------------------------
      // PLAYBACK ERROR
      // ------------------------------------------------------

      spotifyPlayer.addListener(
        "playback_error",

        ({ message }) => {

          console.error(
            "Spotify playback error:",
            message
          );
        }
      );


      // ------------------------------------------------------
      // PLAYER STATE CHANGED
      // ------------------------------------------------------

      spotifyPlayer.addListener(
        "player_state_changed",

        state => {

          if (!state) {
            return;
          }


          const track =
            state.track_window
              .current_track;


          if (!track) {
            return;
          }


          const artists =
            track.artists
              .map(
                artist =>
                  artist.name
              )
              .join(", ");


          document.getElementById(
            "track-name"
          ).textContent =
            track.name;


          document.getElementById(
            "track-artist"
          ).textContent =
            artists;


          const albumArt =
            document.getElementById(
              "album-art"
            );


            if (
            track.album &&
            track.album.images &&
            track.album.images.length > 0
            ) {
            albumArt.src =
                track.album.images[0].url;

            albumArt.hidden =
                false;

            document.getElementById(
                "album-placeholder"
            ).hidden = true;
            }


          document.getElementById(
            "play-pause"
          ).textContent =
            state.paused
              ? "▶"
              : "⏸";
        }
      );


      spotifyPlayer.connect();
    };


  loadSpotifySDK();
}


// ============================================================
// MAKE SAMOS HUB THE ACTIVE SPOTIFY DEVICE
// ============================================================

async function transferPlaybackToSamOS() {
  if (!spotifyDeviceId) {
    return;
  }

  const token =
    await getValidSpotifyToken();

  if (!token) {
    return;
  }


  const response =
    await fetch(
      "https://api.spotify.com/v1/me/player",
      {
        method: "PUT",

        headers: {
          "Authorization":
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          device_ids: [
            spotifyDeviceId
          ],

          play: false
        })
      }
    );


  if (!response.ok) {
    console.error(
      "Could not transfer playback:",
      response.status
    );
  }
}


// ============================================================
// LOAD USER PLAYLISTS
// ============================================================

async function loadPlaylists() {
  const token =
    await getValidSpotifyToken();

  if (!token) {
    return;
  }

  const playlistMenu =
    document.getElementById(
      "playlist-menu"
    );

  playlistMenu.innerHTML = "";

  let url =
    "https://api.spotify.com/v1/me/playlists?limit=50";

  while (url) {
    const response =
      await fetch(
        url,
        {
          headers: {
            "Authorization":
              `Bearer ${token}`
          }
        }
      );

    if (!response.ok) {
      console.error(
        "Could not load playlists:",
        response.status
      );

      return;
    }

    const data =
      await response.json();

    data.items.forEach(
      playlist => {

        if (!playlist) {
          return;
        }

        const item =
          document.createElement(
            "button"
          );

        item.className =
          "playlist-item";

        item.textContent =
          playlist.name;

        item.dataset.uri =
          playlist.uri;

        item.addEventListener(
          "click",
          async () => {

            document.getElementById(
              "playlist-button"
            ).textContent =
              playlist.name;

            playlistMenu.hidden =
              true;

            await startPlaylist(
              playlist.uri
            );
          }
        );

        playlistMenu.appendChild(
          item
        );
      }
    );

    url = data.next;
  }
}


// ============================================================
// START SELECTED PLAYLIST
// ============================================================

async function startPlaylist(playlistUri) {
  if (!spotifyDeviceId) {

    document.getElementById(
      "spotify-status"
    ).textContent =
      "Spotify player not ready";

    return;
  }


  const token =
    await getValidSpotifyToken();

  if (!token) {

    document.getElementById(
      "spotify-status"
    ).textContent =
      "Reconnect Spotify";

    return;
  }


  // Make sure SamOS Hub is active
  await transferPlaybackToSamOS();


  // Turn shuffle ON
  const shuffleResponse =
    await fetch(
      `https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${spotifyDeviceId}`,
      {
        method: "PUT",

        headers: {
          "Authorization":
            `Bearer ${token}`
        }
      }
    );


  if (!shuffleResponse.ok) {
    console.error(
      "Could not enable shuffle:",
      shuffleResponse.status
    );
  }


  // Start selected playlist
  const playResponse =
    await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`,
      {
        method: "PUT",

        headers: {
          "Authorization":
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          context_uri:
            playlistUri
        })
      }
    );


  if (!playResponse.ok) {

    console.error(
      "Could not start playlist:",
      playResponse.status
    );

    document.getElementById(
      "spotify-status"
    ).textContent =
      "Could not start playlist";

    return;
  }

  document.getElementById(
    "spotify-status"
  ).textContent =
    "Shuffle on";
}


// ============================================================
// SPOTIFY BUTTONS
// ============================================================


// CONNECT SPOTIFY

document.getElementById(
  "spotify-login"
).addEventListener(
  "click",
  loginToSpotify
);


// PLAY / PAUSE

document.getElementById(
  "play-pause"
).addEventListener(
  "click",

  async () => {

    if (!spotifyPlayer) {
      return;
    }

    const state =
      await spotifyPlayer
        .getCurrentState();

    if (!state) {
      await startSelectedPlaylist();
      return;
    }

    if (state.paused) {
      await spotifyPlayer.resume();
    } else {
      await spotifyPlayer.pause();
    }
  }
);

// NEXT TRACK

document.getElementById(
  "next-track"
).addEventListener(
  "click",

  async () => {

    if (!spotifyPlayer) {
      return;
    }

    await spotifyPlayer.nextTrack();
  }
);


// PREVIOUS TRACK

document.getElementById(
  "previous-track"
).addEventListener(
  "click",

  async () => {

    if (!spotifyPlayer) {
      return;
    }

    await spotifyPlayer.previousTrack();
  }
);

// PLAYLIST BUTTON

document.getElementById(
  "playlist-button"
).addEventListener(
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

// CLICK TO LEAVE PLAYLIST MENU

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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}

// ============================================================
// START SPOTIFY
// ============================================================

handleSpotifyRedirect();