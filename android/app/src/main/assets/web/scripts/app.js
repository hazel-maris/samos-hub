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
 // SERVICE WORKER — REMOVE LEGACY REGISTRATION
 // ============================================================

 // SamOS Hub no longer uses a service worker.
 // Remove any previously registered SamOS worker
 // and its old file caches without deleting user data.

 if ("serviceWorker" in navigator) {
   window.addEventListener("load", async () => {
     try {
       const registrations =
         await navigator.serviceWorker.getRegistrations();

       const appPath = window.location.pathname
         .replace(/\/[^/]*$/, "/");

       for (const registration of registrations) {
         const scope = new URL(registration.scope);

         if (
           scope.origin === window.location.origin &&
           scope.pathname === appPath
         ) {
           await registration.unregister();
           console.log(
             "SamOS: legacy service worker removed"
           );
         }
       }

       if ("caches" in window) {
         const cacheNames = await caches.keys();

         await Promise.all(
           cacheNames
             .filter(name =>
               name.startsWith("samos-hub-")
             )
             .map(name => caches.delete(name))
         );
       }

       console.log("SamOS: legacy caches cleared");
     } catch (error) {
       console.warn(
         "SamOS: cleanup failed",
         error
       );
     }
   });
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