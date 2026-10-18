/* ============================================================
   SamOS Hub — Currently Reading (Supabase, shared across devices)
   The existing Supabase client from config.js is reused.
   Books are stored in public.currently_reading with RLS.
   No localStorage copy and no book-progress tracking.
   ============================================================ */
(() => {
  "use strict";

  const TABLE = "currently_reading";
  const MAX_BOOKS = 12;
  const REFRESH_MS = 60_000;
  let books = [];
  let client = null;
  let userId = null;
  let loading = false;

  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function getClient() {
    // Common SamOS and Supabase v2 client variable names.
    // The CDN's window.supabase is the SDK, NOT a client; exclude it.
    const candidates = [
      typeof supabaseClient !== "undefined" ? supabaseClient : null,
      typeof sb !== "undefined" ? sb : null,
      typeof db !== "undefined" ? db : null,
      window.supabaseClient,
      window.samosSupabase,
      window.db,
      window.sb,
      window.supabase
    ];
    return candidates.find(c => c && typeof c.from === "function" && c.auth && typeof c.auth.getUser === "function") || null;
  }

  async function getAuthorizedClient() {
    client = getClient();
    if (!client) throw new Error("Supabase client not found. Check your config.js client name (see README).");
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    userId = data?.user?.id;
    if (!userId) throw new Error("Sign in to SamOS to sync your books.");
    return client;
  }

  function safeCover(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch (_) { return ""; }
  }

  function start() {
    const orientation = document.querySelector(".orientation");
    const morning = orientation?.querySelector(".morning-panel");
    if (!orientation || !morning || document.getElementById("samos-reading-panel")) return;

    const panel = element("section", "game-panel reading-panel");
    panel.id = "samos-reading-panel";
    panel.setAttribute("aria-label", "Currently reading");
    const heading = element("div", "reading-heading");
    heading.append(element("h2", "reading-title", "CURRENTLY READING"));
    const add = element("button", "reading-add", "+ Add book");
    add.type = "button";
    heading.append(add);
    const content = element("div", "reading-books");
    const notice = element("p", "reading-error");
    notice.hidden = true;
    panel.append(heading, notice, content);
    morning.insertAdjacentElement("afterend", panel);

    const overlay = element("div", "reading-overlay");
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="reading-dialog" role="dialog" aria-modal="true" aria-labelledby="reading-dialog-title">
        <h2 id="reading-dialog-title">Add a book</h2>
        <form id="reading-form">
          <label>Title <input name="title" required maxlength="140" autocomplete="off"></label>
          <label>Author <input name="author" maxlength="140" autocomplete="off"></label>
          <label>Cover image URL (optional)
            <input name="coverurl" type="url" placeholder="https://..." autocomplete="off">
          </label>
          <p class="reading-hint">Covers use web image URLs so they display on all your devices.</p>
          <p class="reading-error" id="reading-form-error" hidden></p>
          <div class="reading-dialog-actions">
            <button type="button" id="reading-cancel">Cancel</button>
            <button type="submit">Save book</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector("form");
    const titleInput = form.elements.namedItem("title");
    const formError = overlay.querySelector("#reading-form-error");
    function showError(message) { notice.textContent = message || ""; notice.hidden = !message; }
    function showFormError(message) { formError.textContent = message || ""; formError.hidden = !message; }
    function close() { overlay.hidden = true; form.reset(); showFormError(""); add.focus(); }

    function render() {
      content.replaceChildren();
      if (!books.length) content.append(element("p", "reading-empty", "Your bookshelf is empty. Add whatever you're reading."));
      for (const book of books) {
        const card = element("article", "reading-book");
        const cover = element("div", "reading-cover");
        const coverUrl = safeCover(book.cover_url);
        if (coverUrl) {
          const img = element("img");
          img.src = coverUrl;
          img.alt = `Cover of ${book.title}`;
          img.loading = "lazy";
          img.onerror = () => img.replaceWith(element("span", "reading-cover-empty", "📖"));
          cover.append(img);
        } else cover.append(element("span", "reading-cover-empty", "📖"));
        const details = element("div", "reading-book-details");
        details.append(element("div", "reading-book-title", book.title));
        if (book.author) details.append(element("div", "reading-book-author", book.author));
        const remove = element("button", "reading-remove", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${book.title}`);
        remove.title = `Remove ${book.title}`;
        remove.addEventListener("click", async () => {
          remove.disabled = true;
          try {
            await getAuthorizedClient();
            const { error } = await client.from(TABLE).delete().eq("id", book.id).eq("user_id", userId);
            if (error) throw error;
            await refresh();
          } catch (e) { showError(e.message || "Could not remove book."); }
          finally { remove.disabled = false; }
        });
        card.append(cover, details, remove);
        content.append(card);
      }
      add.disabled = !userId || books.length >= MAX_BOOKS;
      add.title = books.length >= MAX_BOOKS ? `Maximum ${MAX_BOOKS} books` : "Add a book";
    }

    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        await getAuthorizedClient();
        const { data, error } = await client.from(TABLE)
          .select("id,title,author,cover_url,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        books = data || [];
        showError("");
      } catch (e) { showError(e.message || "Could not load books."); }
      finally { loading = false; render(); }
    }

    add.addEventListener("click", () => { showFormError(""); overlay.hidden = false; titleInput.focus(); });
    overlay.querySelector("#reading-cancel").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !overlay.hidden) close(); });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      showFormError("");
      const title = titleInput.value.trim();
      const author = form.elements.namedItem("author").value.trim();
      const inputCover = form.elements.namedItem("coverurl").value.trim();
      if (!title) return;
      const cover = safeCover(inputCover);
      if (inputCover && !cover) { showFormError("Use a valid http(s) image URL."); return; }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await getAuthorizedClient();
        const { error } = await client.from(TABLE).insert({
          user_id: userId, title, author, cover_url: cover || null
        });
        if (error) throw error;
        close();
        await refresh();
      } catch (err) { showFormError(err.message || "Could not save book."); }
      finally { submit.disabled = false; }
    });

    content.replaceChildren(element("p", "reading-loading", "Loading bookshelf..."));
    refresh();
    // Lightweight cross-device sync; tab resumes also trigger a refresh.
    setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    window.addEventListener("focus", () => refresh());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
