// ============================================================
// SamOS Hub — Shared Navigation
// ============================================================
const navContainer = document.getElementById("nav-container");

if (navContainer) {
  const root = document.body.dataset.root || ".";

  fetch(`${root}/components/nav.html`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Nav failed to load: ${response.status}`);
      }
      return response.text();
    })
    .then(html => {
      navContainer.innerHTML = html;
      
      navContainer.querySelectorAll(".nav-icon").forEach(icon => {
        const filename = icon.getAttribute("src").split("/").pop();
        icon.src = `${root}/icons/${filename}`;
      });

      // All six navigation tabs now live in components/nav.html.
      navContainer.querySelectorAll(".journal-tab").forEach(tab => {
        const path = tab.dataset.path;
        if (path) tab.href = `${root}/${path}`;
      });

      setActiveNavTab();
      setupPersistentNavigation();
    })
    .catch(error => console.error("Could not load navigation:", error));
}

// ============================================================
// ACTIVE TAB
// ============================================================
function setActiveNavTab() {
  const path = window.location.pathname;
  let currentPage = "home";

  if (path.includes("settings.html")) {
    currentPage = "settings";
  } else if (path.includes("upcoming.html")) {
    currentPage = "upcoming";
  } else if (path.includes("triage.html")) {
    currentPage = "triage";
  } else if (path.includes("groceries.html")) {
    currentPage = "groceries";
  } else if (path.includes("quotes.html")) {
    currentPage = "quotes";
  }

  document.querySelectorAll(".journal-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.page === currentPage);
    if (tab.dataset.page === currentPage) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });
}

// ============================================================
// PERSISTENT NAVIGATION
// Keep the Home document alive so Spotify keeps playing.
// ============================================================
function setupPersistentNavigation() {
  const tabs = navContainer?.querySelectorAll(".journal-tab") || [];

  if (window.parent !== window) {
    tabs.forEach(tab => {
      if (tab.dataset.page === "home") {
        tab.addEventListener("click", event => {
          event.preventDefault();
          window.parent.postMessage(
            { type: "samos-navigation", page: "home" },
            window.location.origin
          );
        });
      }
    });
    return;
  }

  const isHome = !window.location.pathname.includes("/html/");
  if (!isHome) return;

  let pageFrame = document.getElementById("samos-page-frame");
  if (!pageFrame) {
    pageFrame = document.createElement("iframe");
    pageFrame.id = "samos-page-frame";
    pageFrame.title = "SamOS page";
    pageFrame.hidden = true;
    document.body.appendChild(pageFrame);
  }

  tabs.forEach(tab => {
    if (tab.dataset.page === "home") return;
    tab.addEventListener("click", event => {
      event.preventDefault();
      pageFrame.src = tab.href;
      pageFrame.hidden = false;
    });
  });

  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin ||
        event.data?.type !== "samos-navigation") return;
    if (event.data.page === "home") {
      pageFrame.hidden = true;
      pageFrame.src = "about:blank";
    }
  });
}
