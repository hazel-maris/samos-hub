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

      setupPersistentNavigation();
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


// ============================================================
// PERSISTENT NAVIGATION
// Keep the Home document alive so Spotify keeps playing.
// ============================================================

function setupPersistentNavigation() {
  const tabs =
    navContainer?.querySelectorAll(
      ".journal-tab"
    ) || [];


  if (window.parent !== window) {
    tabs.forEach(tab => {
      if (tab.dataset.page === "home") {
        tab.addEventListener(
          "click",
          event => {
            event.preventDefault();

            window.parent.postMessage(
              {
                type: "samos-navigation",
                page: "home"
              },
              window.location.origin
            );
          }
        );
      }
    });

    return;
  }


  const isHome =
    !window.location.pathname.includes(
      "/html/"
    );


  if (!isHome) {
    return;
  }


  let pageFrame =
    document.getElementById(
      "samos-page-frame"
    );


  if (!pageFrame) {
    pageFrame =
      document.createElement(
        "iframe"
      );

    pageFrame.id =
      "samos-page-frame";

    pageFrame.title =
      "SamOS page";

    pageFrame.hidden =
      true;

    document.body.appendChild(
      pageFrame
    );
  }


  tabs.forEach(tab => {
    if (tab.dataset.page === "home") {
      return;
    }

    tab.addEventListener(
      "click",
      event => {
        event.preventDefault();

        pageFrame.src =
          tab.href;

        pageFrame.hidden =
          false;
      }
    );
  });


  window.addEventListener(
    "message",
    event => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== "samos-navigation"
      ) {
        return;
      }

      if (event.data.page === "home") {
        pageFrame.hidden =
          true;

        pageFrame.src =
          "about:blank";
      }
    }
  );


}


// Suppress the software keyboard without blocking physical keyboard input.
function samosConfigureKeyboard(root = document) {
  root.querySelectorAll?.("input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea")
    .forEach(input => input.setAttribute("inputmode", "none"));
}
samosConfigureKeyboard();
new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches("input, textarea")) node.setAttribute("inputmode", "none");
      samosConfigureKeyboard(node);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
