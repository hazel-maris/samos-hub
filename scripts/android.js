// ============================================================
// SamOS Hub — Android / External Display
// ============================================================


let lastPlayerControlClick =
  0;


const playerControls =
  document.querySelector(
    ".player-controls"
  );


if (playerControls) {
  playerControls.addEventListener(
    "click",

    event => {
      if (
        event.target.closest(
          "button"
        )
      ) {
        lastPlayerControlClick =
          Date.now();
      }
    },

    true
  );
}


// ============================================================
// EXTERNAL MOUSE HANDLING
// ============================================================

window.samosHandleExternalMouse = (
  physicalX,
  physicalY,
  viewWidth,
  viewHeight
) => {
  if (
    !viewWidth ||
    !viewHeight
  ) {
    return false;
  }


  const x =
    physicalX *
    window.innerWidth /
    viewWidth;


  const y =
    physicalY *
    window.innerHeight /
    viewHeight;


  const padding =
    18;


  const controls = [
    document.getElementById(
      "previous-track"
    ),

    document.getElementById(
      "play-pause"
    ),

    document.getElementById(
      "next-track"
    )
  ];


  const control =
    controls.find(
      button => {
        if (!button) {
          return false;
        }


        const rect =
          button.getBoundingClientRect();


        return (
          x >=
            rect.left - padding &&

          x <=
            rect.right + padding &&

          y >=
            rect.top - padding &&

          y <=
            rect.bottom + padding
        );
      }
    );


  if (!control) {
    return false;
  }


  if (
    Date.now() -
      lastPlayerControlClick <
      400
  ) {
    return true;
  }


  control.click();


  return true;
};