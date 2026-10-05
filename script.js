// ============================================================
// SamOS Hub
// ============================================================

const CONFIG = window.SAMOS_CONFIG || {};

const SPOTIFY_CLIENT_ID =
  CONFIG.spotifyClientId || "";

const WEATHER =
  CONFIG.weather || {
    latitude: 39.92,
    longitude: -75.07,
    timezone: "America/New_York"
  };

const SPOTIFY_REDIRECT_URI =
  `${window.location.origin}${window.location.pathname}`;

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


// ============================================================
// CLOCK
// ============================================================

function updateClock() {
  const now = new Date();

  const time =
    now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

  const parts = time.split(" ");

  document.getElementById(
    "time-numbers"
  ).textContent =
    parts[0];

  document.getElementById(
    "time-period"
  ).textContent =
    parts[1] || "";

  document.getElementById(
    "date"
  ).textContent =
    now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
}

updateClock();

setInterval(
  updateClock,
  1000
);


// ============================================================
// QUOTE
// ============================================================

document.getElementById(
  "quote"
).textContent =
  CONFIG.quote ||
  "Build for Future Sam.";


// ============================================================
// WEATHER HELPERS
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

    56: "Freezing drizzle",
    57: "Freezing drizzle",

    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",

    66: "Freezing rain",
    67: "Freezing rain",

    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",

    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",

    85: "Snow showers",
    86: "Heavy snow showers",

    95: "Thunderstorms",
    96: "Thunderstorms",
    99: "Thunderstorms"
  };

  return codes[code] || "Weather";
}


function getWeatherIcon(code) {
  if (
    code === 0 ||
    code === 1
  ) {
    return "./icons/weather-sunny.png";
  }

  if (
    [2, 3, 45, 48]
      .includes(code)
  ) {
    return "./icons/weather-cloudy.png";
  }

  if (
    [
      51, 53, 55,
      56, 57,
      61, 63, 65,
      66, 67,
      80, 81, 82,
      95, 96, 99
    ].includes(code)
  ) {
    return "./icons/weather-rainy.png";
  }

  if (
    [
      71, 73, 75,
      77, 85, 86
    ].includes(code)
  ) {
    return "./icons/weather-snowy.png";
  }

  return "./icons/weather-cloudy.png";
}


function getTemperatureIcon(temperature) {
  if (temperature <= 45) {
    return "./icons/temp-cold.png";
  }

  if (temperature <= 75) {
    return "./icons/temp-mild.png";
  }

  return "./icons/temp-hot.png";
}


function formatWeatherTime(iso) {
  if (!iso) {
    return "";
  }

  const date =
    new Date(iso);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}


function hoursFor(
  data,
  dateString,
  startHour,
  endHour
) {
  return data.hourly.time

    .map(
      (time, index) => ({
        time,

        hour:
          Number(
            time.slice(11, 13)
          ),

        temperature:
          data.hourly
            .temperature_2m[index],

        precipitation:
          data.hourly
            .precipitation_probability[index],

        weatherCode:
          data.hourly
            .weather_code[index]
      })
    )

    .filter(
      item =>
        item.time.startsWith(
          dateString
        ) &&
        item.hour >= startHour &&
        item.hour <= endHour
    );
}


function firstWeatherImpact(hours) {
  for (const hour of hours) {
    const code =
      hour.weatherCode;

    if (
      [95, 96, 99]
        .includes(code)
    ) {
      return {
        text: "Thunderstorms",
        time: hour.time
      };
    }

    if (
      [
        71, 73, 75,
        77, 85, 86
      ].includes(code)
    ) {
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


function representativeWeather(hours) {
  if (!hours.length) {
    return null;
  }

  return hours[
    Math.floor(
      hours.length / 2
    )
  ];
}


// ============================================================
// MAJOR UPCOMING WEATHER
// ============================================================

function formatForecastDay(dateString) {
  const date =
    new Date(
      `${dateString}T12:00:00`
    );

  return date.toLocaleDateString([], {
    weekday: "long"
  });
}


function getMajorWeatherEvent(data) {
  for (
    let index = 1;
    index < data.daily.time.length;
    index++
  ) {
    const dayName =
      formatForecastDay(
        data.daily.time[index]
      );

    const weatherCode =
      data.daily
        .weather_code[index];

    const snowfall =
      data.daily
        .snowfall_sum[index];

    const windGust =
      data.daily
        .wind_gusts_10m_max[index];


    if (snowfall >= 4) {
      return (
        `Heavy snow possible ${dayName}`
      );
    }


    if (
      [95, 96, 99]
        .includes(weatherCode)
    ) {
      return (
        `Strong storms possible ${dayName}`
      );
    }


    if (windGust >= 45) {
      return (
        `Strong winds possible ${dayName}`
      );
    }
  }

  return null;
}


function updateMajorWeatherEvent(data) {
  const container =
    document.getElementById(
      "weather-event"
    );

  const text =
    document.getElementById(
      "weather-event-text"
    );

  const icon =
    document.getElementById(
      "weather-event-icon"
    );

  const event =
    getMajorWeatherEvent(data);


if (!event) {
  icon.hidden = true;

  text.textContent =
    "No upcoming events or storms.";

  container.hidden = false;

  return;
}


icon.src =
  "./icons/weather-major-event.png";

icon.hidden = false;

text.textContent =
  event;

container.hidden = false;
}


// ============================================================
// CURRENT + UPCOMING WEATHER
// ============================================================

async function updateWeather() {
  const tempEl =
    document.getElementById(
      "weather-temp"
    );

  const conditionEl =
    document.getElementById(
      "weather-condition"
    );

  const tempIcon =
    document.getElementById(
      "temp-icon"
    );

  const weatherIcon =
    document.getElementById(
      "weather-icon"
    );

  const rangeEl =
    document.getElementById(
      "weather-range"
    );

  const afternoonEl =
    document.getElementById(
      "weather-afternoon"
    );

  const overnightEl =
    document.getElementById(
      "weather-overnight"
    );

  const overnightText =
    document.getElementById(
      "weather-overnight-text"
    );

  try {
    const params =
      new URLSearchParams({
        latitude:
          WEATHER.latitude,

        longitude:
          WEATHER.longitude,

        current:
          "temperature_2m,weather_code",

        hourly:
          "temperature_2m,precipitation_probability,weather_code",

        daily:
          "temperature_2m_max,temperature_2m_min,weather_code,snowfall_sum,wind_gusts_10m_max,sunrise,sunset",
        
        temperature_unit:
          "fahrenheit",

        wind_speed_unit:
          "mph",

        precipitation_unit:
          "inch",

        timezone:
          WEATHER.timezone
      });


    const response =
      await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`
      );


    if (!response.ok) {
      throw new Error(
        `Open-Meteo returned ${response.status}`
      );
    }


    const data =
      await response.json();


    const temp =
      Math.round(
        data.current.temperature_2m
      );

    const weatherCode =
      data.current.weather_code;

    const high =
      Math.round(
        data.daily
          .temperature_2m_max[0]
      );

    const low =
      Math.round(
        data.daily
          .temperature_2m_min[0]
      );


    tempEl.textContent =
      `${temp}°`;

    conditionEl.textContent =
      weatherDescription(
        weatherCode
      );


    tempIcon.src =
      getTemperatureIcon(temp);

    tempIcon.hidden =
      false;


    weatherIcon.src =
      getWeatherIcon(
        weatherCode
      );

    weatherIcon.hidden =
      false;


    rangeEl.textContent =
      `High ${high}° · Low ${low}°`;

      const sunrise =
  new Date(
    data.daily.sunrise[0]
  ).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

const sunset =
  new Date(
    data.daily.sunset[0]
  ).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

document.getElementById(
  "sun-times"
).textContent =
  `Sunrise ${sunrise} · Sunset ${sunset}`;


    const today =
      data.daily.time[0];

    const tomorrow =
      data.daily.time[1];


    const afternoonHours =
      hoursFor(
        data,
        today,
        12,
        18
      );


    const overnightHours = [
      ...hoursFor(
        data,
        today,
        20,
        23
      ),

      ...hoursFor(
        data,
        tomorrow,
        0,
        6
      )
    ];


    // --------------------------------------------------------
    // AFTERNOON / EVENING
    // --------------------------------------------------------

    const currentHour =
      new Date().getHours();


    const afternoonImpact =
      firstWeatherImpact(
        afternoonHours
      );


    const afternoonRepresentative =
      representativeWeather(
        afternoonHours
      );


    const overnightImpact =
      firstWeatherImpact(
        overnightHours
      );


    const overnightRepresentative =
      representativeWeather(
        overnightHours
      );


    const overnightLow =
      overnightHours.length
        ? Math.round(
            Math.min(
              ...overnightHours.map(
                hour =>
                  hour.temperature
              )
            )
          )
        : null;


    // BEFORE 6 PM: AFTERNOON ONLY

    if (currentHour < 18) {

      if (afternoonImpact) {
        afternoonEl.textContent =
          `Afternoon · ${afternoonImpact.text} after ${formatWeatherTime(afternoonImpact.time)}`;
      }

      else if (
        afternoonRepresentative
      ) {
        afternoonEl.textContent =
          `Afternoon · ${weatherDescription(
            afternoonRepresentative.weatherCode
          )} · ${Math.round(
            afternoonRepresentative.temperature
          )}°`;
      }

      else {
        afternoonEl.textContent =
          "Afternoon · Forecast unavailable";
      }


      afternoonEl.hidden =
        false;

      overnightEl.hidden =
        true;
    }


    // 6 PM AND LATER: EVENING ONLY

    else {

      if (overnightImpact) {
        overnightText.textContent =
          `Evening · ${overnightImpact.text}${
            overnightLow !== null
              ? ` · Low ${overnightLow}°`
              : ""
          }`;
      }

      else if (
        overnightRepresentative
      ) {
        overnightText.textContent =
          `Evening · ${weatherDescription(
            overnightRepresentative.weatherCode
          )}${
            overnightLow !== null
              ? ` · Low ${overnightLow}°`
              : ""
          }`;
      }

      else {
        overnightText.textContent =
          "Evening · Forecast unavailable";
      }


      afternoonEl.hidden =
        true;

      overnightEl.hidden =
        false;
    }


    // Keep separate major-weather message updated.

    updateMajorWeatherEvent(
      data
    );
  }

  catch (error) {
    console.error(
      "Weather error:",
      error
    );


    tempIcon.hidden =
      true;

    weatherIcon.hidden =
      true;


    tempEl.textContent =
      "";

    conditionEl.textContent =
      "Weather unavailable";

    rangeEl.textContent =
      "";


    const currentHour =
      new Date().getHours();


    if (currentHour < 18) {
      afternoonEl.textContent =
        "Afternoon · Forecast unavailable";

      afternoonEl.hidden =
        false;

      overnightEl.hidden =
        true;
    }

    else {
      overnightText.textContent =
        "Evening · Forecast unavailable";

      afternoonEl.hidden =
        true;

      overnightEl.hidden =
        false;
    }
  }
}


// ============================================================
// WEATHER ALERTS
// ============================================================

function alertPriority(eventName) {
  if (
    eventName.includes(
      "Warning"
    )
  ) {
    return 3;
  }

  if (
    eventName.includes(
      "Watch"
    )
  ) {
    return 2;
  }

  if (
    eventName.includes(
      "Advisory"
    )
  ) {
    return 1;
  }

  return 0;
}


function getAlertIcon(eventName) {
  if (
    eventName.includes(
      "Warning"
    )
  ) {
    return "./icons/alert-warning.png";
  }

  if (
    eventName.includes(
      "Watch"
    )
  ) {
    return "./icons/alert-watch.png";
  }

  if (
    eventName.includes(
      "Advisory"
    )
  ) {
    return "./icons/alert-watch.png";
  }

  return "./icons/alert-watch.png";
}


async function updateWeatherAlerts() {
  const container =
    document.getElementById(
      "weather-alerts"
    );


  /*
    Always keep the alert section visible.
  */
  container.hidden =
    false;


  try {
    const response =
      await fetch(
        `https://api.weather.gov/alerts/active?point=${WEATHER.latitude},${WEATHER.longitude}`
      );


    if (!response.ok) {
      throw new Error(
        `NWS returned ${response.status}`
      );
    }


    const data =
      await response.json();


    const alerts =
      (data.features || [])

        .map(
          feature =>
            feature.properties
        )

        .filter(Boolean)

        .sort(
          (a, b) =>
            alertPriority(
              b.event || ""
            ) -
            alertPriority(
              a.event || ""
            )
        );


    if (!alerts.length) {
      container.innerHTML = `
        <div class="no-weather-alerts">
          No watches, warnings, or advisories.
        </div>
      `;

      return;
    }


    container.innerHTML =
      alerts

        .slice(0, 3)

        .map(
          alert => {
            const event =
              alert.event ||
              "Weather alert";

            const end =
              alert.ends ||
              alert.expires;

            const endText =
              end
                ? ` · until ${formatWeatherTime(end)}`
                : "";

            return `
              <div class="weather-alert-line">

                <img
                  class="weather-alert-icon"
                  src="${getAlertIcon(event)}"
                  alt=""
                >

                <span>
                  ${event}${endText}
                </span>

              </div>
            `;
          }
        )

        .join("");
  }

  catch (error) {
    console.error(
      "Weather alert error:",
      error
    );

    container.innerHTML = `
      <div class="no-weather-alerts">
        Unable to check weather alerts.
      </div>
    `;
  }
}


// ============================================================
// START WEATHER
// ============================================================

updateWeather();

updateWeatherAlerts();


setInterval(
  updateWeather,
  30 * 60 * 1000
);


setInterval(
  updateWeatherAlerts,
  15 * 60 * 1000
);


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


async function sha256(value) {
  return crypto.subtle.digest(
    "SHA-256",
    new TextEncoder()
      .encode(value)
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
// SPOTIFY STATUS
// ============================================================

function setSpotifyStatus(message) {
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


  sessionStorage.setItem(
    "spotify_verifier",
    verifier
  );

  sessionStorage.setItem(
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


  window.location.href =
    `https://accounts.spotify.com/authorize?${params}`;
}


// ============================================================
// SPOTIFY TOKEN STORAGE
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
      SPOTIFY_REDIRECT_URI
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
    sessionStorage.getItem(
      "spotify_state"
    );


  const verifier =
    sessionStorage.getItem(
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


  sessionStorage.removeItem(
    "spotify_state"
  );

  sessionStorage.removeItem(
    "spotify_verifier"
  );


  history.replaceState(
    {},
    document.title,
    SPOTIFY_REDIRECT_URI
  );


  startSpotify();
}


// ============================================================
// SPOTIFY SDK
// ============================================================

function loadSpotifySDK() {
  if (window.Spotify) {
    createSpotifyPlayer();

    return;
  }


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


  window.onSpotifyWebPlaybackSDKReady =
    createSpotifyPlayer;
}


// ============================================================
// SPOTIFY PLAYER
// ============================================================

async function createSpotifyPlayer() {
  if (
    spotifyPlayer ||
    !window.Spotify
  ) {
    return;
  }


  const token =
    await getValidSpotifyToken();


  if (!token) {
    setSpotifyStatus(
      "Connect Spotify to load your playlists"
    );

    return;
  }


  spotifyPlayer =
    new Spotify.Player({
      name:
        "SamOS Hub",

      getOAuthToken:
        async callback => {
          const freshToken =
            await getValidSpotifyToken();

          callback(
            freshToken || ""
          );
        },

      volume:
        0.75
    });


  spotifyPlayer.addListener(
    "ready",

    async (
      { device_id }
    ) => {
      spotifyDeviceId =
        device_id;


      setSpotifyStatus(
        "SamOS Hub connected"
      );


      document.getElementById(
        "spotify-login"
      ).hidden =
        true;


      await transferPlaybackToSamOS();

      await loadPlaylists();
    }
  );


  spotifyPlayer.addListener(
    "not_ready",

    () => {
      setSpotifyStatus(
        "Spotify disconnected"
      );
    }
  );


  spotifyPlayer.addListener(
    "authentication_error",

    ({ message }) => {
      console.error(
        "Spotify authentication error:",
        message
      );


      setSpotifyStatus(
        "Reconnect Spotify"
      );


      document.getElementById(
        "spotify-login"
      ).hidden =
        false;
    }
  );


  spotifyPlayer.addListener(
    "account_error",

    ({ message }) => {
      console.error(
        "Spotify account error:",
        message
      );


      setSpotifyStatus(
        "Spotify Premium is required"
      );
    }
  );


  spotifyPlayer.addListener(
    "playback_error",

    ({ message }) => {
      console.error(
        "Spotify playback error:",
        message
      );


      setSpotifyStatus(
        "Spotify playback error"
      );
    }
  );


  spotifyPlayer.addListener(
    "player_state_changed",

    state => {
      if (!state) {
        return;
      }


      const track =
        state.track_window
          ?.current_track;


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
          ?.images
          ?.[0]
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
        state.paused
          ? "./icons/player-play.png"
          : "./icons/player-pause.png";
    }
  );


  const connected =
    await spotifyPlayer.connect();


  if (!connected) {
    setSpotifyStatus(
      "Spotify player could not connect"
    );

    console.error(
      "Spotify Web Playback SDK connect() returned false"
    );
  }
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


  setSpotifyStatus(
    "Connecting to Spotify..."
  );


  loadSpotifySDK();
}


// ============================================================
// TRANSFER PLAYBACK
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
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            device_ids: [
              spotifyDeviceId
            ],

            play: false
          })
      }
    );


  if (
    !response.ok &&
    response.status !== 204
  ) {
    console.error(
      "Spotify playback transfer failed:",
      response.status
    );
  }
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
  if (!spotifyDeviceId) {
    setSpotifyStatus(
      "Spotify player is not ready yet"
    );

    return;
  }


  const token =
    await getValidSpotifyToken();


  if (!token) {
    setSpotifyStatus(
      "Reconnect Spotify"
    );

    return;
  }


  await transferPlaybackToSamOS();


  await fetch(
    `https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${encodeURIComponent(spotifyDeviceId)}`,
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
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`,
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


    setSpotifyStatus(
      `Could not start playlist (${response.status})`
    );

    return;
  }


  setSpotifyStatus(
    "Shuffle on"
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
      if (!spotifyPlayer) {
        return;
      }


      const state =
        await spotifyPlayer
          .getCurrentState();


      if (!state) {
        if (
          selectedPlaylistUri
        ) {
          await startPlaylist(
            selectedPlaylistUri
          );
        }

        return;
      }


      if (state.paused) {
        await spotifyPlayer
          .resume();
      }

      else {
        await spotifyPlayer
          .pause();
      }
    }
  );


document
  .getElementById(
    "next-track"
  )
  .addEventListener(
    "click",

    async () => {
      if (spotifyPlayer) {
        await spotifyPlayer
          .nextTrack();
      }
    }
  );


document
  .getElementById(
    "previous-track"
  )
  .addEventListener(
    "click",

    async () => {
      if (spotifyPlayer) {
        await spotifyPlayer
          .previousTrack();
      }
    }
  );


// ============================================================
// START SPOTIFY
// ============================================================

handleSpotifyRedirect();


// ============================================================
// SERVICE WORKER
//
// Disable caching locally so Live Server always shows the
// actual files you just saved.
// ============================================================

const isLocalDevelopment =
  window.location.hostname ===
    "127.0.0.1" ||
  window.location.hostname ===
    "localhost";


if (
  "serviceWorker"
  in navigator
) {
  if (isLocalDevelopment) {
    navigator.serviceWorker
      .getRegistrations()

      .then(
        registrations => {
          registrations.forEach(
            registration => {
              registration.unregister();
            }
          );
        }
      );


    if (
      "caches"
      in window
    ) {
      caches
        .keys()

        .then(
          cacheNames => {
            cacheNames.forEach(
              cacheName => {
                caches.delete(
                  cacheName
                );
              }
            );
          }
        );
    }
  }

  else {
    navigator.serviceWorker
      .register(
        "./service-worker.js"
      )

      .catch(
        error => {
          console.error(
            "Service worker registration failed:",
            error
          );
        }
      );
  }
}