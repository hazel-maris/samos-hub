// ============================================================
// SamOS Hub — Home Upcoming
// ============================================================

const homeUpcomingList =
  document.getElementById("home-upcoming-list");


// ============================================================
// DATE HELPERS
// ============================================================

function homeDateToISO(date) {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  );
}


function homeISOToDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0
  );
}


function homeAddDays(date, amount) {
  const copy =
    new Date(date);

  copy.setDate(
    copy.getDate() + amount
  );

  return copy;
}


function homeDaysBetween(start, end) {
  const startUTC =
    Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

  const endUTC =
    Date.UTC(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );

  return Math.round(
    (endUTC - startUTC) /
    86400000
  );
}


// ============================================================
// SETTINGS
// ============================================================

function homeShouldShowItem(item) {
  if (
    item.type !== "task" ||
    !item.recurrence
  ) {
    return true;
  }


  const settingMap = {
    daily:
      "showDailyTasks",

    weekly:
      "showWeeklyTasks",

    monthly:
      "showMonthlyTasks",

    yearly:
      "showYearlyTasks"
  };


  const settingKey =
    settingMap[
      item.recurrence
    ];


  if (!settingKey) {
    return true;
  }


  return getSetting(
    settingKey
  );
}


// ============================================================
// RECURRENCE
// ============================================================

function homeOccursOnDate(
  item,
  candidate
) {
  const start =
    homeISOToDate(
      item.date
    );


  if (!start) {
    return false;
  }


  const candidateISO =
    homeDateToISO(
      candidate
    );


  if (
    candidate <
    start
  ) {
    return false;
  }


  if (!item.recurrence) {
    return (
      candidateISO ===
      item.date
    );
  }


  if (
    item.recurrence ===
    "daily"
  ) {
    return true;
  }


  if (
    item.recurrence ===
    "weekly"
  ) {
    return (
      homeDaysBetween(
        start,
        candidate
      ) % 7 === 0
    );
  }


  if (
    item.recurrence ===
    "monthly"
  ) {
    return (
      candidate.getDate() ===
      start.getDate()
    );
  }


  if (
    item.recurrence ===
    "yearly"
  ) {
    return (
      candidate.getMonth() ===
        start.getMonth() &&
      candidate.getDate() ===
        start.getDate()
    );
  }


  return false;
}


// ============================================================
// TIME HELPERS
// ============================================================

function homeOccurrenceHasPassed(
  item,
  occurrenceDate,
  now
) {
  const today =
    homeDateToISO(
      now
    );


  if (
    occurrenceDate <
    today
  ) {
    return true;
  }


  if (
    occurrenceDate !== today ||
    !item.time
  ) {
    return false;
  }


  const [
    hour,
    minute
  ] =
    item.time
      .split(":")
      .map(Number);


  const itemTime =
    new Date(now);


  itemTime.setHours(
    hour,
    minute,
    0,
    0
  );


  return (
    itemTime <
    now
  );
}


// ============================================================
// GENERATE THIS WEEK
// ============================================================

function buildHomeOccurrences(
  items,
  startDate,
  endDate,
  now
) {
  const occurrences =
    [];


  items.forEach(
    item => {
      if (
        !homeShouldShowItem(
          item
        )
      ) {
        return;
      }


      let cursor =
        new Date(
          startDate
        );


      while (
        cursor <= endDate
      ) {
        if (
          homeOccursOnDate(
            item,
            cursor
          )
        ) {
          const occurrenceDate =
            homeDateToISO(
              cursor
            );


          if (
            !homeOccurrenceHasPassed(
              item,
              occurrenceDate,
              now
            )
          ) {
            occurrences.push({
              ...item,

              occurrenceDate
            });
          }
        }


        cursor =
          homeAddDays(
            cursor,
            1
          );
      }
    }
  );


  occurrences.sort(
    (a, b) => {
      const dateCompare =
        a.occurrenceDate.localeCompare(
          b.occurrenceDate
        );


      if (dateCompare !== 0) {
        return dateCompare;
      }


      return (
        (a.time || "")
          .localeCompare(
            b.time || ""
          )
      );
    }
  );


  return occurrences;
}


// ============================================================
// DISPLAY HELPERS
// ============================================================

function formatHomeUpcomingDate(
  dateString
) {
  const date =
    homeISOToDate(
      dateString
    );


  return date.toLocaleDateString(
    [],
    {
      month: "short",
      day: "numeric"
    }
  );
}


function formatHomeUpcomingTime(
  timeString
) {
  if (!timeString) {
    return "";
  }


  const [
    hour,
    minute
  ] =
    timeString
      .split(":")
      .map(Number);


  const date =
    new Date();


  date.setHours(
    hour,
    minute,
    0,
    0
  );


  return date.toLocaleTimeString(
    [],
    {
      hour: "numeric",
      minute: "2-digit"
    }
  );
}


function escapeHomeUpcomingHtml(
  value
) {
  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );
}


// ============================================================
// RENDER
// ============================================================

function renderHomeUpcoming(
  items
) {
  if (!items.length) {
    homeUpcomingList.innerHTML = `
      <div class="home-upcoming-empty">
        Nothing coming up this week.
      </div>
    `;

    return;
  }


  homeUpcomingList.innerHTML =
    items
      .slice(
        0,
        4
      )
      .map(
        item => {
          const date =
            formatHomeUpcomingDate(
              item.occurrenceDate
            );


          const time =
            item.time
              ? formatHomeUpcomingTime(
                  item.time
                )
              : "";


          return `
            <div class="home-upcoming-item">

              <span class="home-upcoming-date">
                ${date}
              </span>

              ${
                time
                  ? `
                    <span class="home-upcoming-separator">
                      ·
                    </span>

                    <span class="home-upcoming-time">
                      ${time}
                    </span>
                  `
                  : ""
              }

              <span class="home-upcoming-separator">
                ·
              </span>

              <span class="home-upcoming-title">
                ${escapeHomeUpcomingHtml(
                  item.title
                )}
              </span>

            </div>
          `;
        }
      )
      .join("");
}


// ============================================================
// LOAD
// ============================================================

async function loadHomeUpcoming() {
  if (!homeUpcomingList) {
    return;
  }


  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth
      .getSession();


  if (!session?.user) {
    homeUpcomingList.textContent =
      "Sign in from Settings to view upcoming items.";

    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "upcoming_items"
      )
      .select("*");


  if (error) {
    console.error(
      "Could not load Home upcoming items:",
      error
    );

    homeUpcomingList.textContent =
      "Could not load upcoming items.";

    return;
  }


  const now =
    new Date();


  const startDate =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12
    );


  const endDate =
    homeAddDays(
      startDate,
      6
    );


  const occurrences =
    buildHomeOccurrences(
      data || [],
      startDate,
      endDate,
      now
    );


  renderHomeUpcoming(
    occurrences
  );
}


// ============================================================
// START
// ============================================================

loadHomeUpcoming();