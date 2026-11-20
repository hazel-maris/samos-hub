// Safe, small Markdown renderer for recipe notes/callouts and import previews.
// Uses DOM text nodes only: no user-provided HTML is evaluated.
(() => {
  'use strict';
  function inline(container, value) {
    const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*\n]+)\*)/g;
    let start = 0, m;
    while ((m = pattern.exec(value))) {
      if (m.index > start) container.append(document.createTextNode(value.slice(start, m.index)));
      const node = document.createElement(m[2] ? 'strong' : m[3] ? 'code' : m[4] ? 'a' : 'em');
      if (m[4]) {
        node.href = m[5];
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
      }
      node.textContent = m[2] || m[3] || m[4] || m[6];
      container.append(node);
      start = pattern.lastIndex;
    }
    if (start < value.length) container.append(document.createTextNode(value.slice(start)));
  }
  function renderMarkdown(container, markdown) {
    container.replaceChildren();
    const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed) { i++; continue; }
      const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
      if (heading) {
        const h = document.createElement('h' + Math.max(3, Math.min(5, heading[1].length + 1)));
        inline(h, heading[2]); container.append(h); i++; continue;
      }
      if (trimmed.startsWith('>')) {
        const body = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          body.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        const callout = /^\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\]/i.exec(body[0] || '');
        const box = document.createElement('blockquote');
        if (callout) {
          box.className = 'kitchen-md-callout';
          const strong = document.createElement('strong');
          strong.textContent = callout[1].charAt(0).toUpperCase() + callout[1].slice(1).toLowerCase();
          box.append(strong);
          body.shift();
        }
        const p = document.createElement('p');
        // Keep the callout prose together while preserving intentional lines.
        inline(p, body.join(' ').trim());
        box.append(p); container.append(box); continue;
      }
      const listItem = /^(\s*)([-*]|\d+[.)])\s+(.+)$/.exec(raw);
      if (listItem) {
        const ordered = /^\d/.test(listItem[2]);
        const list = document.createElement(ordered ? 'ol' : 'ul');
        while (i < lines.length) {
          const item = /^(\s*)([-*]|\d+[.)])\s+(.+)$/.exec(lines[i]);
          if (!item || /^\d/.test(item[2]) !== ordered) break;
          const li = document.createElement('li'); inline(li, item[3]); list.append(li); i++;
        }
        container.append(list); continue;
      }
      const paragraph = [];
      while (i < lines.length && lines[i].trim() &&
        !/^(#{1,6}\s|>|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) {
        paragraph.push(lines[i].trim()); i++;
      }
      if (!paragraph.length) { i++; continue; }
      const p = document.createElement('p'); inline(p, paragraph.join(' ')); container.append(p);
    }
  }
  window.SAMOS_KITCHEN_MARKDOWN = { renderMarkdown };
})();
