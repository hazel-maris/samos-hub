/* SamOS daily splash messages — no network or database required. */
(() => {
  "use strict";
  const messages = {
  "morning": [
    "Boot sequence initiated. Coffee peripheral detected.",
    "Today is a sandbox, not a speedrun.",
    "A bagel is a perfectly valid startup disk.",
    "The tiny clicky things are cheering for you.",
    "Side quests are optional, actually.",
    "May your USB plug be right on the first try.",
    "Spawn point: somewhere cozy.",
    "One block at a time builds a castle.",
    "Today's difficulty setting is adjustable.",
    "You have unlocked the ability to change your mind.",
    "A tiny dragon believes in your engineering skills.",
    "The coffee has entered the chat.",
    "May your breadboard behave itself.",
    "No mandatory boss fight before breakfast.",
    "Your inventory contains imagination. Rare item!",
    "Today's quest: find one nice thing.",
    "A good prototype starts with a wonderfully weird idea.",
    "The cat has scheduled a meeting. Attendance optional.",
    "Your dog has already rated today five stars.",
    "Somewhere a miniature needs a very tiny hat.",
    "The world could use more pearl-pink electronics.",
    "A little bit of progress is still a save point.",
    "You can build cool things at walking speed.",
    "The blanket guild wishes you a pleasant morning.",
    "May all your jumper wires be the correct length.",
    "An excellent day to be a curious little creature.",
    "You are allowed to use the easy recipe.",
    "The cheese department is open for business.",
    "A fresh day does not require a fresh personality.",
    "Your quest log is not a contract.",
    "Even a legendary sword needs maintenance.",
    "The best tool is the one you can actually use.",
    "Today's forecast: scattered ideas with a chance of crafting.",
    "A tiny pixel farm awaits absolutely no deadlines.",
    "Make something delightfully unnecessary.",
    "The wolf council approves comfortable clothing.",
    "First breakfast. Then world domination, maybe.",
    "You can leave the tutorial on.",
    "Not every idea needs to become a project today.",
    "Your imagination has excellent loot tables.",
    "A spool of thread is a universe of possibilities.",
    "May your stitches be straight and your snacks plentiful.",
    "The little guy says beep. This is very important.",
    "A peaceful island is an acceptable destination.",
    "There is no wrong way to enjoy a shiny fidget.",
    "You can take the scenic route through today.",
    "Even the loading screen is part of the game.",
    "A cup of something warm counts as a small adventure.",
    "Your next invention can wait until you feel curious.",
    "Good morning, player one. Your save file is intact."
  ],
  "night": [
    "System status: charging. No further action required.",
    "The bed is a save point, not a productivity station.",
    "A blanket is excellent armor against absolutely nothing.",
    "The tiny dragon has curled up for the night.",
    "Your dog has declared an emergency cuddle meeting.",
    "The cat is conducting important nighttime loaf research.",
    "The quest log will still exist tomorrow.",
    "No need to defeat the entire dungeon tonight.",
    "May your pillow find its cold side.",
    "The world can run in background mode.",
    "All unfinished crafts have been granted an extension.",
    "Your brain is allowed to close some tabs.",
    "The moon does not have a to-do list.",
    "A soft toy is a highly advanced comfort peripheral.",
    "Even the toughest wolf needs a den.",
    "Tonight's achievement: made it to the save point.",
    "The cheese goblin has clocked out. Probably.",
    "No more firmware updates for the human tonight.",
    "A quiet room is a perfectly good destination.",
    "You do not owe the evening a grand finale.",
    "The pixels are settling into their little beds.",
    "Your soldering iron can dream about circuits without you.",
    "The next chapter will wait patiently.",
    "A cozy game is a valid evening plan.",
    "May your charging cable reach the comfortable spot.",
    "The blanket fort has excellent security.",
    "Not every question needs an answer before sleep.",
    "The tiny monsters are off duty.",
    "A half-finished project is a promise of future fun.",
    "You may put the whole day down now.",
    "The night sky is not asking you to accomplish anything.",
    "Tomorrow's coffee is a future side quest.",
    "The little guy has entered low-power mode.",
    "A small loaf of cat is a magnificent thing.",
    "Rest mode is a feature, not a bug.",
    "May your socks be soft and your room pleasantly quiet.",
    "The sheep have unionized. Counting is optional.",
    "No performance review for blanket usage.",
    "Your favorite song can simply be enjoyed.",
    "The crafting table is closed for the evening.",
    "The stars are doing all the sparkling tonight.",
    "You can be comfortable before you are productive.",
    "The inventory can remain unsorted.",
    "A tiny imaginary village wishes you goodnight.",
    "Nothing needs to be optimized about this moment.",
    "The wolf plush has been promoted to night watch.",
    "Your save file includes the small victories too.",
    "The universe can tolerate an unfinished sentence.",
    "The evening belongs to you, even if you do nothing with it.",
    "Goodnight, player one. See you at the next spawn."
  ]
};
  const root = document.documentElement;
  const message = document.getElementById("daily-quote") || document.getElementById("quote");
  const label = document.getElementById("quote-mode");
  const next = document.getElementById("quote-next");
  const reset = document.getElementById("quote-reset");
  if (!message) return;
  let key = "", offset = 0;
  function render() {
    const now = new Date();
    const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    const mode = root.dataset.samosTheme === "night" ? "night" : "morning";
    const current = day + ":" + mode;
    if (key !== current) { key = current; offset = 0; }
    const pool = messages[mode];
    const index = ((day * 17 + offset) % pool.length + pool.length) % pool.length;
    if (label) label.textContent = mode === "night" ? "☾  Save point · Night edition" : "☀  New game · Morning edition";
    if (message.textContent !== pool[index]) message.textContent = pool[index];
    if (reset) reset.hidden = offset === 0;
  }
  next?.addEventListener("click", () => { offset++; render(); });
  reset?.addEventListener("click", () => { offset = 0; render(); next?.focus(); });
  new MutationObserver(render).observe(root, {attributes:true,attributeFilter:["data-samos-theme"]});
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
  window.addEventListener("pageshow", render);
  setInterval(render, 30000);
  render();
})();