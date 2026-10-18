/* ============================================================
   SamOS Hub — Scheduled Appearance
   Morning 05:00–19:00; night 19:00–05:00 by default.
   Load on every Hub page in place of the previous night-mode.js.
   The existing night.css remains unchanged.
   ============================================================ */
(() => {
  "use strict";

  const KEYS = {
    mode: "samos-theme",          // auto | morning | night
    morning: "samos-morning-start", // HH:MM, local device time
    night: "samos-night-start"      // HH:MM, local device time
  };
  const DEFAULTS = { mode: "auto", morning: "05:00", night: "19:00" };
  const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const root = document.documentElement;
  let nextCheck = null;

  function read(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; }
    catch (_) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, value); }
    catch (_) { /* Theme still updates for this page. */ }
  }

  function getSettings() {
    const storedMode = read(KEYS.mode, DEFAULTS.mode);
    const mode = ["auto", "morning", "night"].includes(storedMode)
      ? storedMode : DEFAULTS.mode;
    const storedMorning = read(KEYS.morning, DEFAULTS.morning);
    const storedNight = read(KEYS.night, DEFAULTS.night);
    return {
      mode,
      morning: VALID_TIME.test(storedMorning) ? storedMorning : DEFAULTS.morning,
      night: VALID_TIME.test(storedNight) ? storedNight : DEFAULTS.night
    };
  }

  function asMinutes(time) {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  }

  function resolveTheme(settings, date = new Date()) {
    if (settings.mode !== "auto") return settings.mode;
    const now = date.getHours() * 60 + date.getMinutes();
    const start = asMinutes(settings.morning);
    const end = asMinutes(settings.night);

    // Equal times are treated as invalid and fall back to defaults.
    if (start === end) {
      return resolveTheme({ ...settings, morning: DEFAULTS.morning, night: DEFAULTS.night }, date);
    }
    const day = start < end
      ? now >= start && now < end
      : now >= start || now < end;
    return day ? "morning" : "night";
  }

  function applyTheme() {
    const settings = getSettings();
    root.dataset.samosTheme = resolveTheme(settings);
    root.dataset.samosThemeMode = settings.mode;
    updateStatus(settings);
  }

  function scheduleNextCheck() {
    clearTimeout(nextCheck);
    const now = new Date();
    // Check on the next minute boundary plus a small cushion.
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 80;
    nextCheck = setTimeout(() => {
      applyTheme();
      scheduleNextCheck();
    }, Math.max(100, delay));
  }

  function updateStatus(settings = getSettings()) {
    const status = document.getElementById("samos-theme-status");
    if (!status) return;
    const current = root.dataset.samosTheme === "night" ? "Night" : "Morning";
    status.textContent = settings.mode === "auto"
      ? `Automatic · ${current} is active (device local time)`
      : `${current} mode is manually selected`;
  }

  function makeAppearanceSettings() {
    const panel = document.querySelector(".settings-panel");
    if (!panel || document.getElementById("samos-appearance-section")) return;

    const section = document.createElement("section");
    section.className = "settings-section";
    section.id = "samos-appearance-section";
    section.innerHTML = `
      <h2 class="settings-section-title">Appearance</h2>
      <div class="samos-theme-field">
        <label for="samos-theme-mode">Theme</label>
        <select id="samos-theme-mode">
          <option value="auto">Automatic (schedule)</option>
          <option value="morning">Always morning</option>
          <option value="night">Always night</option>
        </select>
      </div>
      <div class="samos-theme-field">
        <label for="samos-morning-start">Morning starts</label>
        <input id="samos-morning-start" type="time" step="60">
      </div>
      <div class="samos-theme-field">
        <label for="samos-night-start">Night starts</label>
        <input id="samos-night-start" type="time" step="60">
      </div>
      <p id="samos-theme-status" role="status" aria-live="polite"></p>
      <p class="samos-theme-help">Times use this device's clock. Manual modes override the schedule.</p>
    `;

    const heading = panel.querySelector(".settings-title");
    if (heading) heading.insertAdjacentElement("afterend", section);
    else panel.prepend(section);

    const style = document.createElement("style");
    style.id = "samos-appearance-style";
    style.textContent = `
      #samos-appearance-section { max-width: 760px; }
      .samos-theme-field { display: flex; align-items: center; justify-content: space-between;
        gap: 18px; padding: 8px 4px; font-family: "vt323", sans-serif;
        font-size: clamp(1.3rem, 1.5vw, 1.7rem); }
      .samos-theme-field label { min-width: 0; }
      .samos-theme-field select, .samos-theme-field input {
        width: min(52%, 260px); min-width: 0; min-height: 44px; padding: 6px 10px;
        border: 2px solid var(--border); border-radius: 5px;
        background: var(--paper); color: var(--text);
        font: inherit; font-size: 1.3rem; color-scheme: light;
      }
      .samos-theme-field select:focus-visible, .samos-theme-field input:focus-visible {
        outline: 3px solid var(--border); outline-offset: 2px;
      }
      #samos-theme-status { margin: 8px 4px 0; font-size: 1.25rem; }
      .samos-theme-help { margin: 4px 4px 18px; font-size: 1.1rem; opacity: .75; }
      html[data-samos-theme="night"] .samos-theme-field select,
      html[data-samos-theme="night"] .samos-theme-field input {
        background: #283451; color: #edeaff; border-color: #8794c6; color-scheme: dark;
      }
      @media (max-width: 600px) {
        .samos-theme-field { font-size: 1.5rem; }
        .samos-theme-field select, .samos-theme-field input { width: 52%; font-size: 16px; }
      }
    `;
    document.head.appendChild(style);

    const mode = section.querySelector("#samos-theme-mode");
    const morning = section.querySelector("#samos-morning-start");
    const night = section.querySelector("#samos-night-start");

    function syncFields() {
      const s = getSettings();
      mode.value = s.mode;
      morning.value = s.morning;
      night.value = s.night;
      morning.disabled = s.mode !== "auto";
      night.disabled = s.mode !== "auto";
      updateStatus(s);
    }

    mode.addEventListener("change", () => {
      write(KEYS.mode, mode.value);
      syncFields();
      applyTheme();
    });

    function saveTimes() {
      if (!VALID_TIME.test(morning.value) || !VALID_TIME.test(night.value)) return;
      if (morning.value === night.value) {
        night.setCustomValidity("Morning and night must start at different times.");
        night.reportValidity();
        return;
      }
      night.setCustomValidity("");
      write(KEYS.morning, morning.value);
      write(KEYS.night, night.value);
      applyTheme();
    }

    morning.addEventListener("change", saveTimes);
    night.addEventListener("change", saveTimes);
    morning.addEventListener("input", () => night.setCustomValidity(""));
    night.addEventListener("input", () => night.setCustomValidity(""));
    window.addEventListener("storage", syncFields);
    syncFields();
  }

  // Apply synchronously in <head> so night.css uses the correct palette immediately.
  applyTheme();
  scheduleNextCheck();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", makeAppearanceSettings, { once: true });
  } else {
    makeAppearanceSettings();
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { applyTheme(); scheduleNextCheck(); }
  });
  window.addEventListener("focus", applyTheme);
  window.addEventListener("pageshow", () => { applyTheme(); scheduleNextCheck(); });
  window.addEventListener("storage", event => {
    if (event.key === null || Object.values(KEYS).includes(event.key)) applyTheme();
  });
})();
