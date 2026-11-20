// SamOS Kitchen v1.7.9: explicitly confirmed insert/update from timestamped exports.
// Read-only until the user presses Submit AND accepts the confirmation prompt.
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const picker = el('kitchen-import-file');
  const choose = el('kitchen-import-choose');
  const check = el('kitchen-import-check');
  const submit = el('kitchen-import-submit');
  const summary = el('kitchen-import-summary');
  const notes = el('kitchen-import-notes');
  const preview = el('kitchen-import-preview');
  const status = el('kitchen-import-status');
  const selectedName = el('kitchen-import-name');
  if (![picker, choose, check, submit, summary, notes, preview, status, selectedName].every(Boolean)) return;

  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_RECORDS = 500;
  const CATEGORIES = new Set(['Breakfast','Lunch','Dinner','Snackies & Appies','Sides',
    'Sauces, Spices & Condiments','Dessert','Drinks','Bread','Soup','Unknown']);
  const STATUSES = ['Generated', 'Ready', 'Tested', 'Final'];
  const DIFFICULTIES = new Set(['Easy','Medium','Hard','Unknown','N/A']);
  const YES_NO = new Set(['Yes','No','Unknown','N/A']);
  const FIELDS = ['slug','title','status','difficulty','category','servings','prep_time',
    'cook_time','total_time','equipment','tags','meal_prep_friendly','freezer_friendly',
    'last_cooked','author','sources','source_last_updated','ingredients','steps','storage',
    'notes_markdown','canning_method_markdown','original_markdown','source_repo','source_path','review_flags'];
  const TEXT_FIELDS = ['servings','prep_time','cook_time','total_time','last_cooked',
    'author','sources','source_last_updated','notes_markdown','canning_method_markdown',
    'original_markdown','source_repo','source_path'];

  let rows = [], checked = false, busy = false, sessionUser = null;
  function node(tag, text, className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = String(text);
    if (className) n.className = className;
    return n;
  }
  function message(text, error = false) {
    status.textContent = text; status.classList.toggle('error', error);
  }
  function reset() {
    rows = []; checked = false; sessionUser = null;
    summary.textContent = ''; preview.replaceChildren(); notes.replaceChildren();
    check.disabled = true; submit.disabled = true;
  }
  function blocksOK(value) {
    return Array.isArray(value) && value.length > 0 && value.every(block =>
      block && typeof block === 'object' && !Array.isArray(block) &&
      typeof block.heading === 'string' && Array.isArray(block.items) && block.items.length > 0 &&
      block.items.every(item => typeof item === 'string' && item.trim()));
  }
  function validate(recipe) {
    const errors = [];
    if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return ['Not a recipe object'];
    if (typeof recipe.slug !== 'string' || !/^[a-z0-9-]{1,160}$/.test(recipe.slug)) errors.push('Invalid slug');
    if (typeof recipe.title !== 'string' || !recipe.title.trim() || recipe.title.length > 250) errors.push('Invalid title');
    if (!STATUSES.includes(recipe.status)) errors.push('Invalid status');
    if (!DIFFICULTIES.has(recipe.difficulty)) errors.push('Invalid difficulty');
    if (!CATEGORIES.has(recipe.category)) errors.push('Invalid category');
    if (!YES_NO.has(recipe.meal_prep_friendly) || !YES_NO.has(recipe.freezer_friendly)) errors.push('Invalid friendly flag');
    for (const field of TEXT_FIELDS) {
      if (['original_markdown','source_repo','source_path'].includes(field)) {
        if (recipe[field] != null && typeof recipe[field] !== 'string') errors.push(field + ' must be text');
      } else if (typeof recipe[field] !== 'string') errors.push(field + ' must be text');
    }
    if (typeof recipe.original_markdown !== 'string' || !recipe.original_markdown.trim()) errors.push('Original Markdown missing');
    for (const field of ['equipment','tags','review_flags']) {
      if (!Array.isArray(recipe[field]) || !recipe[field].every(v => typeof v === 'string')) errors.push('Invalid ' + field);
    }
    if (!blocksOK(recipe.ingredients)) errors.push('Invalid ingredient groups');
    if (!blocksOK(recipe.steps)) errors.push('Invalid step groups');
    if (!recipe.storage || typeof recipe.storage !== 'object' || Array.isArray(recipe.storage) ||
      !['room_temperature','refrigerated','frozen','canned'].every(k => typeof recipe.storage[k] === 'string')) errors.push('Invalid storage');
    return errors;
  }
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
    return v;
  }
  function sameContent(a, b) {
    return FIELDS.every(field => JSON.stringify(sortKeys(a[field] ?? null)) === JSON.stringify(sortKeys(b[field] ?? null)));
  }
  async function hash(md) {
    if (!crypto?.subtle) throw new Error('Browser cryptography is unavailable; updates are disabled.');
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(md));
    return [...new Uint8Array(buffer)].map(v => v.toString(16).padStart(2,'0')).join('');
  }
  async function getUser() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) throw new Error('Supabase is not configured.');
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error('Sign in from Settings first.');
    return data.user.id;
  }
  async function existingRecords(userId) {
    const found = new Map();
    for (let offset=0; offset<50000; offset+=500) {
      const { data, error } = await supabaseClient.from('recipes').select('*')
        .eq('user_id', userId).order('slug').range(offset, offset + 499);
      if (error) throw error;
      for (const record of data || []) found.set(record.slug, record);
      if (!data || data.length < 500) return found;
    }
    throw new Error('Too many recipes to check safely.');
  }
  function prepared(recipe) {
    return Object.fromEntries(FIELDS.map(key => [key, recipe[key] ?? (['source_repo','source_path'].includes(key) ? null : recipe[key])]));
  }
  function eligible(r) {
    return r.kind === 'new' || r.kind === 'update' || (r.kind === 'conflict' && r.approvedConflict);
  }
  function render() {
    const counts = Object.fromEntries(['new','update','unchanged','conflict','invalid'].map(kind => [kind,rows.filter(r=>r.kind===kind).length]));
    summary.textContent = `${rows.length} recipes · ${counts.new} new · ${counts.update} updated · ${counts.unchanged} unchanged · ${counts.conflict} conflicts · ${counts.invalid} invalid`;
    preview.replaceChildren();
    for (const r of rows) {
      const item = node('li');
      const details = node('details', undefined, 'kitchen-import-recipe-details');
      const label = r.kind.toUpperCase();
      const heading = node('summary');
      heading.append(node('strong', `${r.recipe.title || '(untitled)'} — ${label}`),
        node('span', ` · ${r.recipe.category || '?'} · ${r.recipe.status || '?'} · ${(r.recipe.review_flags || []).length} review note(s)`));
      details.append(heading);
      const body = node('div', undefined, 'kitchen-import-recipe-content');
      if (r.issues.length) {
        body.append(node('h4', r.kind === 'conflict' ? 'Conflict — requires your review' : 'Validation issues'));
        const list = node('ul'); r.issues.forEach(issue=>list.append(node('li',issue))); body.append(list);
      }
      const flags = Array.isArray(r.recipe.review_flags) ? r.recipe.review_flags : [];
      body.append(node('h4', `Review notes (${flags.length})`));
      if (flags.length) {
        const list = node('ul'); flags.forEach(flag => list.append(node('li',flag))); body.append(list);
      } else body.append(node('p','No converter review notes.'));
      if (r.kind === 'conflict') {
        const label = node('label', undefined, 'kitchen-import-conflict-label');
        const box = node('input'); box.type = 'checkbox'; box.checked = !!r.approvedConflict;
        box.addEventListener('change', () => { r.approvedConflict = box.checked; updateButtons(); });
        label.append(box, document.createTextNode(' I reviewed both versions and explicitly approve replacing this Kitchen recipe.'));
        body.append(label);
      }
      if (r.existing?.original_markdown) {
        const original = node('details', undefined, 'kitchen-import-original');
        original.append(node('summary','Current Kitchen Markdown'));
        const md = node('div', undefined, 'kitchen-md');
        window.SAMOS_KITCHEN_MARKDOWN?.renderMarkdown(md, r.existing.original_markdown);
        original.append(md); body.append(original);
      }
      if (r.recipe.original_markdown) {
        const proposed = node('details', undefined, 'kitchen-import-original');
        proposed.append(node('summary','Proposed Markdown'));
        const md = node('div', undefined, 'kitchen-md');
        window.SAMOS_KITCHEN_MARKDOWN?.renderMarkdown(md, r.recipe.original_markdown);
        proposed.append(md); body.append(proposed);
      }
      details.append(body); item.append(details); preview.append(item);
    }
    notes.replaceChildren();
    if (counts.conflict) notes.append(node('p','Conflicts are not selected automatically. Expand each conflict, compare both versions, and explicitly approve replacement if appropriate.'));
    if (counts.invalid) notes.append(node('p','Invalid recipes cannot be submitted.'));
    updateButtons();
  }
  function updateButtons() { submit.disabled = !checked || busy || !rows.some(eligible); }
  choose.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    reset();
    const file = picker.files?.[0];
    if (!file) { selectedName.textContent = 'No file chosen'; return; }
    selectedName.textContent = file.name;
    if (!file.name.toLowerCase().endsWith('.json') || file.size > MAX_FILE_BYTES) {
      message('Choose a JSON file smaller than 20 MB.',true); return;
    }
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data) || !data.length || data.length > MAX_RECORDS)
        throw new Error('Expected 1–500 converted recipes. A deletion-only export does not need importing.');
      const seen = new Set();
      rows = data.map((entry,index) => {
        const recipe = entry?.recipe;
        const issues = validate(recipe);
        if (typeof recipe?.slug === 'string') {
          if (seen.has(recipe.slug)) issues.push('Duplicate slug in JSON file');
          seen.add(recipe.slug);
        }
        const metadata = entry?.preview_metadata || {};
        if (metadata.previous_source_sha256 != null &&
            !/^[a-f0-9]{64}$/.test(metadata.previous_source_sha256)) issues.push('Invalid previous source hash');
        if (metadata.source_sha256 != null &&
            !/^[a-f0-9]{64}$/.test(metadata.source_sha256)) issues.push('Invalid current source hash');
        return { recipe: recipe || {title:`Record ${index+1}`,review_flags:[]}, metadata, issues, kind:issues.length?'invalid':'new', approvedConflict:false, existing:null };
      });
      check.disabled = false;
      summary.textContent = `${rows.length} recipes loaded. Select Preview Changes.`;
      message('File loaded locally. Nothing has been saved.');
    } catch (e) { reset(); message('Cannot read JSON: '+e.message,true); }
  });
  check.addEventListener('click', async () => {
    if (busy || !rows.length) return;
    busy = true; check.disabled = true; submit.disabled = true;
    message('Comparing your recipes with Kitchen…');
    try {
      const userId = await getUser();
      const existing = await existingRecords(userId);
      for (const r of rows) {
        r.approvedConflict = false;
        r.existing = existing.get(r.recipe.slug) || null;
        if (r.issues.length) { r.kind='invalid'; continue; }
        // Validate the local source fingerprint even for new records.
        const newHash = await hash(r.recipe.original_markdown);
        if (r.metadata.source_sha256 && newHash !== r.metadata.source_sha256) {
          r.kind = 'invalid'; r.issues.push('JSON source hash does not match Markdown'); continue;
        }
        if (!r.existing) { r.kind = 'new'; continue; }
        const currentHash = await hash(r.existing.original_markdown || '');
        if (sameContent(prepared(r.recipe),r.existing)) { r.kind='unchanged'; continue; }
        const oldHash = r.metadata.previous_source_sha256;
        const statusDowngrade = STATUSES.indexOf(r.recipe.status) < STATUSES.indexOf(r.existing.status);
        if (oldHash && currentHash === oldHash && !statusDowngrade) {
          r.kind = 'update';
        } else {
          r.kind = 'conflict';
          r.issues.push(statusDowngrade ? 'Recipe status would be downgraded.' :
            'Kitchen differs from the previous exported version (or no trusted baseline is available).');
        }
      }
      checked = true; sessionUser = userId;
      message('Preview ready. Nothing has been saved.'); render();
    } catch (e) { checked=false; message('Preview failed: '+e.message,true); }
    finally { busy=false; check.disabled=false; updateButtons(); }
  });
  submit.addEventListener('click', async () => {
    if (busy || !checked) return;
    const work = rows.filter(eligible);
    if (!work.length) return;
    const newCount = work.filter(r=>r.kind==='new').length;
    const updateCount = work.length-newCount;
    const flagged = work.filter(r=>r.recipe.review_flags.length).length;
    if (!window.confirm(`Save ${newCount} new and ${updateCount} updated recipes?

${flagged} have review notes.

Your current recipes will change only where you approved an update.`)) return;
    busy = true; submit.disabled = true; check.disabled=true; picker.disabled=true; choose.disabled=true;
    let created=0, updated=0, skipped=0; const failures=[];
    try {
      const userId = await getUser();
      if (userId !== sessionUser) throw new Error('Signed-in account changed. Preview again.');
      // Recheck all slugs immediately before writing; never trust stale preview rows.
      const latest = await existingRecords(userId);
      for (const r of work) {
        const current = latest.get(r.recipe.slug) || null;
        const next = { ...prepared(r.recipe), user_id:userId };
        if (r.kind === 'new') {
          if (current) { skipped++; continue; }
          const {error} = await supabaseClient.from('recipes').insert(next);
          if (error) { if (error.code==='23505') skipped++; else failures.push(`${r.recipe.title}: ${error.message}`); }
          else created++;
          continue;
        }
        if (!current || current.id!==r.existing?.id || current.updated_at!==r.existing?.updated_at) {
          failures.push(`${r.recipe.title}: recipe changed since preview; no update applied.`); continue;
        }
        // Extra safety: a changed status or content cannot slip in after preview.
        if (!sameContent(current, r.existing)) {
          failures.push(`${r.recipe.title}: recipe content changed; no update applied.`); continue;
        }
        const {data,error} = await supabaseClient.from('recipes').update(next)
          .eq('user_id',userId).eq('id',current.id).eq('updated_at',current.updated_at).select('id');
        if (error) failures.push(`${r.recipe.title}: ${error.message}`);
        else if (!data || data.length!==1) failures.push(`${r.recipe.title}: concurrent edit detected; no update applied.`);
        else updated++;
      }
      message(`Finished: ${created} added, ${updated} updated, ${skipped} skipped, ${failures.length} failed.${created+updated?' Refresh Kitchen to see changes.':''}`,!!failures.length);
      notes.replaceChildren();
      if (failures.length) {
        notes.append(node('p','Some updates failed; successful changes were not rolled back.'));
        failures.forEach(f => notes.append(node('p',f)));
      }
      if (created+updated) {
        const refresh = node('button','Refresh Kitchen','kitchen-import-refresh');
        refresh.type='button'; refresh.addEventListener('click',()=>window.location.reload()); notes.append(refresh);
      }
      rows=[]; checked=false; sessionUser=null; picker.value=''; check.disabled=true;
    } catch(e) { message('Submit stopped: '+e.message,true); }
    finally { busy=false; picker.disabled=false; choose.disabled=false; submit.disabled=true; }
  });
})();
