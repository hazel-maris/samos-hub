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


let supabaseLoginBusy = false;

function showSupabaseLoginError(error) {
  const invalidLogin =
    error.code === "invalid_credentials" ||
    error.status === 400;

  authStatus.textContent = invalidLogin
    ? "Login failed — wrong email or password"
    : `Login failed: ${error.message}`;

  console.error("Supabase sign-in failed:", error);
}

async function signInToSupabase() {
  if (supabaseLoginBusy) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authStatus.textContent =
      "Enter your email and password.";
    return;
  }

  supabaseLoginBusy = true;
  loginButton.disabled = true;
  authStatus.textContent = "Signing in...";

  try {
    const { error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      showSupabaseLoginError(error);
      return;
    }

    passwordInput.value = "";
    await updateAuthUI();
  } catch (error) {
    showSupabaseLoginError(error);
  } finally {
    supabaseLoginBusy = false;
    loginButton.disabled = false;
  }
}

loginButton.addEventListener(
  "click",
  signInToSupabase
);

for (const input of [emailInput, passwordInput]) {
  input.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.isComposing &&
      !event.repeat
    ) {
      event.preventDefault();
      loginButton.click();
    }
  });
}


logoutButton.addEventListener(
  "click",

  async () => {
    await supabaseClient.auth
      .signOut();


    updateAuthUI();
  }
);


updateAuthUI();