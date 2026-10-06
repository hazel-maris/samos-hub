// ============================================================
// SamOS Hub — Home Page
// ============================================================


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


  const parts =
    time.split(" ");


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