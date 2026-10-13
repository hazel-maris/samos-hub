// SamOS Triage v0.1: quick capture + simple list, independent of Upcoming.
(() => {
  "use strict";
  const form = document.getElementById("triage-form");
  const input = document.getElementById("triage-input");
  const addButton = document.getElementById("triage-add");
  const list = document.getElementById("triage-list");
  const message = document.getElementById("triage-message");
  let userId = null;
  let busy = false;

  function status(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }
  function client() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      throw new Error("Supabase is not configured.");
    }
    return supabaseClient;
  }
  function setBusy(next) {
    busy = next;
    addButton.disabled = next;
  }
  async function load() {
    try {
      const { data: auth, error: authError } = await client().auth.getUser();
      if (authError) throw authError;
      userId = auth?.user?.id || null;
      list.replaceChildren();
      if (!userId) {
        list.textContent = "Sign in from Settings to use Triage.";
        return;
      }
      const { data, error } = await client().from("triage_items")
        .select("id,content,created_at").eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) {
        const empty = document.createElement("p");
        empty.className = "triage-empty";
        empty.textContent = "Nothing to triage.";
        list.append(empty);
        return;
      }
      for (const item of data) {
        const row = document.createElement("div");
        row.className = "triage-row";
        const content = document.createElement("span");
        content.textContent = item.content;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "triage-remove";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove ${item.content}`);
        remove.addEventListener("click", async () => {
          if (busy || !window.confirm("Remove this thought?")) return;
          setBusy(true);
          try {
            const { error } = await client().from("triage_items").delete()
              .eq("id", item.id).eq("user_id", userId);
            if (error) throw error;
            status("");
            await load();
          } catch (error) { status(error.message || String(error), true); }
          finally { setBusy(false); }
        });
        row.append(content, remove);
        list.append(row);
      }
    } catch (error) {
      console.error("Triage load failed", error);
      status(`Could not load Triage: ${error.message || error}`, true);
      list.textContent = "Unable to load your thoughts.";
    }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const content = input.value.trim();
    if (busy || !content) return;
    if (!userId) { status("Sign in from Settings first.", true); return; }
    setBusy(true);
    try {
      const { error } = await client().from("triage_items")
        .insert({ user_id: userId, content });
      if (error) throw error;
      input.value = "";
      status("");
      await load();
      input.focus();
    } catch (error) { status(`Could not add thought: ${error.message || error}`, true); }
    finally { setBusy(false); }
  });
  load();
})();
