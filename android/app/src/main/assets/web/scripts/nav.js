// ============================================================
// SamOS Hub — Shared Navigation
// ============================================================


const navContainer =
  document.getElementById(
    "nav-container"
  );


if (navContainer) {
  const root =
    document.body.dataset.root ||
    ".";


  fetch(
    `${root}/components/nav.html`
  )

    .then(response => {
      if (!response.ok) {
        throw new Error(
          `Nav failed to load: ${response.status}`
        );
      }

      return response.text();
    })

    .then(html => {
      navContainer.innerHTML =
        html;


      const tabs =
        navContainer.querySelectorAll(
          ".journal-tab"
        );


      tabs.forEach(tab => {
        const path =
          tab.dataset.path;

        tab.href =
          `${root}/${path}`;
      });


      setActiveNavTab();
    })

    .catch(error => {
      console.error(
        "Could not load navigation:",
        error
      );
    });
}


// ============================================================
// ACTIVE TAB
// ============================================================

function setActiveNavTab() {
  const path =
    window.location.pathname;


  let currentPage =
    "home";


  if (
    path.includes(
      "settings.html"
    )
  ) {
    currentPage =
      "settings";
  }

  else if (
    path.includes(
      "upcoming.html"
    )
  ) {
    currentPage =
      "upcoming";
  }

  else if (
    path.includes(
      "quotes.html"
    )
  ) {
    currentPage =
      "quotes";
  }


  document
    .querySelectorAll(
      ".journal-tab"
    )

    .forEach(tab => {
      tab.classList.toggle(
        "active",
        tab.dataset.page ===
          currentPage
      );
    });
}