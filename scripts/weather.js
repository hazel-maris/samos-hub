// ============================================================
// SamOS Hub — Weather
// ============================================================


const WEATHER =
  CONFIG.weather || {
    latitude: 39.92,
    longitude: -75.07,
    timezone: "America/New_York"
  };


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


function getTemperatureIcon(
  temperature
) {
  if (temperature <= 45) {
    return "./icons/temp-cold.png";
  }


  if (temperature <= 75) {
    return "./icons/temp-mild.png";
  }


  return "./icons/temp-hot.png";
}


function formatWeatherTime(
  iso
) {
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


function firstWeatherImpact(
  hours
) {
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


// ============================================================
// MAJOR UPCOMING WEATHER
// ============================================================

function formatForecastDay(
  dateString
) {
  const date =
    new Date(
      `${dateString}T12:00:00`
    );


  return date.toLocaleDateString([], {
    weekday: "long"
  });
}


function getMajorWeatherEvent(
  data
) {
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


function updateMajorWeatherEvent(
  data
) {
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
      "No forecasted events or storms.";


    text.classList.add(
      "no-weather-events"
    );


    container.hidden = false;


    return;
  }


  icon.src =
    "./icons/weather-major-event.png";


  icon.hidden = false;


  text.classList.remove(
    "no-weather-events"
  );


  text.textContent =
    event;


  container.hidden = false;
}


// ============================================================
// CURRENT + UPCOMING WEATHER
// ============================================================

let weatherRetryTimer = null;
let weatherRetryCount = 0;
let weatherRequestInFlight = null;

function updateWeather() {
  if (weatherRequestInFlight) {
    return weatherRequestInFlight;
  }

  weatherRequestInFlight =
    renderWeather().finally(() => {
      weatherRequestInFlight = null;
    });

  return weatherRequestInFlight;
}

async function renderWeather() {
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


  const afternoonText =
    document.getElementById(
      "weather-afternoon-text"
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
        `https://api.open-meteo.com/v1/forecast?${params}`,
        { signal: AbortSignal.timeout(15000) }
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
      getTemperatureIcon(
        temp
      );


    tempIcon.hidden =
      false;


    weatherIcon.src =
      getWeatherIcon(
        weatherCode
      );


    weatherIcon.hidden =
      false;


    rangeEl.textContent =
      `High ${high}° / Low ${low}°`;


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


    document.getElementById(
      "sun-times"
    ).hidden =
      !getSetting(
        "showSunTimes"
      );


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


    const currentHour =
      new Date().getHours();


    const afternoonImpact =
      firstWeatherImpact(
        afternoonHours
      );


    const overnightImpact =
      firstWeatherImpact(
        overnightHours
      );


    // --------------------------------------------------------
    // LATER TODAY WEATHER IMPACT
    // --------------------------------------------------------

    if (
      currentHour < 18 &&
      afternoonImpact
    ) {
      afternoonText.textContent =
        `Later today · ${afternoonImpact.text} after ${formatWeatherTime(
          afternoonImpact.time
        )}`;


      afternoonEl.hidden =
        false;
    }

    else {
      afternoonEl.hidden =
        true;
    }

    // --------------------------------------------------------
    // OVERNIGHT WEATHER IMPACT
    // --------------------------------------------------------

    if (overnightImpact) {
      overnightText.textContent =
        `Overnight · ${overnightImpact.text} after ${formatWeatherTime(
          overnightImpact.time
        )}`;


      overnightEl.hidden =
        false;
    }

    else {
      overnightEl.hidden =
        true;
    }


    updateMajorWeatherEvent(
      data
    );

    clearTimeout(weatherRetryTimer);
    weatherRetryCount = 0;
  }


  catch (error) {
    console.error(
      "Weather error:",
      error
    );

    clearTimeout(weatherRetryTimer);

    if (weatherRetryCount < 3) {
      weatherRetryCount++;

      weatherRetryTimer = setTimeout(
        updateWeather,
        weatherRetryCount * 5000
      );
    }

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


    afternoonEl.hidden =
      true;


    overnightEl.hidden =
      true;
  }
}


// ============================================================
// WEATHER ALERTS
// ============================================================

function alertPriority(
  eventName
) {
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


function getAlertIcon(
  eventName
) {
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

function refreshHomeWeather() {
  updateWeather();
  updateWeatherAlerts();
}

// Start immediately instead of waiting for Spotify's SDK.
refreshHomeWeather();

window.addEventListener(
  "online",
  refreshHomeWeather
);

window.addEventListener(
  "focus",
  refreshHomeWeather
);

window.addEventListener(
  "samos-spotify-connected",
  refreshHomeWeather
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (!document.hidden) {
      refreshHomeWeather();
    }
  }
);


setInterval(
  updateWeather,
  30 * 60 * 1000
);


setInterval(
  updateWeatherAlerts,
  15 * 60 * 1000
);