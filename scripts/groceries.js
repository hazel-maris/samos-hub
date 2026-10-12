// SamOS Hub — Grocery List v1
// Uses the same authenticated Supabase client as Upcoming.
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const list = $("grocery-list");
  const message = $("grocery-message");
  const addForm = $("grocery-add-form");
  const addToggle = $("grocery-add-toggle");
  const storeFilter = $("grocery-store-filter");
  const storageFilter = $("grocery-storage-filter");
  const shoppingTab = $("grocery-view-shopping");
  const defaultTab = $("grocery-view-default");
  const listTitle = $("grocery-list-title");
  const viewDescription = $("grocery-view-description");
  let currentView = "shopping";
  const count = $("grocery-count");
  const categories = ["Shelf-stable", "Refrigerator", "Freezer", "Fresh produce", "Cooking basics", "Seasonings"];

  let items = [];
  let userId = null;
  let busy = false;
  let editingId = null;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const parseStores = value => [...new Map(String(value || "").split(",").map(s => s.trim()).filter(Boolean).map(s => [s.toLocaleLowerCase(), s])).values()];

  function setMessage(text = "", isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function setAddOpen(open) {
    addForm.hidden = !open;
    addToggle.setAttribute("aria-expanded", String(open));
    if (open) $("grocery-new-name").focus();
  }

  function renderStoreFilter() {
    const previous = storeFilter.value;
    const names = [...new Set(items.flatMap(item => item.stores || []))].sort((a, b) => a.localeCompare(b));
    storeFilter.replaceChildren(new Option("All stores", ""));
    for (const name of names) storeFilter.add(new Option(name, name));
    storeFilter.value = names.includes(previous) ? previous : "";
  }

  function render() {
    renderStoreFilter();
    const isShopping = currentView === "shopping";
    shoppingTab.classList.toggle("active", isShopping);
    defaultTab.classList.toggle("active", !isShopping);
    shoppingTab.setAttribute("aria-pressed", String(isShopping));
    defaultTab.setAttribute("aria-pressed", String(!isShopping));
    listTitle.textContent = isShopping ? "Shopping List" : "Default List";
    viewDescription.textContent = isShopping
      ? "Only what you need to buy right now."
      : "Everything you normally buy. Check an item to add it to your shopping list.";
    const selectedStore = storeFilter.value;
    const selectedStorage = storageFilter.value;
    const filtered = items.filter(item =>
      (!isShopping || item.needed) &&
      (!selectedStore || (item.stores || []).includes(selectedStore)) &&
      (!selectedStorage || item.storage === selectedStorage)
    );
    count.textContent = `(${filtered.length})`;
    list.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "grocery-empty";
      empty.textContent = !items.length ? "No grocery items yet. Tap + Add item to start." : isShopping ? "Nothing to buy in this view." : "No items match these filters.";
      list.append(empty);
      return;
    }

    for (const category of categories) {
      const inCategory = filtered.filter(item => item.storage === category).sort((a, b) => a.name.localeCompare(b.name));
      if (!inCategory.length) continue;
      const section = document.createElement("section");
      section.className = "grocery-group";
      const heading = document.createElement("h3");
      heading.textContent = category;
      section.append(heading);

      for (const item of inCategory) {
        const row = document.createElement("div");
        row.className = "grocery-item" + (item.needed ? "" : " is-not-needed") + (editingId === item.id ? " is-editing" : "");
        if (editingId === item.id) {
          row.innerHTML = `<form class="grocery-form grocery-edit-form" data-edit-id="${escapeHtml(item.id)}">
            <label>Item name<input type="text" name="name" required maxlength="100" value="${escapeHtml(item.name)}"></label>
            <label>Storage<select name="storage">${categories.map(x => `<option value="${escapeHtml(x)}" ${x === item.storage ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}</select></label>
            <label>Stores (optional, comma-separated)<input type="text" name="stores" maxlength="200" value="${escapeHtml((item.stores || []).join(", "))}"></label>
            <label class="grocery-inline-check"><input type="checkbox" name="needed" ${item.needed ? "checked" : ""}> Need to buy</label>
            <div class="grocery-form-actions"><button class="grocery-primary" type="submit">Save</button><button type="button" data-cancel-edit>Cancel</button></div>
          </form>`;
        } else {
          row.innerHTML = `<input type="checkbox" data-toggle-id="${escapeHtml(item.id)}" aria-label="Need to buy: ${escapeHtml(item.name)}" ${item.needed ? "checked" : ""}>
          <div class="grocery-item-info"><div class="grocery-item-name">${escapeHtml(item.name)}</div>
          <div class="grocery-item-details">${(item.stores || []).length ? escapeHtml(item.stores.join(" · ")) : "Any store / not tagged"}</div></div>
          <div class="grocery-item-actions"><button type="button" data-edit-id="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.name)}">Edit</button><button type="button" data-delete-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name)}">Delete</button></div>`;
        }
        section.append(row);
      }
      list.append(section);
    }
  }

  function client() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) throw new Error("Supabase is not configured. Check config.js and app.js.");
    return supabaseClient;
  }

  async function load() {
    try {
      setMessage("Loading…");
      const { data: authData, error: authError } = await client().auth.getUser();
      if (authError) throw authError;
      userId = authData?.user?.id || null;
      if (!userId) {
        items = [];
        render();
        setMessage("Sign in from Settings to use your grocery list.", true);
        return;
      }
      const { data, error } = await client().from("grocery_items").select("id,name,storage,stores,needed").order("name");
      if (error) throw error;
      items = data || [];
      setMessage("");
      render();
    } catch (error) {
      console.error("Grocery load failed:", error);
      setMessage(`Could not load groceries: ${error.message || error}`, true);
      list.textContent = "Could not load groceries.";
    }
  }

  async function mutate(operation, successText) {
    if (busy) return;
    if (!userId) { setMessage("Sign in from Settings first.", true); return; }
    busy = true;
    try {
      setMessage("Saving…");
      const { error } = await operation();
      if (error) throw error;
      editingId = null;
      await load();
      if (userId) setMessage(successText);
    } catch (error) {
      console.error("Grocery save failed:", error);
      setMessage(`Could not save: ${error.message || error}`, true);
    } finally { busy = false; }
  }

  function values(form) {
    const data = new FormData(form);
    return {
      name: String(data.get("name") || "").trim(),
      storage: String(data.get("storage") || "Shelf-stable"),
      stores: parseStores(data.get("stores")),
      needed: data.has("needed")
    };
  }

  addToggle.addEventListener("click", () => setAddOpen(addForm.hidden));
  $("grocery-add-cancel").addEventListener("click", () => setAddOpen(false));
  addForm.addEventListener("submit", async event => {
    event.preventDefault();
    const item = values(addForm);
    if (!item.name) { setMessage("Enter an item name.", true); return; }
    if (busy) return;
    await mutate(() => client().from("grocery_items").insert({ ...item, user_id: userId }), "Item added.");
    if (!message.classList.contains("error")) { addForm.reset(); setAddOpen(false); }
  });

  shoppingTab.addEventListener("click", () => { currentView = "shopping"; editingId = null; render(); });
  defaultTab.addEventListener("click", () => { currentView = "default"; editingId = null; render(); });

  for (const el of [storeFilter, storageFilter]) el.addEventListener("change", render);

  list.addEventListener("change", event => {
    const checkbox = event.target.closest("[data-toggle-id]");
    if (!checkbox) return;
    const id = checkbox.dataset.toggleId;
    const original = items.find(x => x.id === id);
    if (!original) return;
    const next = checkbox.checked;
    original.needed = next;
    render();
    mutate(() => client().from("grocery_items").update({ needed: next }).eq("id", id), "List updated.");
  });

  list.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-id]");
    const deleteButton = event.target.closest("[data-delete-id]");
    if (event.target.closest("[data-cancel-edit]")) { editingId = null; render(); return; }
    if (editButton && editButton.tagName === "BUTTON") { editingId = editButton.dataset.editId; render(); return; }
    if (deleteButton) {
      const id = deleteButton.dataset.deleteId;
      const item = items.find(x => x.id === id);
      if (!item || !window.confirm(`Delete "${item.name}" from your reusable list?`)) return;
      mutate(() => client().from("grocery_items").delete().eq("id", id), "Item deleted.");
    }
  });

  list.addEventListener("submit", event => {
    const form = event.target.closest("[data-edit-id]");
    if (!form) return;
    event.preventDefault();
    const item = values(form);
    if (!item.name) { setMessage("Enter an item name.", true); return; }
    mutate(() => client().from("grocery_items").update(item).eq("id", form.dataset.editId), "Changes saved.");
  });

  load();
  // Refresh after signing in/out from another tab, when returning to this page.
  window.addEventListener("pageshow", event => { if (event.persisted) load(); });
})();
