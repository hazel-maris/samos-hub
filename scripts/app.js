// ============================================================
// SamOS Hub — Shared App
// ============================================================


const CONFIG =
  window.SAMOS_CONFIG || {};

const SUPABASE_URL =
  CONFIG.supabaseUrl || "";

const SUPABASE_KEY =
  CONFIG.supabaseKey || "";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

const DEFAULT_SETTINGS = {
  showSunTimes: false,

  showDailyTasks: false,
  showWeeklyTasks: true,
  showMonthlyTasks: true,
  showYearlyTasks: false
};


// ============================================================
// SETTINGS HELPERS
// ============================================================

function getSetting(
  key
) {
  const saved =
    localStorage.getItem(
      `samos_setting_${key}`
    );

  if (saved === null) {
    return DEFAULT_SETTINGS[key];
  }

  return saved === "true";
}


function setSetting(
  key,
  value
) {
  localStorage.setItem(
    `samos_setting_${key}`,
    String(value)
  );
}


// ============================================================
// SERVICE WORKER
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
    const root =
      document.body.dataset.root ||
      ".";

    navigator.serviceWorker
      .register(
        `${root}/service-worker.js`
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

// ============================================================
// SUPABASE
// ============================================================

// TESTING SUPABASE

async function testSupabaseConnection() {
  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "upcoming_items"
      )
      .select(
        "id"
      )
      .limit(1);

  if (error) {
    console.error(
      "Supabase test failed:",
      error
    );

    return;
  }

  console.log(
    "Supabase connection works:",
    data
  );
}

testSupabaseConnection();

//