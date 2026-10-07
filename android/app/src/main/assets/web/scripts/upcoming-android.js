// ============================================================
// SamOS Hub — Android / External Display
// v1.2.2 input bridge
// ============================================================

let lastExternalBridgeClick = 0;
let lastExternalBridgeTarget = null;

const SAMOS_INTERACTIVE_SELECTOR = [
  ".samos-select-option",
  ".samos-select-button",
  ".date-picker-button",
  ".time-picker-button",
  ".calendar-day",
  ".calendar-nav-button",
  ".time-clock-option",
  ".time-mode-button",
  ".time-period-button",
  ".upcoming-icon-button",
  "button",
  "a",
  "input",
  "select",
  "[role='button']",
  "[data-action]",
  "[data-calendar-day]",
  "[data-time-value]",
  ".calendar-overlay",
  ".time-overlay",
  ".delete-confirm-overlay"
].join(", ");

document.addEventListener(
  "click",
  event => {
    const interactive = event.target.closest?.(SAMOS_INTERACTIVE_SELECTOR);
    if (interactive) {
      lastExternalBridgeClick = Date.now();
      lastExternalBridgeTarget = interactive;
    }
  },
  true
);

function samosVisible(element) {
  if (!element || element.disabled || !element.getClientRects().length) {
    return false;
  }
  const style = getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none";
}

function samosPointInRect(x, y, rect, padding = 0) {
  return (
    x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding
  );
}

function samosFindExternalMouseTarget(x, y) {
  // First, use the browser's exact hit test.
  const elements = document.elementsFromPoint(x, y);

  for (const element of elements) {
    const direct = element.closest?.(SAMOS_INTERACTIVE_SELECTOR);
    if (!direct || !samosVisible(direct)) continue;

    // If the coordinate landed in the right-hand button zone of a
    // date/time wrapper, prefer the actual picker button over its input.
    const wrapper = element.closest?.(".date-input-wrap, .time-input-wrap");
    if (wrapper) {
      const picker = wrapper.querySelector(".date-picker-button, .time-picker-button");
      if (picker && samosVisible(picker)) {
        const pr = picker.getBoundingClientRect();
        if (samosPointInRect(x, y, pr, 10)) {
          return picker;
        }
      }
    }

    return direct;
  }

  // Forgiveness pass for coordinate rounding/scaling on external displays.
  const candidates = Array.from(document.querySelectorAll(SAMOS_INTERACTIVE_SELECTOR))
    .filter(samosVisible);

  let best = null;
  let bestScore = Infinity;

  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    const padding = element.matches("button, a, .samos-select-button, .samos-select-option") ? 22 : 12;
    if (!samosPointInRect(x, y, rect, padding)) continue;

    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    const outside = Math.hypot(dx, dy);
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const center = Math.hypot(x - cx, y - cy);

    let penalty = 0;
    if (element.matches("input")) penalty = 80;
    if (element.matches("select")) penalty = 100;
    if (element.matches(".calendar-overlay, .time-overlay, .delete-confirm-overlay")) penalty = 150;

    const score = outside * 1000 + center + penalty;
    if (score < bestScore) {
      best = element;
      bestScore = score;
    }
  }

  return best;
}

window.samosHandleExternalMouse = (
  physicalX,
  physicalY,
  viewWidth,
  viewHeight
) => {
  if (!viewWidth || !viewHeight) {
    return false;
  }

  const x = physicalX * window.innerWidth / viewWidth;
  const y = physicalY * window.innerHeight / viewHeight;

  const target = samosFindExternalMouseTarget(x, y);
  if (!target) {
    return false;
  }

  if (
    target === lastExternalBridgeTarget &&
    Date.now() - lastExternalBridgeClick < 250
  ) {
    return true;
  }

  if (target.matches("input")) {
    // inputmode=none keeps Android's soft keyboard out of the way,
    // while a physical/Bluetooth keyboard can still type into the field.
    if (
      target.matches("#upcoming-date, #upcoming-time, .upcoming-edit-date, .upcoming-edit-time")
    ) {
      target.setAttribute("inputmode", "none");
    }
    target.focus({ preventScroll: true });
    return true;
  }

  // Native <select> elements are upgraded to SamOS menus on Upcoming.
  // If another select remains, focus it but don't depend on a synthetic
  // click to open Android's native picker.
  if (target.matches("select")) {
    target.focus({ preventScroll: true });
    return true;
  }

  lastExternalBridgeTarget = target;
  lastExternalBridgeClick = Date.now();
  target.click();
  return true;
};
