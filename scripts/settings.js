const DEFAULT_SETTINGS = {
  showSunTimes: true
};


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


const sunTimesSetting =
  document.getElementById(
    "setting-sun-times"
  );


sunTimesSetting.checked =
  getSetting(
    "showSunTimes"
  );


sunTimesSetting.addEventListener(
  "change",
  () => {
    setSetting(
      "showSunTimes",
      sunTimesSetting.checked
    );
  }
);