function updateClock() {
  const now = new Date();

  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  const date = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  document.getElementById("time").textContent = time;
  document.getElementById("date").textContent = date;
}

async function updateWeather() {
  try {
    const latitude = 39.92;
    const longitude = -75.07;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=fahrenheit` +
      `&timezone=America%2FNew_York`;

    const response = await fetch(url);
    const data = await response.json();

    const currentTemp = Math.round(data.current.temperature_2m);
    const high = Math.round(data.daily.temperature_2m_max[0]);
    const low = Math.round(data.daily.temperature_2m_min[0]);

    const weatherText = getWeatherDescription(data.current.weather_code);

    document.getElementById("weather-current").textContent =
      `${currentTemp}° · ${weatherText}`;

    document.getElementById("weather-range").textContent =
      `High ${high}° · Low ${low}°`;
  } catch (error) {
    console.error(error);

    document.getElementById("weather-current").textContent =
      "Weather unavailable";
  }
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

updateClock();
setInterval(updateClock, 1000);

updateWeather();
setInterval(updateWeather, 30 * 60 * 1000);