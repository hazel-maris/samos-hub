// SamOS Kitchen: explicit, user-confirmed import of a local converter JSON preview.
// Never uploads files or writes recipes until the user presses Import and confirms.
(() => {
  'use strict';

  const el = id => document.getElementById(id);
  const picker = el('kitchen-import-file');
  const choose = el('kitchen-import-choose');
  const check = el('kitchen-import-check');
  const commit = el('kitchen-import-submit');
  const summary = el('kitchen-import-summary');
  const notes = el('kitchen-import-notes');
  const preview = el('kitchen-import-preview');
  const status = el('kitchen-import-status');
  const selectedName = el('kitchen-import-name');
  if (![picker, choose, check, commit, summary, notes, preview, status, selectedName].every(Boolean)) return;

  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_RECORDS = 500;
  const CATEGORIES = new Set(['Breakfast', 'Lunch', 'Dinner', 'Snackies & Appies', 'Sides',
    'Sauces, Spices & Condiments', 'Dessert', 'Drinks', 'Bread', 'Soup', 'Unknown']);
  const STATUSES = new Set(['Generated', 'Ready', 'Tested', 'Final']);
  const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard', 'Unknown', 'N/A']);
  const YES_NO = new Set(['Yes', 'No', 'Unknown', 'N/A']);
  const FIELDS = ['slug', 'title', 'status', 'difficulty', 'category', 'servings', 'prep_time',
    'cook_time', 'total_time', 'equipment', 'tags', 'meal_prep_friendly', 'freezer_friendly',
    'last_cooked', 'author', 'sources', 'source_last_updated', 'ingredients', 'steps',
    'storage', 'notes_markdown', 'canning_method_markdown', 'original_markdown',
    'source_repo', 'source_path', 'review_flags'];
  const TEXT_FIELDS = ['servings', 'prep_time', 'cook_time', 'total_time', 'last_cooked',
    'author', 'sources', 'source_last_updated', 'notes_markdown', 'canning_method_markdown',
    'original_markdown', 'source_repo', 'source_path'];

  let rows = [];
  let checked = false;
  let busy = false;
  let sessionUser = null;

  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }
  function node(tag, content, className) {
    const item = document.createElement(tag);
    if (content !== undefined) item.textContent = String(content);
    if (className) item.className = className;
    return item;
  }
  function clearReview() {
    rows = [];
    checked = false;
    sessionUser = null;
    summary.textContent = '';
    preview.replaceChildren();
    notes.replaceChildren();
    commit.disabled = true;
    check.disabled = true;
  }
  function validBlocks(value) {
    return Array.isArray(value) && value.length > 0 && value.every(b => b &&
      typeof b === 'object' && !Array.isArray(b) &&
      typeof b.heading === 'string' && Array.isArray(b.items) && b.items.length > 0 &&
      b.items.every(item => typeof item === 'string' && item.trim().length > 0));
  }
  function validate(raw) {
    const problems = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['Not a recipe object'];
    if (typeof raw.slug !== 'string' || !/^[a-z0-9-]{1,160}$/.test(raw.slug)) problems.push('Invalid slug');
    if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 250) problems.push('Invalid title');
    if (!STATUSES.has(raw.status)) problems.push('Invalid status');
    if (!DIFFICULTIES.has(raw.difficulty)) problems.push('Invalid difficulty');
    if (!CATEGORIES.has(raw.category)) problems.push('Invalid category');
    if (!YES_NO.has(raw.meal_prep_friendly) || !YES_NO.has(raw.freezer_friendly)) problems.push('Invalid friendly flag');
    for (const field of TEXT_FIELDS) {
      if (field === 'original_markdown' || field === 'source_repo' || field === 'source_path') {
        if (raw[field] !== null && raw[field] !== undefined && typeof raw[field] !== 'string') problems.push(field + ' must be text');
      } else if (typeof raw[field] !== 'string') problems.push(field + ' must be text');
    }
    if (typeof raw.original_markdown !== 'string' || !raw.original_markdown.trim()) problems.push('Original Markdown missing');
    for (const field of ['equipment', 'tags', 'review_flags']) {
      if (!Array.isArray(raw[field]) || !raw[field].every(item => typeof item === 'string')) problems.push('Invalid ' + field);
    }
    if (!validBlocks(raw.ingredients)) problems.push('Invalid or empty ingredient groups');
    if (!validBlocks(raw.steps)) problems.push('Invalid or empty step groups');
    if (!raw.storage || typeof raw.storage !== 'object' || Array.isArray(raw.storage) ||
        !['room_temperature', 'refrigerated', 'frozen', 'canned'].every(key => typeof raw.storage[key] === 'string'))
      problems.push('Invalid storage fields');
    return problems;
  }
  function render() {
    const ready = rows.filter(r => r.kind === 'ready');
    const exists = rows.filter(r => r.kind === 'exists');
    const invalid = rows.filter(r => r.kind === 'invalid');
    const flagged = ready.filter(r => r.recipe.review_flags.length).length;
    summary.textContent = `${rows.length} recipes · ${ready.length} new · ${exists.length} already in Kitchen · ${invalid.length} invalid · ${flagged} new with review notes`;
    preview.replaceChildren();
    for (const r of rows) {
      const item = node('li');
      const label = r.kind === 'ready' ? 'NEW' : r.kind === 'exists' ? 'SKIP (already exists)' : 'INVALID';
      item.append(node('strong', `${r.recipe.title || '(untitled)'} — ${label}`));
      const extra = r.kind === 'invalid' ? r.issues.join('; ') :
        `${r.recipe.category} · ${r.recipe.status} · ${r.recipe.review_flags.length} review note(s)`;
      item.append(node('span', ` · ${extra}`));
      preview.append(item);
    }
    notes.replaceChildren();
    if (invalid.length) notes.append(node('p', 'Invalid recipes cannot be imported. Correct their conversion issues before retrying.'));
    if (flagged) notes.append(node('p', 'Some new recipes contain converter review notes. Inspect the original recipe and review report before importing, especially variations and canning instructions.'));
    if (exists.length) notes.append(node('p', 'Existing recipes are never overwritten. Matching is by recipe slug for your signed-in account.'));
    commit.disabled = !checked || !ready.length || busy;
  }
  async function getUser() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) throw new Error('Supabase is not configured.');
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error('Sign in from Settings first.');
    return data.user.id;
  }
  async function getExisting(userId) {
    // Read full set with pagination; do not silently treat an incomplete result as a clean slate.
    const slugs = new Set();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseClient.from('recipes').select('slug')
        .eq('user_id', userId).order('slug').range(offset, offset + 499);
      if (error) throw error;
      for (const item of data || []) slugs.add(item.slug);
      if (!data || data.length < 500) break;
      if (offset >= 50000) throw new Error('Too many existing recipes to check safely.');
    }
    return slugs;
  }
  function preparedRecipe(raw) {
    // Discard wrapper metadata and unknown fields. Only writable schema columns are sent.
    return Object.fromEntries(FIELDS.map(key => [key, raw[key] ?? (key === 'source_repo' || key === 'source_path' ? null : raw[key])]));
  }

  choose.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    clearReview();
    const file = picker.files?.[0];
    if (!file) { selectedName.textContent = 'No file chosen'; return; }
    selectedName.textContent = file.name;
    if (!file.name.toLowerCase().endsWith('.json') || file.size > MAX_FILE_BYTES) {
      message('Choose a .json file smaller than 20 MB.', true); return;
    }
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data) || !data.length || data.length > MAX_RECORDS) throw new Error('Expected an array of 1–500 conversion preview records.');
      const seen = new Set();
      rows = data.map((entry, index) => {
        const recipe = entry?.recipe;
        const issues = validate(recipe);
        if (recipe && seen.has(recipe.slug)) issues.push('Duplicate slug in selected file');
        if (recipe && typeof recipe.slug === 'string') seen.add(recipe.slug);
        return { recipe: recipe || { title: `Record ${index + 1}`, review_flags: [] }, issues, kind: issues.length ? 'invalid' : 'ready' };
      });
      const invalid = rows.filter(r => r.kind === 'invalid').length;
      summary.textContent = `${rows.length} recipes loaded · ${invalid} invalid. Check signed-in account for duplicates.`;
      check.disabled = false;
      preview.replaceChildren();
      notes.replaceChildren();
      message('File loaded locally. Click “Check existing recipes” to finish previewing.');
    } catch (error) {
      clearReview();
      message('Cannot read this JSON: ' + error.message, true);
    }
  });

  check.addEventListener('click', async () => {
    if (busy || !rows.length) return;
    busy = true;
    check.disabled = true;
    commit.disabled = true;
    message('Checking Kitchen for matching recipe slugs…');
    try {
      const userId = await getUser();
      const existing = await getExisting(userId);
      sessionUser = userId;
      for (const r of rows) r.kind = r.issues.length ? 'invalid' : existing.has(r.recipe.slug) ? 'exists' : 'ready';
      checked = true;
      message('Preview ready. Nothing has been imported.');
    } catch (error) {
      checked = false;
      message('Could not check duplicates: ' + error.message, true);
    } finally {
      busy = false;
      check.disabled = false;
      render();
    }
  });

  commit.addEventListener('click', async () => {
    if (busy || !checked) return;
    const ready = rows.filter(r => r.kind === 'ready');
    if (!ready.length) return;
    const flagged = ready.filter(r => r.recipe.review_flags.length).length;
    const answer = window.confirm(`Import up to ${ready.length} NEW recipes into your private Kitchen?\n\n${flagged} contain converter review notes. Existing recipes will be skipped; no existing records will be overwritten.\n\nThis writes to Supabase and cannot be undone automatically.`);
    if (!answer) return;
    busy = true;
    commit.disabled = true;
    check.disabled = true;
    picker.disabled = true;
    choose.disabled = true;
    let inserted = 0, skipped = 0;
    const failures = [];
    try {
      const currentUser = await getUser();
      if (currentUser !== sessionUser) throw new Error('Signed-in account changed. Reload and recheck your import.');
      // Recheck right before writing to handle repeated imports and concurrent sessions.
      const existing = await getExisting(currentUser);
      for (const r of ready) {
        if (existing.has(r.recipe.slug)) { skipped++; continue; }
        const record = { ...preparedRecipe(r.recipe), user_id: currentUser };
        const { error } = await supabaseClient.from('recipes').insert(record);
        if (error) {
          if (error.code === '23505') { skipped++; existing.add(r.recipe.slug); continue; }
          failures.push(`${r.recipe.title}: ${error.message}`);
        } else { inserted++; existing.add(r.recipe.slug); }
      }
      message(`Finished: ${inserted} imported, ${skipped} skipped, ${failures.length} failed.${inserted ? ' Refresh Kitchen to see your recipes.' : ''}`, !!failures.length);
      notes.replaceChildren();
      if (failures.length) {
        notes.append(node('p', 'Some inserts failed. Successful inserts are not automatically rolled back.'));
        failures.forEach(text => notes.append(node('p', text)));
      }
      if (inserted) {
        const reload = node('button', 'Refresh Kitchen', 'kitchen-import-refresh');
        reload.type = 'button';
        reload.addEventListener('click', () => window.location.reload());
        notes.append(reload);
      }
      // Force an explicit new file selection/duplicate check before any next write.
      checked = false;
      rows = [];
      picker.value = '';
      check.disabled = true;
      commit.disabled = true;
    } catch (error) {
      message('Import stopped: ' + error.message, true);
    } finally {
      busy = false;
      picker.disabled = false;
      choose.disabled = false;
      commit.disabled = true;
    }
  });
})();