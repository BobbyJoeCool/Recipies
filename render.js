// Shared rendering used by both the cookbook (app.js) and the add-a-recipe page (add.js).
window.RecipeRender = (() => {
  'use strict';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fullHTML(r, { forPrint = false, titleId = '' } = {}) {
    const idAttr = titleId ? ` id="${titleId}"` : '';
    const meta = [
      r.contributor ? `<span>From ${esc(r.contributor)}</span>` : '',
      r.preheatF ? `<span class="preheat">Preheat oven to ${r.preheatF}°F</span>` : '',
    ].filter(Boolean).join('');

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
      ${r.category ? `<p class="full-cat">${esc(r.category)}</p>` : ''}
      <h2 class="full-title"${idAttr}>${esc(r.title)}</h2>
      ${meta ? `<p class="full-meta">${meta}</p>` : ''}
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

  return { esc, fullHTML, loadCategories };
})();
