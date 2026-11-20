// SamOS Kitchen: recognize standardized recipe tags as removable filter chips.
// Update CATALOG_TAGS when the private SamOS Recipe Dictionary changes.
(() => {
  'use strict';
  const input = document.getElementById('kitchen-tag-input');
  const chips = document.getElementById('kitchen-tag-chips');
  const reference = document.getElementById('kitchen-tag-reference');
  const feedback = document.getElementById('kitchen-tag-feedback');
  if (![input, chips, reference, feedback].every(Boolean)) return;

  const CATALOG_TAGS = [
    'agua-fresca', 'boba', 'horchata', 'tea',
    'beginner-friendly', 'canning', 'comfort-food', 'leftover-friendly',
    'make-ahead', 'one-pot', 'overnight-prep', 'quick', 'no-chill', 'vegetarian',
    'american', 'british-inspired', 'french-inspired', 'hispanic',
    'hispanic-inspired', 'indian-inspired', 'italian-american',
    'italian-inspired', 'japanese', 'mexican', 'mexican-inspired',
    'puerto-rican', 'us-philadelphia-inspired', 'us-southern', 'us-southern-inspired',
    'air-fried', 'baked', 'deep-fried', 'flambe', 'instant-pot',
    'no-cook', 'pan-fried', 'stovetop', 'rice', 'bread'
  ];
  const normalize = value => String(value || '').toLowerCase().trim().replace(/\s+/g, '-');
  let known = new Set(CATALOG_TAGS);
  let selected = new Set();
  const notify = () => window.dispatchEvent(new Event('samos-kitchen-tag-filter'));

  function showChips() {
    chips.replaceChildren();
    for (const tag of selected) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'kitchen-tag-chip';
      chip.textContent = `${tag} ×`;
      chip.setAttribute('aria-label', `Remove tag ${tag}`);
      chip.addEventListener('click', () => {
        selected.delete(tag);
        showChips();
        notify();
        input.focus();
      });
      chips.append(chip);
    }
  }
  function showReference() {
    reference.replaceChildren();
    for (const tag of [...known].sort()) {
      const item = document.createElement('span');
      item.className = 'kitchen-tag-reference-item';
      item.textContent = tag;
      reference.append(item);
    }
  }
  function updateRecognition() {
    const recognized = known.has(normalize(input.value));
    input.classList.toggle('kitchen-tag-recognized', recognized);
    feedback.textContent = recognized ? 'Recognized — press Enter to add.' : '';
  }
  function addTag(value) {
    const tag = normalize(value);
    if (!tag) return;
    if (!known.has(tag)) {
      feedback.textContent = `“${tag}” is not in the tag reference.`;
      return;
    }
    selected.add(tag);
    input.value = '';
    updateRecognition();
    showChips();
    notify();
  }
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(input.value);
    } else if (event.key === 'Backspace' && !input.value && selected.size) {
      const tag = [...selected].at(-1);
      selected.delete(tag);
      showChips();
      notify();
    }
  });
  input.addEventListener('input', () => {
    const values = input.value.split(/[,;]/);
    if (values.length > 1) {
      input.value = values.pop();
      values.forEach(addTag);
    }
    updateRecognition();
  });
  input.addEventListener('blur', () => {
    if (known.has(normalize(input.value))) addTag(input.value);
  });
  window.SAMOS_KITCHEN_TAGS = {
    matches(recipe) {
      const recipeTags = new Set((Array.isArray(recipe.tags) ? recipe.tags : []).map(normalize));
      return [...selected].every(tag => recipeTags.has(tag));
    }
  };
  window.addEventListener('samos-kitchen-recipes', event => {
    const additional = (event.detail || []).flatMap(recipe =>
      Array.isArray(recipe.tags) ? recipe.tags.map(normalize) : []);
    known = new Set([...CATALOG_TAGS, ...additional.filter(Boolean)]);
    showReference();
    updateRecognition();
  });
  showReference();
})();
