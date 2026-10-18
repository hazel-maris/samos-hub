// SamOS Hub — Groceries v3: two-column desktop + collapsible sections
// Default List: public.grocery_defaults (permanent library)
// Shopping List: public.grocery_items (temporary, needed=true)
// Uses the existing authenticated supabaseClient and HTML controls.
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
  const count = $("grocery-count");
  const categories = ["Shelf-stable", "Refrigerator", "Freezer", "Fresh produce", "Cooking basics", "Seasonings"];

  let currentView = "shopping";
  let defaults = [];
  let shopping = [];
  let userId = null;
  let busy = false;
  let editingId = null;
  const collapsedByView = { shopping: new Set(), default: new Set() };
  const collapsed = () => collapsedByView[currentView];

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const parseStores = value => [...new Map(String(value || "").split(",").map(s => s.trim()).filter(Boolean).map(s => [s.toLocaleLowerCase(), s])).values()];
  const sameName = (a, b) => String(a || "").trim().toLocaleLowerCase() === String(b || "").trim().toLocaleLowerCase();
  const currentItems = () => currentView === "shopping" ? shopping : defaults;
  const currentTable = () => currentView === "shopping" ? "grocery_items" : "grocery_defaults";
  const shoppingMatches = name => shopping.filter(row => sameName(row.name, name));

  function setMessage(text = "", isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function setAddOpen(open) {
    addForm.hidden = !open;
    addToggle.setAttribute("aria-expanded", String(open));
    if (open) $("grocery-new-name")?.focus();
  }

  function renderStoreFilter() {
    const previous = storeFilter.value;
    const names = [...new Set(currentItems().flatMap(item => item.stores || []))].sort((a, b) => a.localeCompare(b));
    storeFilter.replaceChildren(new Option("All stores", ""));
    for (const name of names) storeFilter.add(new Option(name, name));
    storeFilter.value = names.includes(previous) ? previous : "";
  }

  function render() {
    renderStoreFilter();
    const isShopping = currentView === "shopping";
    const items = currentItems();
    shoppingTab.classList.toggle("active", isShopping);
    defaultTab.classList.toggle("active", !isShopping);
    shoppingTab.setAttribute("aria-pressed", String(isShopping));
    defaultTab.setAttribute("aria-pressed", String(!isShopping));
    listTitle.textContent = isShopping ? "Shopping List" : "Default List";
    viewDescription.textContent = isShopping
      ? "Only what you need to buy right now. Uncheck to remove an item."
      : "Everything you normally buy. Check an item to add it to your shopping list.";

    const selectedStore = storeFilter.value;
    const selectedStorage = storageFilter.value;
    const filtered = items.filter(item =>
      (!selectedStore || (item.stores || []).includes(selectedStore)) &&
      (!selectedStorage || item.storage === selectedStorage)
    );
    count.textContent = `(${filtered.length})`;
    list.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "grocery-empty";
      empty.textContent = !items.length
        ? (isShopping ? "Nothing on your shopping list yet." : "No default groceries yet. Tap + Add item to start.")
        : (isShopping ? "Nothing to buy in this view." : "No items match these filters.");
      list.append(empty);
      return;
    }

    for (const category of categories) {
      const inCategory = filtered.filter(item => item.storage === category).sort((a, b) => a.name.localeCompare(b.name));
      if (!inCategory.length) continue;
      const section = document.createElement("section");
      section.className = "grocery-group";
      const heading = document.createElement("h3");
      const collapsedNow = collapsed().has(category);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "grocery-section-toggle";
      toggle.dataset.collapseCategory = category;
      toggle.setAttribute("aria-expanded", String(!collapsedNow));
      toggle.innerHTML = `<span class="grocery-section-chevron" aria-hidden="true">${collapsedNow ? "▸" : "▾"}</span><span>${escapeHtml(category)}</span><span class="grocery-section-count">${inCategory.length}</span>`;
      heading.append(toggle);
      section.append(heading);
      section.classList.toggle("is-collapsed", collapsedNow);
      if (collapsedNow) { list.append(section); continue; }

      for (const item of inCategory) {
        const selected = isShopping || shoppingMatches(item.name).length > 0;
        const row = document.createElement("div");
        row.className = "grocery-item" + (selected ? "" : " is-not-needed") + (editingId === item.id ? " is-editing" : "");
        if (editingId === item.id) {
          row.innerHTML = `<form class="grocery-form grocery-edit-form" data-edit-id="${escapeHtml(item.id)}">
            <label>Item name<input type="text" name="name" required maxlength="100" value="${escapeHtml(item.name)}"></label>
            <label>Storage<select name="storage">${categories.map(x => `<option value="${escapeHtml(x)}" ${x === item.storage ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}</select></label>
            <label>Stores (optional, comma-separated)<input type="text" name="stores" maxlength="200" value="${escapeHtml((item.stores || []).join(", "))}"></label>
            <div class="grocery-form-actions"><button class="grocery-primary" type="submit">Save</button><button type="button" data-cancel-edit>Cancel</button></div>
          </form>`;
        } else {
          row.innerHTML = `<input type="checkbox" data-toggle-id="${escapeHtml(item.id)}" aria-label="${isShopping ? "Remove from shopping list" : "Add to shopping list"}: ${escapeHtml(item.name)}" ${selected ? "checked" : ""}>
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
        defaults = [];
        shopping = [];
        render();
        setMessage("Sign in from Settings to use your grocery list.", true);
        return false;
      }
      const [defaultResult, shoppingResult] = await Promise.all([
        client().from("grocery_defaults").select("id,name,storage,stores").order("name"),
        client().from("grocery_items").select("id,name,storage,stores,needed").eq("needed", true).order("name")
      ]);
      if (defaultResult.error) throw defaultResult.error;
      if (shoppingResult.error) throw shoppingResult.error;
      defaults = defaultResult.data || [];
      shopping = shoppingResult.data || [];
      render();
      setMessage("");
      return true;
    } catch (error) {
      console.error("Grocery load failed:", error);
      setMessage(`Could not load groceries: ${error.message || error}`, true);
      list.textContent = "Could not load groceries.";
      return false;
    }
  }

  async function mutate(operation, successText) {
    if (busy) return false;
    if (!userId) { setMessage("Sign in from Settings first.", true); return false; }
    busy = true;
    try {
      setMessage("Saving…");
      const result = await operation();
      if (result?.error) throw result.error;
      editingId = null;
      const loaded = await load();
      if (loaded) setMessage(successText);
      return loaded;
    } catch (error) {
      console.error("Grocery save failed:", error);
      setMessage(`Could not save: ${error.message || error}`, true);
      await load();
      setMessage(`Could not save: ${error.message || error}`, true);
      return false;
    } finally { busy = false; }
  }

  function values(form) {
    const data = new FormData(form);
    return {
      name: String(data.get("name") || "").trim(),
      storage: String(data.get("storage") || "Shelf-stable"),
      stores: parseStores(data.get("stores"))
    };
  }

  // Add to shopping once by name, without duplicating an existing shopping entry.
  async function addToShopping(item) {
    if (shoppingMatches(item.name).length) return { error: null };
    // Older grocery_items records may exist with needed=false.
    // Reuse them rather than inserting another copy of the same grocery.
    const existing = await client().from("grocery_items")
      .select("id,name").eq("user_id", userId);
    if (existing.error) return existing;
    const prior = (existing.data || []).find(row => sameName(row.name, item.name));
    if (prior) {
      return client().from("grocery_items").update({ needed: true })
        .eq("id", prior.id).eq("user_id", userId);
    }
    return client().from("grocery_items").insert({
      user_id: userId, name: item.name, storage: item.storage,
      stores: item.stores || [], needed: true
    });
  }

  async function removeFromShopping(name) {
    // Matches are scoped to the authenticated user as an extra safeguard.
    const matches = shoppingMatches(name);
    if (!matches.length) return { error: null };
    return client().from("grocery_items").delete()
      .eq("user_id", userId).in("id", matches.map(item => item.id));
  }

  addToggle.addEventListener("click", () => setAddOpen(addForm.hidden));
  $("grocery-add-cancel").addEventListener("click", () => setAddOpen(false));
  addForm.addEventListener("submit", async event => {
    event.preventDefault();
    const item = values(addForm);
    if (!item.name) { setMessage("Enter an item name.", true); return; }
    const succeeded = await mutate(async () => {
      if (currentView === "shopping") return addToShopping(item);
      return client().from("grocery_defaults").insert({ ...item, user_id: userId });
    }, "Item added.");
    if (succeeded) { addForm.reset(); setAddOpen(false); }
  });

  function switchView(view) {
    currentView = view;
    editingId = null;
    // A form left open should not accidentally add to the other tab.
    setAddOpen(false);
    storeFilter.value = "";
    render();
  }
  shoppingTab.addEventListener("click", () => switchView("shopping"));
  defaultTab.addEventListener("click", () => switchView("default"));
  for (const el of [storeFilter, storageFilter]) el.addEventListener("change", render);

  list.addEventListener("change", event => {
    const checkbox = event.target.closest("[data-toggle-id]");
    if (!checkbox || busy) return;
    const item = currentItems().find(x => x.id === checkbox.dataset.toggleId);
    if (!item) return;
    const inShopping = currentView === "shopping";
    // Default: checked=add, unchecked=remove. Shopping: unchecked=remove.
    mutate(() => (inShopping || !checkbox.checked)
      ? removeFromShopping(item.name)
      : addToShopping(item), "List updated.");
  });

  $("grocery-collapse-all").addEventListener("click", () => {
    for (const category of categories) collapsed().add(category);
    editingId = null;
    render();
  });
  $("grocery-expand-all").addEventListener("click", () => {
    collapsed().clear();
    render();
  });

  list.addEventListener("click", event => {
    const categoryButton = event.target.closest("[data-collapse-category]");
    if (categoryButton) {
      const category = categoryButton.dataset.collapseCategory;
      if (collapsed().has(category)) collapsed().delete(category);
      else collapsed().add(category);
      editingId = null;
      render();
      return;
    }
    const editButton = event.target.closest("[data-edit-id]");
    const deleteButton = event.target.closest("[data-delete-id]");
    if (event.target.closest("[data-cancel-edit]")) { editingId = null; render(); return; }
    if (editButton && editButton.tagName === "BUTTON") { editingId = editButton.dataset.editId; render(); return; }
    if (deleteButton && !busy) {
      const item = currentItems().find(x => x.id === deleteButton.dataset.deleteId);
      if (!item) return;
      const defaultView = currentView === "default";
      const prompt = defaultView
        ? `Delete "${item.name}" from your permanent default list? (Any shopping-list copy will remain.)`
        : `Remove "${item.name}" from your shopping list?`;
      if (!window.confirm(prompt)) return;
      const table = currentTable();
      mutate(() => client().from(table).delete().eq("id", item.id).eq("user_id", userId), "Item deleted.");
    }
  });

  list.addEventListener("submit", event => {
    const form = event.target.closest("form[data-edit-id]");
    if (!form) return;
    event.preventDefault();
    const item = values(form);
    if (!item.name) { setMessage("Enter an item name.", true); return; }
    const table = currentTable();
    mutate(() => client().from(table).update(item).eq("id", form.dataset.editId).eq("user_id", userId), "Changes saved.");
  });

  load();
  window.addEventListener("pageshow", event => { if (event.persisted) load(); });
})();
