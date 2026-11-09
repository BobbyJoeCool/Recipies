// Shared rendering used by both the cookbook (app.js) and the add-a-recipe page (add.js).
window.RecipeRender = (() => {
  'use strict';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Labels for recipe tags. Replaced by data/tags.json when loadTags() runs.
  let TAG_LABELS = { sourdough: 'Sourdough', 'high-protein': 'High protein' };
  const tagLabel = (t) => TAG_LABELS[t] || t;
  const tagBadgesHTML = (tags, cls = '') => (tags && tags.length)
    ? `<div class="badges ${cls}">${tags.map((t) => `<span class="badge badge-tag" data-tag="${esc(t)}">${esc(tagLabel(t))}</span>`).join('')}</div>`
    : '';

  function fullHTML(r, { forPrint = false, titleId = '' } = {}) {
    const idAttr = titleId ? ` id="${titleId}"` : '';
    const meta = [
      r.contributor ? `<span>From ${esc(r.contributor)}</span>` : '',
    ].filter(Boolean).join('');
    const preheat = r.preheatF ? `<span class="badge badge-preheat">Preheat oven to ${r.preheatF}°F</span>` : '';
    const top = (r.category || preheat) ? `
      <div class="full-top">
        ${r.category ? `<p class="full-cat">${esc(r.category)}</p>` : ''}
        ${preheat}
      </div>` : '';

    const comps = (r.components || []).map((c) => `
      <section class="component">
        ${c.name ? `<h3 class="component-name">${esc(c.name)}</h3>` : ''}
        <div class="component-body">
          ${c.ingredients.length ? `
            <div class="ingredients">
              <h4>Ingredients</h4>
              <ul>${c.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
            </div>` : ''}
          ${c.directions.length ? `
            <div class="directions">
              <h4>Directions</h4>
              <ol>${c.directions.map((d) => `<li>${esc(d)}</li>`).join('')}</ol>
            </div>` : ''}
        </div>
      </section>`).join('');

    const notes = (r.notes || []).length
      ? `<aside class="notes">${r.notes.map((n) => `<p><strong>Note:</strong> ${esc(n)}</p>`).join('')}</aside>`
      : '';

    return `
      ${top}
      <h2 class="full-title"${idAttr}>${esc(r.title)}</h2>
      ${meta ? `<p class="full-meta">${meta}</p>` : ''}
      ${tagBadgesHTML(r.tags, 'full-tags')}
      ${comps}
      ${notes}
      ${forPrint ? '<p class="print-footer">Family Recipe Book</p>' : ''}`;
  }

  // Loads the generated category list; falls back to the categories found in the recipes.
  async function loadCategories(recipes = []) {
    try {
      const res = await fetch('data/categories.json');
      if (res.ok) return await res.json();
    } catch (_) { /* fall through */ }
    return [...new Set(recipes.map((r) => r.category))];
  }

  // Loads the generated tag labels ({ key: label }); keeps the defaults if missing.
  async function loadTags() {
    try {
      const res = await fetch('data/tags.json');
      if (res.ok) TAG_LABELS = await res.json();
    } catch (_) { /* keep defaults */ }
    return { ...TAG_LABELS };
  }

  return { esc, fullHTML, loadCategories, loadTags, tagLabel, tagBadgesHTML };
})();
