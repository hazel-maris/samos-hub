// ============================================================
// SamOS Hub — Upcoming
// ============================================================


// ============================================================
// DOM — ADD FORM
// ============================================================

const upcomingList =
  document.getElementById(
    "upcoming-list"
  );

const upcomingTitle =
  document.getElementById(
    "upcoming-title"
  );

const upcomingDate =
  document.getElementById(
    "upcoming-date"
  );

const upcomingTime =
  document.getElementById(
    "upcoming-time"
  );

const upcomingType =
  document.getElementById(
    "upcoming-type"
  );

const upcomingRecurrence =
  document.getElementById(
    "upcoming-recurrence"
  );

const upcomingAddButton =
  document.getElementById(
    "upcoming-add"
  );

const upcomingFormStatus =
  document.getElementById(
    "upcoming-form-status"
  );


// ============================================================
// STATE
// ============================================================

let upcomingItems = [];

let editingItemId =
  null;


// ============================================================
// DELETE MODAL
// ============================================================

const deleteConfirmOverlay =
  document.getElementById(
    "delete-confirm-overlay"
  );

const deleteConfirmName =
  document.getElementById(
    "delete-confirm-name"
  );

const deleteCancelButton =
  document.getElementById(
    "delete-cancel"
  );

const deleteConfirmButton =
  document.getElementById(
    "delete-confirm"
  );

let pendingDeleteId =
  null;


// ============================================================
// CALENDAR
// ============================================================

const calendarOverlay =
  document.getElementById(
    "calendar-overlay"
  );

const calendarHeading =
  document.getElementById(
    "calendar-heading"
  );

const calendarMonth =
  document.getElementById(
    "calendar-month"
  );

const calendarYear =
  document.getElementById(
    "calendar-year"
  );

const calendarGrid =
  document.getElementById(
    "calendar-grid"
  );

const calendarPrev =
  document.getElementById(
    "calendar-prev"
  );

const calendarNext =
  document.getElementById(
    "calendar-next"
  );

const calendarToday =
  document.getElementById(
    "calendar-today"
  );

const calendarCancel =
  document.getElementById(
    "calendar-cancel"
  );

let activeDateInput =
  null;

let calendarViewDate =
  new Date();


// ============================================================
// TIME PICKER
// ============================================================

const timeOverlay =
  document.getElementById(
    "time-overlay"
  );

const timeClockFace =
  document.getElementById(
    "time-clock-face"
  );

const timeModeHour =
  document.getElementById(
    "time-mode-hour"
  );

const timeModeMinute =
  document.getElementById(
    "time-mode-minute"
  );

const timeMinuteAdjust =
  document.getElementById(
    "time-minute-adjust"
  );

const timeMinuteMinus =
  document.getElementById(
    "time-minute-minus"
  );

const timeMinutePlus =
  document.getElementById(
    "time-minute-plus"
  );

const timeExactMinute =
  document.getElementById(
    "time-exact-minute"
  );

const timeAm =
  document.getElementById(
    "time-am"
  );

const timePm =
  document.getElementById(
    "time-pm"
  );

const timePreview =
  document.getElementById(
    "time-preview"
  );

const timeCancel =
  document.getElementById(
    "time-cancel"
  );

const timeDone =
  document.getElementById(
    "time-done"
  );

let activeTimeInput =
  null;

let timePickerMode =
  "hour";

let selectedHour =
  null;

let selectedMinute =
  0;

let selectedPeriod =
  "PM";

let minuteHasBeenSelected =
  false;


// ============================================================
// GENERIC DATE HELPERS
// ============================================================

function isoToDate(
  value
) {
  if (!value) {
    return null;
  }


  const [
    year,
    month,
    day
  ] =
    value
      .split("-")
      .map(Number);


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


function dateToISO(
  date
) {
  return (
    `${date.getFullYear()}-` +
    `${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-` +
    `${String(
      date.getDate()
    ).padStart(2, "0")}`
  );
}


function addDays(
  date,
  amount
) {
  const copy =
    new Date(date);


  copy.setDate(
    copy.getDate() + amount
  );


  return copy;
}


function daysBetween(
  start,
  end
) {
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
// RECURRENCE SETTINGS
// ============================================================

function shouldShowUpcomingItem(
  item
) {
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
// RECURRENCE ENGINE
// ============================================================

function itemOccursOnDate(
  item,
  candidate
) {
  const start =
    isoToDate(
      item.date
    );


  if (!start) {
    return false;
  }


  if (
    candidate <
    start
  ) {
    return false;
  }


  const candidateISO =
    dateToISO(
      candidate
    );


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
      daysBetween(
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
// EXPIRED OCCURRENCES
// ============================================================

function occurrenceHasPassed(
  item,
  occurrenceDate,
  now
) {
  const today =
    dateToISO(
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


  const occurrenceTime =
    new Date(now);


  occurrenceTime.setHours(
    hour,
    minute,
    0,
    0
  );


  return (
    occurrenceTime <
    now
  );
}


// ============================================================
// NEXT OCCURRENCE
// ============================================================

function getNextOccurrence(
  item,
  now
) {
  if (
    !shouldShowUpcomingItem(
      item
    )
  ) {
    return null;
  }


  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12
    );


  const end =
    addDays(
      today,
      366
    );


  let cursor =
    new Date(today);


  while (
    cursor <= end
  ) {
    if (
      itemOccursOnDate(
        item,
        cursor
      )
    ) {
      const occurrenceDate =
        dateToISO(
          cursor
        );


      if (
        !occurrenceHasPassed(
          item,
          occurrenceDate,
          now
        )
      ) {
        return {
          ...item,

          occurrenceDate
        };
      }
    }


    cursor =
      addDays(
        cursor,
        1
      );
  }


  return null;
}


// ============================================================
// BUILD DISPLAY LIST
// ============================================================

function buildUpcomingDisplayItems(
  items
) {
  const now =
    new Date();


  const result =
    items
      .map(
        item =>
          getNextOccurrence(
            item,
            now
          )
      )
      .filter(Boolean);


  result.sort(
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


  return result;
}


// ============================================================
// LOAD UPCOMING ITEMS
// ============================================================

async function loadUpcomingItems() {
  upcomingList.textContent =
    "Loading...";


  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth
      .getSession();


  if (!session?.user) {
    upcomingList.textContent =
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
      .select("*")
      .order(
        "date",
        {
          ascending: true
        }
      );


  if (error) {
    console.error(
      "Could not load upcoming items:",
      error
    );

    upcomingList.textContent =
      "Could not load upcoming items.";

    return;
  }


  upcomingItems =
    data || [];


  renderUpcomingItems(
    buildUpcomingDisplayItems(
      upcomingItems
    )
  );
}


// ============================================================
// GROUP UPCOMING
// ============================================================

function groupUpcomingItems(
  items
) {
  const today =
    new Date();


  const todayISO =
    dateToISO(
      today
    );


  const weekEndISO =
    dateToISO(
      addDays(
        today,
        6
      )
    );


  return {
    today:
      items.filter(
        item =>
          item.occurrenceDate ===
          todayISO
      ),

    week:
      items.filter(
        item =>
          item.occurrenceDate >
            todayISO &&
          item.occurrenceDate <=
            weekEndISO
      ),

    later:
      items.filter(
        item =>
          item.occurrenceDate >
          weekEndISO
      )
  };
}


// ============================================================
// RENDER UPCOMING ITEMS
// ============================================================

function renderUpcomingItems(
  items
) {
  if (!items.length) {
    upcomingList.innerHTML = `
      <div class="upcoming-empty">
        No upcoming items yet.
      </div>
    `;

    return;
  }


  const groups =
    groupUpcomingItems(
      items
    );


  upcomingList.innerHTML =
    [
      renderUpcomingSection(
        "TODAY",
        groups.today
      ),

      renderUpcomingSection(
        "THIS WEEK",
        groups.week
      ),

      renderUpcomingSection(
        "LATER",
        groups.later
      )
    ]
      .filter(Boolean)
      .join("");
}


// ============================================================
// RENDER SECTION
// ============================================================

function renderUpcomingSection(
  title,
  items
) {
  if (!items.length) {
    return "";
  }


  return `
    <section class="upcoming-list-section">

      <div class="upcoming-section-title">
        ${title}
      </div>

      <div class="upcoming-section-items">

        ${
          items
            .map(
              item => {
                if (
                  item.id ===
                  editingItemId
                ) {
                  return renderEditableItem(
                    item
                  );
                }


                return renderDisplayItem(
                  item
                );
              }
            )
            .join("")
        }

      </div>

    </section>
  `;
}


// ============================================================
// DISPLAY ITEM
// ============================================================

function renderDisplayItem(
  item
) {
  const date =
    formatUpcomingDate(
      item.occurrenceDate
    );


  const time =
    item.time
      ? formatUpcomingTime(
          item.time
        )
      : "";


  const recurrence =
    item.recurrence
      ? `
        <span class="upcoming-recurrence">
          ${capitalize(
            item.recurrence
          )}
        </span>
      `
      : "";


  return `
    <div
      class="upcoming-item"
      data-id="${item.id}"
    >

      <div class="upcoming-item-date">
        ${date}
      </div>


      <div class="upcoming-item-main">

        <div class="upcoming-item-title">
          ${escapeHtml(
            item.title
          )}
        </div>


        <div class="upcoming-item-meta">

          ${
            time
              ? `<span>${time}</span>`
              : ""
          }

          ${
            item.type
              ? `
                <span>
                  ${capitalize(
                    item.type
                  )}
                </span>
              `
              : ""
          }

          ${recurrence}

        </div>

      </div>


      <div class="upcoming-item-actions">

        <button
          class="upcoming-icon-button"
          type="button"
          data-action="edit"
          data-id="${item.id}"
          aria-label="Edit item"
          title="Edit"
        >
          <img
            src="../icons/edit-pencil.png"
            alt=""
          >
        </button>


        <button
          class="upcoming-icon-button"
          type="button"
          data-action="delete"
          data-id="${item.id}"
          aria-label="Delete item"
          title="Delete"
        >
          <img
            src="../icons/delete-trash.png"
            alt=""
          >
        </button>

      </div>

    </div>
  `;
}


// ============================================================
// EDITABLE ITEM
// ============================================================

function renderEditableItem(
  item
) {
  return `
    <div
      class="upcoming-item upcoming-item-editing"
      data-id="${item.id}"
    >

      <div class="upcoming-edit-fields">

        <input
          class="upcoming-edit-title"
          type="text"
          value="${escapeHtmlAttribute(
            item.title
          )}"
          aria-label="Title"
        >


        <div class="date-input-wrap">

          <input
            class="upcoming-edit-date"
            type="text"
            inputmode="numeric"
            maxlength="10"
            placeholder="MM/DD/YYYY"
            value="${escapeHtmlAttribute(
              isoToDateInput(
                item.date
              )
            )}"
            aria-label="Date"
          >

          <button
            class="date-picker-button"
            type="button"
            aria-label="Open calendar"
            title="Open calendar"
          >
            ▦
          </button>

        </div>


        <div class="time-input-wrap">

          <input
            class="upcoming-edit-time"
            type="text"
            placeholder="3:30 PM"
            value="${escapeHtmlAttribute(
              databaseTimeToInput(
                item.time
              )
            )}"
            aria-label="Time"
            autocomplete="off"
          >

          <button
            class="time-picker-button"
            type="button"
            aria-label="Open time picker"
            title="Open time picker"
          >
            ◷
          </button>

        </div>


        <select
          class="upcoming-edit-type"
          aria-label="Type"
        >

          <option
            value="task"
            ${
              item.type === "task"
                ? "selected"
                : ""
            }
          >
            Task
          </option>

          <option
            value="event"
            ${
              item.type === "event"
                ? "selected"
                : ""
            }
          >
            Event
          </option>

          <option
            value="appointment"
            ${
              item.type === "appointment"
                ? "selected"
                : ""
            }
          >
            Appointment
          </option>

        </select>


        <select
          class="upcoming-edit-recurrence"
          aria-label="Repeats"
        >

          <option
            value=""
            ${
              !item.recurrence
                ? "selected"
                : ""
            }
          >
            Does not repeat
          </option>

          <option
            value="daily"
            ${
              item.recurrence === "daily"
                ? "selected"
                : ""
            }
          >
            Daily
          </option>

          <option
            value="weekly"
            ${
              item.recurrence === "weekly"
                ? "selected"
                : ""
            }
          >
            Weekly
          </option>

          <option
            value="monthly"
            ${
              item.recurrence === "monthly"
                ? "selected"
                : ""
            }
          >
            Monthly
          </option>

          <option
            value="yearly"
            ${
              item.recurrence === "yearly"
                ? "selected"
                : ""
            }
          >
            Yearly
          </option>

        </select>

      </div>


      <div class="upcoming-item-actions">

        <button
          class="upcoming-icon-button"
          type="button"
          data-action="save"
          data-id="${item.id}"
          aria-label="Save item"
          title="Save"
        >
          <img
            src="../icons/save-floppy.png"
            alt=""
          >
        </button>


        <button
          class="upcoming-icon-button"
          type="button"
          data-action="delete"
          data-id="${item.id}"
          aria-label="Delete item"
          title="Delete"
        >
          <img
            src="../icons/delete-trash.png"
            alt=""
          >
        </button>

      </div>

    </div>
  `;
}


// ============================================================
// EDIT
// ============================================================

function editUpcomingItem(
  itemId
) {
  editingItemId =
    itemId;


  renderUpcomingItems(
    buildUpcomingDisplayItems(
      upcomingItems
    )
  );
}


// ============================================================
// SAVE
// ============================================================

async function saveUpcomingItem(
  itemId
) {
  const itemElement =
    upcomingList.querySelector(
      `.upcoming-item[data-id="${itemId}"]`
    );


  if (!itemElement) {
    return;
  }


  const title =
    itemElement
      .querySelector(
        ".upcoming-edit-title"
      )
      .value
      .trim();


  const editDateInput =
    itemElement.querySelector(
      ".upcoming-edit-date"
    );


  const date =
    dateInputToISO(
      editDateInput.value
    );


  const editTimeInput =
    itemElement.querySelector(
      ".upcoming-edit-time"
    );


  const time =
    editTimeInput.value.trim()
      ? timeInputToDatabase(
          editTimeInput.value
        )
      : null;


  const type =
    itemElement
      .querySelector(
        ".upcoming-edit-type"
      )
      .value;


  const recurrence =
    itemElement
      .querySelector(
        ".upcoming-edit-recurrence"
      )
      .value ||
    null;


  if (!title) {
    upcomingFormStatus.textContent =
      "Title cannot be empty.";

    return;
  }


  if (!date) {
    upcomingFormStatus.textContent =
      "Enter a valid date: MM/DD/YYYY";

    return;
  }


  if (
    editTimeInput.value.trim() &&
    !time
  ) {
    upcomingFormStatus.textContent =
      "Enter a valid time, like 3:30 PM.";

    return;
  }


  upcomingFormStatus.textContent =
    "Saving...";


  const {
    error
  } =
    await supabaseClient
      .from(
        "upcoming_items"
      )
      .update({
        title,
        date,
        time,
        type,
        recurrence,

        updated_at:
          new Date()
            .toISOString()
      })
      .eq(
        "id",
        itemId
      );


  if (error) {
    console.error(
      "Could not update upcoming item:",
      error
    );

    upcomingFormStatus.textContent =
      "Could not save item.";

    return;
  }


  editingItemId =
    null;


  upcomingFormStatus.textContent =
    "Saved!";


  await loadUpcomingItems();
}


// ============================================================
// DELETE
// ============================================================

function requestDeleteUpcomingItem(
  itemId
) {
  const item =
    upcomingItems.find(
      item =>
        item.id === itemId
    );


  pendingDeleteId =
    itemId;


  deleteConfirmName.textContent =
    item?.title ||
    "This item";


  deleteConfirmOverlay.hidden =
    false;
}


async function confirmDeleteUpcomingItem() {
  if (!pendingDeleteId) {
    return;
  }


  upcomingFormStatus.textContent =
    "Deleting...";


  const {
    error
  } =
    await supabaseClient
      .from(
        "upcoming_items"
      )
      .delete()
      .eq(
        "id",
        pendingDeleteId
      );


  if (error) {
    console.error(
      "Could not delete upcoming item:",
      error
    );

    upcomingFormStatus.textContent =
      "Could not delete item.";

    return;
  }


  editingItemId =
    null;


  pendingDeleteId =
    null;


  deleteConfirmOverlay.hidden =
    true;


  upcomingFormStatus.textContent =
    "Deleted!";


  await loadUpcomingItems();
}


// ============================================================
// ITEM ACTIONS
// ============================================================

upcomingList.addEventListener(
  "click",

  async event => {
    const button =
      event.target.closest(
        "[data-action]"
      );


    if (!button) {
      return;
    }


    const action =
      button.dataset.action;


    const itemId =
      button.dataset.id;


    if (
      action === "edit"
    ) {
      editUpcomingItem(
        itemId
      );

      return;
    }


    if (
      action === "save"
    ) {
      await saveUpcomingItem(
        itemId
      );

      return;
    }


    if (
      action === "delete"
    ) {
      requestDeleteUpcomingItem(
        itemId
      );
    }
  }
);


// ============================================================
// DELETE BUTTONS
// ============================================================

deleteCancelButton.addEventListener(
  "click",

  () => {
    pendingDeleteId =
      null;

    deleteConfirmOverlay.hidden =
      true;
  }
);


deleteConfirmButton.addEventListener(
  "click",
  confirmDeleteUpcomingItem
);


// ============================================================
// DISPLAY HELPERS
// ============================================================

function formatUpcomingDate(
  value
) {
  const date =
    isoToDate(
      value
    );


  if (!date) {
    return "";
  }


  return date.toLocaleDateString(
    [],
    {
      month: "short",
      day: "numeric"
    }
  );
}


function formatUpcomingTime(
  value
) {
  if (!value) {
    return "";
  }


  const [
    hour,
    minute
  ] =
    value
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


function capitalize(
  value
) {
  if (!value) {
    return "";
  }


  return (
    value.charAt(0)
      .toUpperCase() +
    value.slice(1)
  );
}


// ============================================================
// DATE INPUT HELPERS
// ============================================================

function formatDateInput(
  value
) {
  const digits =
    value
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        8
      );


  if (
    digits.length <= 2
  ) {
    return digits;
  }


  if (
    digits.length <= 4
  ) {
    return (
      `${digits.slice(0, 2)}/` +
      digits.slice(2)
    );
  }


  return (
    `${digits.slice(0, 2)}/` +
    `${digits.slice(2, 4)}/` +
    digits.slice(4)
  );
}


function dateInputToISO(
  value
) {
  const match =
    value.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );


  if (!match) {
    return null;
  }


  const month =
    Number(
      match[1]
    );

  const day =
    Number(
      match[2]
    );

  const year =
    Number(
      match[3]
    );


  const date =
    new Date(
      year,
      month - 1,
      day
    );


  if (
    date.getFullYear() !== year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }


  return (
    `${String(year).padStart(4, "0")}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(day).padStart(2, "0")}`
  );
}


function isoToDateInput(
  value
) {
  if (!value) {
    return "";
  }


  const [
    year,
    month,
    day
  ] =
    value.split("-");


  return (
    `${month}/${day}/${year}`
  );
}


function dateInputToDate(
  value
) {
  return isoToDate(
    dateInputToISO(
      value
    )
  );
}


// ============================================================
// DATE INPUT EVENTS
// ============================================================

upcomingDate.addEventListener(
  "input",

  () => {
    upcomingDate.value =
      formatDateInput(
        upcomingDate.value
      );
  }
);


upcomingList.addEventListener(
  "input",

  event => {
    if (
      event.target.matches(
        ".upcoming-edit-date"
      )
    ) {
      event.target.value =
        formatDateInput(
          event.target.value
        );
    }
  }
);


// ============================================================
// TIME INPUT HELPERS
// ============================================================

function parseTimeInput(
  value
) {
  if (!value) {
    return null;
  }


  const cleaned =
    value
      .trim()
      .toUpperCase()
      .replace(
        /\s+/g,
        ""
      );


  let match =
    cleaned.match(
      /^(\d{1,2}):(\d{2})(AM|PM)$/
    );


  if (!match) {
    match =
      cleaned.match(
        /^(\d{1,2})(\d{2})(AM|PM)$/
      );
  }


  if (!match) {
    match =
      cleaned.match(
        /^(\d{1,2})(AM|PM)$/
      );


    if (!match) {
      return null;
    }


    const hour =
      Number(
        match[1]
      );


    if (
      hour < 1 ||
      hour > 12
    ) {
      return null;
    }


    return {
      hour,
      minute: 0,
      period:
        match[2]
    };
  }


  const hour =
    Number(
      match[1]
    );


  const minute =
    Number(
      match[2]
    );


  const period =
    match[3];


  if (
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }


  return {
    hour,
    minute,
    period
  };
}


function convertTo24Hour(
  hour,
  period
) {
  if (
    period === "AM"
  ) {
    return hour === 12
      ? 0
      : hour;
  }


  return hour === 12
    ? 12
    : hour + 12;
}


function timeInputToDatabase(
  value
) {
  const parsed =
    parseTimeInput(
      value
    );


  if (!parsed) {
    return null;
  }


  const hour =
    convertTo24Hour(
      parsed.hour,
      parsed.period
    );


  return (
    `${String(hour).padStart(2, "0")}:` +
    `${String(parsed.minute).padStart(2, "0")}`
  );
}


function databaseTimeToInput(
  value
) {
  if (!value) {
    return "";
  }


  const [
    hourString,
    minuteString
  ] =
    value.split(":");


  const hour24 =
    Number(
      hourString
    );


  const minute =
    Number(
      minuteString
    );


  const period =
    hour24 >= 12
      ? "PM"
      : "AM";


  const hour12 =
    hour24 % 12 ||
    12;


  return (
    `${hour12}:` +
    `${String(minute).padStart(2, "0")} ` +
    period
  );
}


function formatSelectedTime() {
  if (!selectedHour) {
    return "--:--";
  }


  return (
    `${selectedHour}:` +
    `${String(selectedMinute).padStart(2, "0")} ` +
    selectedPeriod
  );
}


// ============================================================
// CUSTOM TIME PICKER
// ============================================================

function openTimePicker(
  input
) {
  activeTimeInput =
    input;


  input.blur();


  const parsed =
    parseTimeInput(
      input.value
    );


  if (parsed) {
    selectedHour =
      parsed.hour;

    selectedMinute =
      parsed.minute;

    selectedPeriod =
      parsed.period;

    minuteHasBeenSelected =
      true;
  }

  else {
    selectedHour =
      null;

    selectedMinute =
      0;

    selectedPeriod =
      "PM";

    minuteHasBeenSelected =
      false;
  }


  timePickerMode =
    "hour";


  timeOverlay.hidden =
    false;


  renderTimePicker();
}


function closeTimePicker() {
  timeOverlay.hidden =
    true;

  activeTimeInput =
    null;
}


// ============================================================
// TIME PICKER RENDER
// ============================================================

function renderTimePicker() {
  timeModeHour.classList.toggle(
    "active",
    timePickerMode === "hour"
  );


  timeModeMinute.classList.toggle(
    "active",
    timePickerMode === "minute"
  );


  timeMinuteAdjust.hidden =
    timePickerMode !== "minute";


  timeAm.classList.toggle(
    "active",
    selectedPeriod === "AM"
  );


  timePm.classList.toggle(
    "active",
    selectedPeriod === "PM"
  );


  timeExactMinute.textContent =
    String(
      selectedMinute
    )
      .padStart(
        2,
        "0"
      );


  timePreview.textContent =
    formatSelectedTime();


  renderTimeClockFace();


  const hand =
    timeClockFace.querySelector(
      ".time-clock-hand"
    );


  if (!hand) {
    return;
  }


  const hasSelection =
    timePickerMode === "hour"
      ? selectedHour !== null
      : minuteHasBeenSelected;


  hand.hidden =
    !hasSelection;


  if (hasSelection) {
    updateTimeClockHand(
      getCurrentClockValue()
    );
  }
}


// ============================================================
// CLOCK FACE
// ============================================================

function getCurrentClockValue() {
  return (
    timePickerMode === "hour"
      ? selectedHour
      : selectedMinute
  );
}


function getClockAngle(
  value
) {
  if (
    timePickerMode === "hour"
  ) {
    const index =
      value === 12
        ? 0
        : value;


    return (
      index * 30 -
      90
    );
  }


  return (
    value / 5 *
    30 -
    90
  );
}


function updateTimeClockHand(
  value
) {
  const hand =
    timeClockFace.querySelector(
      ".time-clock-hand"
    );


  if (!hand) {
    return;
  }


  hand.style.transform =
    `translateY(-50%) rotate(${getClockAngle(value)}deg)`;
}


function renderTimeClockFace() {
  const values =
    timePickerMode === "hour"
      ? [
          12,
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11
        ]
      : [
          0,
          5,
          10,
          15,
          20,
          25,
          30,
          35,
          40,
          45,
          50,
          55
        ];


  const radius =
    37;


  let html = `
    <div class="time-clock-hand"></div>
    <div class="time-clock-center"></div>
  `;


  values.forEach(
    (value, index) => {
      const angle =
        (
          index * 30 -
          90
        ) *
        (
          Math.PI /
          180
        );


      const x =
        50 +
        radius *
        Math.cos(
          angle
        );


      const y =
        50 +
        radius *
        Math.sin(
          angle
        );


      const selected =
        timePickerMode === "hour"
          ? value === selectedHour
          : (
              minuteHasBeenSelected &&
              value === selectedMinute
            );


      const display =
        timePickerMode === "minute"
          ? String(value)
              .padStart(
                2,
                "0"
              )
          : value;


      html += `
        <button
          class="time-clock-option ${
            selected
              ? "selected"
              : ""
          }"
          type="button"
          data-time-value="${value}"
          style="
            left: ${x}%;
            top: ${y}%;
          "
        >
          ${display}
        </button>
      `;
    }
  );


  timeClockFace.innerHTML =
    html;
}


// ============================================================
// CLOCK SELECTION
// ============================================================

timeClockFace.addEventListener(
  "click",

  event => {
    const button =
      event.target.closest(
        "[data-time-value]"
      );


    if (!button) {
      return;
    }


    const value =
      Number(
        button.dataset.timeValue
      );


    if (
      timePickerMode === "hour"
    ) {
      selectedHour =
        value;
    }

    else {
      selectedMinute =
        value;

      minuteHasBeenSelected =
        true;
    }


    renderTimePicker();
  }
);


// ============================================================
// HOUR / MINUTE TABS
// ============================================================

timeModeHour.addEventListener(
  "click",

  () => {
    timePickerMode =
      "hour";

    renderTimePicker();
  }
);


timeModeMinute.addEventListener(
  "click",

  () => {
    timePickerMode =
      "minute";

    renderTimePicker();
  }
);


// ============================================================
// EXACT MINUTE +/-
// ============================================================

timeMinuteMinus.addEventListener(
  "click",

  () => {
    adjustSelectedTime(
      -1
    );
  }
);


timeMinutePlus.addEventListener(
  "click",

  () => {
    adjustSelectedTime(
      1
    );
  }
);


function adjustSelectedTime(
  amount
) {
  minuteHasBeenSelected =
    true;


  if (
    selectedHour === null
  ) {
    selectedMinute =
      (
        selectedMinute +
        amount +
        60
      ) % 60;


    renderTimePicker();

    return;
  }


  let hour24 =
    convertTo24Hour(
      selectedHour,
      selectedPeriod
    );


  let totalMinutes =
    hour24 * 60 +
    selectedMinute +
    amount;


  const minutesPerDay =
    1440;


  totalMinutes =
    (
      totalMinutes %
        minutesPerDay +
      minutesPerDay
    ) %
    minutesPerDay;


  hour24 =
    Math.floor(
      totalMinutes /
      60
    );


  selectedMinute =
    totalMinutes %
    60;


  selectedPeriod =
    hour24 >= 12
      ? "PM"
      : "AM";


  selectedHour =
    hour24 % 12 ||
    12;


  renderTimePicker();
}


// ============================================================
// AM / PM
// ============================================================

timeAm.addEventListener(
  "click",

  () => {
    selectedPeriod =
      "AM";

    renderTimePicker();
  }
);


timePm.addEventListener(
  "click",

  () => {
    selectedPeriod =
      "PM";

    renderTimePicker();
  }
);


// ============================================================
// TIME DONE / CANCEL
// ============================================================

timeDone.addEventListener(
  "click",

  () => {
    if (!activeTimeInput) {
      return;
    }


    if (!selectedHour) {
      timePreview.textContent =
        "Choose an hour first.";

      return;
    }


    activeTimeInput.value =
      formatSelectedTime();


    closeTimePicker();
  }
);


timeCancel.addEventListener(
  "click",
  closeTimePicker
);


// ============================================================
// TIME BUTTON
// ============================================================

document.addEventListener(
  "click",

  event => {
    const button =
      event.target.closest(
        ".time-picker-button"
      );


    if (!button) {
      return;
    }


    const targetId =
      button.dataset.timeTarget;


    const input =
      targetId
        ? document.getElementById(
            targetId
          )
        : button
            .closest(
              ".time-input-wrap"
            )
            ?.querySelector(
              "input"
            );


    if (input) {
      openTimePicker(
        input
      );
    }
  }
);


timeOverlay.addEventListener(
  "click",

  event => {
    if (
      event.target ===
      timeOverlay
    ) {
      closeTimePicker();
    }
  }
);


// ============================================================
// BASIC HTML SAFETY
// ============================================================

function escapeHtml(
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


function escapeHtmlAttribute(
  value
) {
  return escapeHtml(
    value
  );
}


// ============================================================
// ADD ITEM
// ============================================================

async function addUpcomingItem() {
  const title =
    upcomingTitle.value
      .trim();


  const date =
    dateInputToISO(
      upcomingDate.value
    );


  const time =
    upcomingTime.value.trim()
      ? timeInputToDatabase(
          upcomingTime.value
        )
      : null;


  const type =
    upcomingType.value;


  const recurrence =
    upcomingRecurrence.value ||
    null;


  if (!title) {
    upcomingFormStatus.textContent =
      "Add a title first.";

    return;
  }


  if (!date) {
    upcomingFormStatus.textContent =
      "Enter a valid date: MM/DD/YYYY";

    return;
  }


  if (
    upcomingTime.value.trim() &&
    !time
  ) {
    upcomingFormStatus.textContent =
      "Enter a valid time, like 3:30 PM.";

    return;
  }


  upcomingAddButton.disabled =
    true;


  upcomingFormStatus.textContent =
    "Adding...";


  const {
    error
  } =
    await supabaseClient
      .from(
        "upcoming_items"
      )
      .insert({
        title,
        date,
        time,
        type,
        recurrence
      });


  if (error) {
    console.error(
      "Could not add upcoming item:",
      error
    );

    upcomingFormStatus.textContent =
      "Could not add item.";

    upcomingAddButton.disabled =
      false;

    return;
  }


  upcomingTitle.value =
    "";

  upcomingDate.value =
    "";

  upcomingTime.value =
    "";

  upcomingType.value =
    "task";

  upcomingRecurrence.value =
    "";


  upcomingFormStatus.textContent =
    "Added!";


  upcomingAddButton.disabled =
    false;


  await loadUpcomingItems();
}


upcomingAddButton.addEventListener(
  "click",
  addUpcomingItem
);


// ============================================================
// CUSTOM CALENDAR
// ============================================================

const CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];


function setupCalendarMonths() {
  calendarMonth.innerHTML =
    CALENDAR_MONTHS
      .map(
        (month, index) => `
          <option value="${index}">
            ${month}
          </option>
        `
      )
      .join("");
}


function setupCalendarYears() {
  const currentYear =
    new Date()
      .getFullYear();


  let html =
    "";


  for (
    let year = currentYear;
    year <=
      currentYear + 10;
    year++
  ) {
    html += `
      <option value="${year}">
        ${year}
      </option>
    `;
  }


  calendarYear.innerHTML =
    html;
}


function openCalendar(
  input
) {
  activeDateInput =
    input;


  input.blur();


  calendarViewDate =
    dateInputToDate(
      input.value
    ) ||
    new Date();


  calendarOverlay.hidden =
    false;


  renderCalendar();
}


function closeCalendar() {
  calendarOverlay.hidden =
    true;

  activeDateInput =
    null;
}


function renderCalendar() {
  const year =
    calendarViewDate
      .getFullYear();


  const month =
    calendarViewDate
      .getMonth();


  calendarHeading.textContent =
    `${CALENDAR_MONTHS[month]} ${year}`;


  calendarMonth.value =
    String(month);


  calendarYear.value =
    String(year);


  const firstWeekday =
    new Date(
      year,
      month,
      1
    )
      .getDay();


  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    )
      .getDate();


  const today =
    new Date();


  const selectedDate =
    activeDateInput
      ? dateInputToDate(
          activeDateInput.value
        )
      : null;


  let html =
    "";


  for (
    let i = 0;
    i < firstWeekday;
    i++
  ) {
    html += `
      <div class="calendar-empty-day"></div>
    `;
  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    const isToday =
      today.getFullYear() ===
        year &&
      today.getMonth() ===
        month &&
      today.getDate() ===
        day;


    const isSelected =
      selectedDate &&
      selectedDate.getFullYear() ===
        year &&
      selectedDate.getMonth() ===
        month &&
      selectedDate.getDate() ===
        day;


    const classes =
      [
        "calendar-day"
      ];


    if (isToday) {
      classes.push(
        "today"
      );
    }


    if (isSelected) {
      classes.push(
        "selected"
      );
    }


    html += `
      <button
        class="${classes.join(" ")}"
        type="button"
        data-calendar-day="${day}"
      >
        ${day}
      </button>
    `;
  }


  calendarGrid.innerHTML =
    html;
}


function chooseCalendarDate(
  day
) {
  if (!activeDateInput) {
    return;
  }


  const year =
    calendarViewDate
      .getFullYear();


  const month =
    calendarViewDate
      .getMonth() + 1;


  activeDateInput.value =
    `${String(month).padStart(2, "0")}/` +
    `${String(day).padStart(2, "0")}/` +
    `${String(year).padStart(4, "0")}`;


  closeCalendar();
}


// ============================================================
// CALENDAR BUTTONS
// ============================================================

document.addEventListener(
  "click",

  event => {
    const button =
      event.target.closest(
        ".date-picker-button"
      );


    if (!button) {
      return;
    }


    const targetId =
      button.dataset.dateTarget;


    const input =
      targetId
        ? document.getElementById(
            targetId
          )
        : button
            .closest(
              ".date-input-wrap"
            )
            ?.querySelector(
              "input"
            );


    if (input) {
      openCalendar(
        input
      );
    }
  }
);


calendarPrev.addEventListener(
  "click",

  () => {
    calendarViewDate.setMonth(
      calendarViewDate.getMonth() - 1
    );

    renderCalendar();
  }
);


calendarNext.addEventListener(
  "click",

  () => {
    calendarViewDate.setMonth(
      calendarViewDate.getMonth() + 1
    );

    renderCalendar();
  }
);


calendarMonth.addEventListener(
  "change",

  () => {
    calendarViewDate.setMonth(
      Number(
        calendarMonth.value
      )
    );

    renderCalendar();
  }
);


calendarYear.addEventListener(
  "change",

  () => {
    calendarViewDate.setFullYear(
      Number(
        calendarYear.value
      )
    );

    renderCalendar();
  }
);


calendarToday.addEventListener(
  "click",

  () => {
    calendarViewDate =
      new Date();

    renderCalendar();
  }
);


calendarCancel.addEventListener(
  "click",
  closeCalendar
);


calendarGrid.addEventListener(
  "click",

  event => {
    const button =
      event.target.closest(
        "[data-calendar-day]"
      );


    if (!button) {
      return;
    }


    chooseCalendarDate(
      Number(
        button.dataset.calendarDay
      )
    );
  }
);


calendarOverlay.addEventListener(
  "click",

  event => {
    if (
      event.target ===
      calendarOverlay
    ) {
      closeCalendar();
    }
  }
);


// ============================================================
// ESCAPE
// ============================================================

document.addEventListener(
  "keydown",

  event => {
    if (
      event.key !==
      "Escape"
    ) {
      return;
    }


    if (
      !calendarOverlay.hidden
    ) {
      closeCalendar();

      return;
    }


    if (
      !timeOverlay.hidden
    ) {
      closeTimePicker();

      return;
    }


    if (
      !deleteConfirmOverlay.hidden
    ) {
      pendingDeleteId =
        null;

      deleteConfirmOverlay.hidden =
        true;
    }
  }
);


// ============================================================
// SETUP
// ============================================================

setupCalendarMonths();

setupCalendarYears();


// ============================================================
// START
// ============================================================

loadUpcomingItems();

// ============================================================
// EXTERNAL DISPLAY INPUT FIXES
// ============================================================

function samosSetExternalKeyboardMode(root = document) {
  root.querySelectorAll?.(
    "#upcoming-title, #upcoming-date, #upcoming-time, .upcoming-edit-title, .upcoming-edit-date, .upcoming-edit-time"
  ).forEach(input => {
    input.setAttribute("inputmode", "none");
    input.setAttribute("autocomplete", "off");
  });
}

function samosCloseSelectMenus(except = null) {
  document.querySelectorAll(".samos-select.open").forEach(wrapper => {
    if (wrapper !== except) {
      wrapper.classList.remove("open");
      const menu = wrapper.querySelector(".samos-select-menu");
      const button = wrapper.querySelector(".samos-select-button");
      if (menu) menu.hidden = true;
      if (button) button.setAttribute("aria-expanded", "false");
    }
  });
}

function samosUpgradeSelect(select) {
  if (!select || select.dataset.samosUpgraded === "true") {
    return;
  }

  select.dataset.samosUpgraded = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "samos-select";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "samos-select-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.className = "samos-select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  const updateButton = () => {
    const selected = select.options[select.selectedIndex];
    button.textContent = selected ? selected.textContent.trim() : "Choose";
  };

  Array.from(select.options).forEach(option => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "samos-select-option";
    optionButton.dataset.value = option.value;
    optionButton.textContent = option.textContent.trim();
    optionButton.setAttribute("role", "option");

    optionButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      updateButton();
      samosCloseSelectMenus();
    });

    menu.appendChild(optionButton);
  });

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    const opening = menu.hidden;
    samosCloseSelectMenus(wrapper);
    menu.hidden = !opening;
    wrapper.classList.toggle("open", opening);
    button.setAttribute("aria-expanded", String(opening));
  });

  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  wrapper.appendChild(button);
  wrapper.appendChild(menu);

  select.classList.add("samos-native-select");
  updateButton();
}

function samosUpgradeUpcomingControls(root = document) {
  samosSetExternalKeyboardMode(root);

  root.querySelectorAll?.(
    "#upcoming-type, #upcoming-recurrence, .upcoming-edit-type, .upcoming-edit-recurrence"
  ).forEach(samosUpgradeSelect);
}

samosUpgradeUpcomingControls();

const samosUpcomingObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        samosUpgradeUpcomingControls(node);
      }
    }
  }
});

samosUpcomingObserver.observe(document.body, {
  childList: true,
  subtree: true
});

document.addEventListener("click", event => {
  if (!event.target.closest(".samos-select")) {
    samosCloseSelectMenus();
  }
});
