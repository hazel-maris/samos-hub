// ============================================================
// SamOS Hub — Settings Page
// ============================================================


// ============================================================
// SETTINGS BINDINGS
// ============================================================

function bindCheckboxSetting(
  elementId,
  settingKey
) {
  const element =
    document.getElementById(
      elementId
    );


  if (!element) {
    return;
  }


  element.checked =
    getSetting(
      settingKey
    );


  element.addEventListener(
    "change",

    () => {
      setSetting(
        settingKey,
        element.checked
      );
    }
  );
}


// ============================================================
// WEATHER
// ============================================================

bindCheckboxSetting(
  "setting-sun-times",
  "showSunTimes"
);


// ============================================================
// UPCOMING
// ============================================================

bindCheckboxSetting(
  "setting-daily-tasks",
  "showDailyTasks"
);


bindCheckboxSetting(
  "setting-weekly-tasks",
  "showWeeklyTasks"
);


bindCheckboxSetting(
  "setting-monthly-tasks",
  "showMonthlyTasks"
);


bindCheckboxSetting(
  "setting-yearly-tasks",
  "showYearlyTasks"
);

// ============================================================
// SUPABASE AUTH
// ============================================================

const authStatus =
  document.getElementById(
    "supabase-auth-status"
  );

const loginForm =
  document.getElementById(
    "supabase-login-form"
  );

const emailInput =
  document.getElementById(
    "supabase-email"
  );

const passwordInput =
  document.getElementById(
    "supabase-password"
  );

const loginButton =
  document.getElementById(
    "supabase-login"
  );

const logoutButton =
  document.getElementById(
    "supabase-logout"
  );


async function updateAuthUI() {
  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth
      .getSession();


  if (session?.user) {
    authStatus.textContent =
      `Signed in as ${session.user.email}`;

    loginForm.hidden =
      true;

    logoutButton.hidden =
      false;

    return;
  }


  authStatus.textContent =
    "Not signed in";

  loginForm.hidden =
    false;

  logoutButton.hidden =
    true;
}


loginButton.addEventListener(
  "click",

  async () => {
    authStatus.textContent =
      "Signing in...";


    const {
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({
          email:
            emailInput.value,

          password:
            passwordInput.value
        });


    if (error) {
      authStatus.textContent =
        "Sign in failed";

      console.error(
        "Supabase sign-in failed:",
        error
      );

      return;
    }


    passwordInput.value =
      "";


    updateAuthUI();
  }
);


logoutButton.addEventListener(
  "click",

  async () => {
    await supabaseClient.auth
      .signOut();


    updateAuthUI();
  }
);


updateAuthUI();