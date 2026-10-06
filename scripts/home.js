// ============================================================
// SamOS Hub — Home Page
// ============================================================


// ============================================================
// CLOCK
// ============================================================

function updateClock() {
  const now =
    new Date();


  const time =
    now.toLocaleTimeString(
      [],
      {
        hour: "numeric",
        minute: "2-digit"
      }
    );


  const parts =
    time.split(" ");


  const timeNumbers =
    document.getElementById(
      "time-numbers"
    );


  const timePeriod =
    document.getElementById(
      "time-period"
    );


  const date =
    document.getElementById(
      "date"
    );


  if (timeNumbers) {
    timeNumbers.textContent =
      parts[0];
  }


  if (timePeriod) {
    timePeriod.textContent =
      parts[1] || "";
  }


  if (date) {
    date.textContent =
      now.toLocaleDateString(
        [],
        {
          weekday: "long",
          month: "long",
          day: "numeric"
        }
      );
  }
}


updateClock();


setInterval(
  updateClock,
  1000
);


// ============================================================
// QUOTE
// ============================================================

const quote =
  document.getElementById(
    "quote"
  );


if (quote) {
  quote.textContent =
    CONFIG.quote ||
    "Build for Future Sam.";
}