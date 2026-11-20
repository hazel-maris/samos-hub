// SamOS Kitchen — authenticated, read-only recipe browser.
// No imports, writes, status transitions, or external recipe fetching.
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const list = $("kitchen-list");
  const message = $("kitchen-message");
  const search = $("kitchen-search");
  const category = $("kitchen-category");
  const status = $("kitchen-status");
  const count = $("kitchen-count");
  let recipes = [];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }
  function appendText(parent, tag, text, className) {
    const node = element(tag, className, text);
    parent.append(node);
    return node;
  }
  function setMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }
  function label(value) {
    return value == null || value === "" ? "Unknown" : String(value);
  }
  function makeSection(parent, title) {
    appendText(parent, "h3", title);
    return parent;
  }
  function addList(parent, items, ordered) {
    const ul = element(ordered ? "ol" : "ul");
    items.forEach(value => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const text = value.text ?? value.instruction ?? value.name ?? value.ingredient ?? value.value;
        if (text != null) appendText(ul, "li", text);
      } else if (value != null) appendText(ul, "li", value);
    });
    if (ul.childElementCount) parent.append(ul);
  }
  function renderBlocks(parent, blocks, ordered) {
    if (!Array.isArray(blocks) || !blocks.length) {
      appendText(parent, "p", "Not recorded yet.");
      return;
    }
    let ungrouped = [];
    function flush() {
      if (ungrouped.length) addList(parent, ungrouped, ordered);
      ungrouped = [];
    }
    blocks.forEach(block => {
      if (block && typeof block === "object" && !Array.isArray(block) && Array.isArray(block.items)) {
        flush();
        if (block.heading) appendText(parent, "h4", block.heading);
        addList(parent, block.items, ordered);
      } else {
        ungrouped.push(block);
      }
    });
    flush();
  }
  function detail(parent, labelText, value) {
    appendText(parent, "span", labelText + ": " + label(value));
  }
  function renderRecipe(recipe) {
    const card = element("details", "kitchen-card");
    const summary = element("summary");
    const main = element("div");
    appendText(main, "div", recipe.title, "kitchen-card-title");
    const meta = element("div", "kitchen-card-meta");
    appendText(meta, "span", label(recipe.category));
    appendText(meta, "span", label(recipe.difficulty) + " effort");
    appendText(meta, "span", "Total: " + label(recipe.total_time));
    appendText(meta, "span", label(recipe.status), "kitchen-status-pill");
    main.append(meta);
    summary.append(main);
    card.append(summary);

    const body = element("div", "kitchen-card-content");
    const stats = element("div", "kitchen-detail-grid");
    detail(stats, "Servings", recipe.servings);
    detail(stats, "Prep", recipe.prep_time);
    detail(stats, "Cook", recipe.cook_time);
    detail(stats, "Author", recipe.author);
    detail(stats, "Last cooked", recipe.last_cooked);
    body.append(stats);

    makeSection(body, "Ingredients");
    renderBlocks(body, recipe.ingredients, false);
    makeSection(body, "Steps");
    renderBlocks(body, recipe.steps, true);

    if (recipe.equipment?.length) {
      makeSection(body, "Equipment");
      appendText(body, "p", recipe.equipment.join(", "));
    }
    if (recipe.tags?.length) {
      makeSection(body, "Tags");
      const tags = element("div", "kitchen-tags");
      recipe.tags.forEach(tag => appendText(tags, "span", tag, "kitchen-tag"));
      body.append(tags);
    }

    makeSection(body, "Storage");
    const storage = recipe.storage && typeof recipe.storage === "object" && !Array.isArray(recipe.storage) ? recipe.storage : {};
    const storageLabels = [
      ["room_temperature", "Room temperature"],
      ["refrigerated", "Refrigerated"],
      ["frozen", "Frozen"],
      ["canned", "Canned"]
    ];
    storageLabels.forEach(([key, title]) => {
      const p = element("p");
      appendText(p, "strong", title + ": ");
      p.append(document.createTextNode(label(storage[key])));
      body.append(p);
    });
    if (recipe.sources && recipe.sources !== "Unknown") {
      makeSection(body, "Sources");
      appendText(body, "p", recipe.sources, "kitchen-text-block");
    }
    if (recipe.notes_markdown) {
      makeSection(body, "Notes");
      appendText(body, "p", recipe.notes_markdown, "kitchen-text-block");
    }
    if (recipe.canning_method_markdown) {
      makeSection(body, "Canning Method");
      appendText(body, "p", recipe.canning_method_markdown, "kitchen-text-block");
    }
    if (Array.isArray(recipe.review_flags) && recipe.review_flags.length) {
      makeSection(body, "Needs review");
      addList(body, recipe.review_flags, false);
    }
    card.append(body);
    return card;
  }
  function renderCategories() {
    const selected = category.value;
    const values = [...new Set(recipes.map(row => row.category || "Unknown"))].sort((a, b) => a.localeCompare(b));
    category.replaceChildren(new Option("All categories", ""));
    values.forEach(value => category.add(new Option(value, value)));
    category.value = values.includes(selected) ? selected : "";
  }
  function searchable(recipe) {
    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.flatMap(block => block && typeof block === "object" && Array.isArray(block.items) ? block.items : [block])
      : [];
    const toText = value => value && typeof value === "object" ? Object.values(value).join(" ") : String(value ?? "");
    return [recipe.title, recipe.category, recipe.author, ...(recipe.tags || []), ...ingredients.map(toText)]
      .join(" ").toLocaleLowerCase();
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const filtered = recipes.filter(recipe =>
      (!query || searchable(recipe).includes(query)) &&
      (!category.value || recipe.category === category.value) &&
      (!status.value || recipe.status === status.value)
    );
    count.textContent = "(" + filtered.length + ")";
    list.replaceChildren();
    if (!recipes.length) {
      appendText(list, "div", "Your recipe book is ready! No recipes are in Supabase yet. Your original Markdown recipes are still safe in the private SamOS vault. We'll import them in a separate step.", "kitchen-empty");
    } else if (!filtered.length) {
      appendText(list, "div", "No recipes match those filters. Try another search or category.", "kitchen-empty");
    } else {
      filtered.forEach(recipe => list.append(renderRecipe(recipe)));
    }
  }
  async function load() {
    try {
      if (typeof supabaseClient === "undefined" || !supabaseClient) throw new Error("Supabase isn't configured.");
      const { data: authData, error: authError } = await supabaseClient.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) {
        recipes = [];
        renderCategories();
        render();
        list.replaceChildren(element("div", "kitchen-empty", "Sign in from Settings to view your recipe book."));
        setMessage("Sign in to use Kitchen.");
        return;
      }
      const { data, error } = await supabaseClient
        .from("recipes")
        .select("id,title,category,status,difficulty,total_time,prep_time,cook_time,servings,author,last_cooked,ingredients,steps,equipment,tags,storage,sources,notes_markdown,canning_method_markdown,review_flags")
        .eq("user_id", userId)
        .order("title", { ascending: true })
        .limit(1000);
      if (error) throw error;
      recipes = data || [];
      renderCategories();
      render();
      setMessage(recipes.length ? "Recipes are ready to browse." : "");
    } catch (error) {
      console.error("Kitchen load failed:", error);
      recipes = [];
      renderCategories();
      list.replaceChildren(element("div", "kitchen-empty", "Could not load the recipe book. Please check your connection or sign in again."));
      count.textContent = "";
      setMessage("Could not load recipes: " + (error.message || String(error)), true);
    }
  }

  search.addEventListener("input", render);
  category.addEventListener("change", render);
  status.addEventListener("change", render);
  $("kitchen-expand-all").addEventListener("click", () => list.querySelectorAll("details").forEach(card => { card.open = true; }));
  $("kitchen-collapse-all").addEventListener("click", () => list.querySelectorAll("details").forEach(card => { card.open = false; }));
  load();
})();
