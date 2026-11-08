(() => {
  'use strict';

  let CATEGORY_ORDER = [];

  const els = {
    grid: document.getElementById('grid'),
    toc: document.getElementById('toc'),
    search: document.getElementById('search'),
    chips: document.getElementById('categories'),
    count: document.getElementById('count'),
    empty: document.getElementById('empty'),
    dialog: document.getElementById('recipe-dialog'),
    dialogBody: document.getElementById('dialog-body'),
    printRoot: document.getElementById('print-root'),
  };

  let recipes = [];
  let byId = new Map();
  let activeCategory = 'All';
  let openId = null;
  const VIEW_KEY = 'recipe-view';
  let view = (() => { try { return localStorage.getItem(VIEW_KEY) || 'toc'; } catch { return 'toc'; } })();

  const { esc, fullHTML: sharedFullHTML, loadCategories } = window.RecipeRender;

  const ingredientCount = (r) => r.components.reduce((n, c) => n + c.ingredients.length, 0);

  // ---------- Rendering ----------

  function cardHTML(r) {
    const preheat = r.preheatF ? `<span class="badge" title="Preheat oven">${r.preheatF}°F</span>` : '';
    const parts = r.components.filter((c) => c.name).map((c) => esc(c.name));
    const partsLine = parts.length > 1 ? `<p class="card-parts">${parts.join(' · ')}</p>` : '';
    return `
      <article class="card" data-id="${esc(r.id)}">
        <div class="card-top">
          <span class="card-cat">${esc(r.category)}</span>
          ${preheat}
        </div>
        <h2 class="card-title"><a href="#${esc(r.id)}" data-action="open">${esc(r.title)}</a></h2>
        ${r.contributor ? `<p class="card-by">${esc(r.contributor)}</p>` : ''}
        ${partsLine}
        <div class="card-foot">
          <span class="card-meta">${ingredientCount(r)} ingredients</span>
          <button type="button" class="btn btn-small" data-action="print" aria-label="Print ${esc(r.title)}">Print</button>
        </div>
      </article>`;
  }

  const fullHTML = (r, { forPrint = false } = {}) =>
    sharedFullHTML(r, { forPrint, titleId: forPrint ? '' : 'dialog-title' });

  function renderChips() {
    const counts = recipes.reduce((m, r) => m.set(r.category, (m.get(r.category) || 0) + 1), new Map());
    const cats = ['All', ...CATEGORY_ORDER.filter((c) => counts.has(c)),
      ...[...counts.keys()].filter((c) => !CATEGORY_ORDER.includes(c))];
    els.chips.innerHTML = cats.map((c) => `
      <button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === activeCategory}">
        ${esc(c)} <span class="chip-n">${c === 'All' ? recipes.length : counts.get(c)}</span>
      </button>`).join('');
  }

  function matches(r, q) {
    if (activeCategory !== 'All' && r.category !== activeCategory) return false;
    if (!q) return true;
    return r._haystack.includes(q);
  }

  function tocHTML(list) {
    const groups = new Map();
    list.forEach((r) => {
      if (!groups.has(r.category)) groups.set(r.category, []);
      groups.get(r.category).push(r);
    });
    return [...groups].map(([cat, items]) => `
      <section class="toc-section">
        <h2 class="toc-cat">${esc(cat)} <span class="toc-n">${items.length}</span></h2>
        <ul class="toc-list">
          ${items.map((r) => `
            <li>
              <a href="#${esc(r.id)}" data-action="open" data-id="${esc(r.id)}">
                <span class="toc-title">${esc(r.title)}</span>
                <span class="toc-leader" aria-hidden="true"></span>
                <span class="toc-by">${esc(r.contributor || '')}</span>
              </a>
            </li>`).join('')}
        </ul>
      </section>`).join('');
  }

  function renderGrid() {
    const q = els.search.value.trim().toLowerCase();
    const list = recipes.filter((r) => matches(r, q));
    els.grid.hidden = view !== 'cards';
    els.toc.hidden = view !== 'toc';
    if (view === 'cards') els.grid.innerHTML = list.map(cardHTML).join('');
    else els.toc.innerHTML = tocHTML(list);
    els.empty.hidden = list.length > 0;
    els.count.textContent = `${list.length} of ${recipes.length} recipes`;
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === view));
  }

  function setView(next) {
    view = next;
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
    renderGrid();
  }

  // ---------- Dialog ----------

  function openRecipe(id, { pushHash = true } = {}) {
    const r = byId.get(id);
    if (!r) return;
    openId = id;
    els.dialogBody.innerHTML = fullHTML(r);
    if (!els.dialog.open) els.dialog.showModal();
    els.dialog.scrollTop = 0;
    if (pushHash && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  }

  function closeRecipe() {
    if (els.dialog.open) els.dialog.close();
  }

  els.dialog.addEventListener('close', () => {
    openId = null;
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
  });

  // Click on the backdrop closes the dialog
  els.dialog.addEventListener('click', (e) => {
    if (e.target === els.dialog) closeRecipe();
  });

  // ---------- Printing ----------

  function printRecipe(id) {
    const r = byId.get(id);
    if (!r) return;
    els.printRoot.innerHTML = `<article class="recipe-full">${fullHTML(r, { forPrint: true })}</article>`;
    document.body.classList.add('printing');
    const prevTitle = document.title;
    document.title = `${r.title} – Family Recipe Book`; // becomes the default PDF filename
    const cleanup = () => {
      document.body.classList.remove('printing');
      els.printRoot.innerHTML = '';
      document.title = prevTitle;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  // ---------- Events ----------

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      const card = btn.closest('.card');
      if (action === 'open' && btn.dataset.id) { e.preventDefault(); openRecipe(btn.dataset.id); return; }
      if (action === 'open' && card) { e.preventDefault(); openRecipe(card.dataset.id); return; }
      if (action === 'print' && card) { e.stopPropagation(); printRecipe(card.dataset.id); return; }
      if (action === 'print-open' && openId) { printRecipe(openId); return; }
      if (action === 'close') { closeRecipe(); return; }
    }
    // Clicking anywhere else on a card opens it
    const card = e.target.closest('.card');
    if (card && !e.target.closest('button')) openRecipe(card.dataset.id);

    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) { setView(viewBtn.dataset.view); return; }

    const chip = e.target.closest('.chip[data-cat]');
    if (chip) {
      activeCategory = chip.dataset.cat;
      els.chips.querySelectorAll('.chip[data-cat]').forEach((c) => c.setAttribute('aria-pressed', c === chip));
      renderGrid();
    }
  });

  let t;
  els.search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderGrid, 80); });

  window.addEventListener('popstate', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && byId.has(id)) openRecipe(id, { pushHash: false });
    else closeRecipe();
  });

  // ---------- Load ----------

  fetch('data/recipes.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(async (data) => {
      CATEGORY_ORDER = await loadCategories(data);
      const catIndex = (c) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? 99 : i; };
      recipes = data
        .map((r) => ({
          ...r,
          components: r.components || [],
          notes: r.notes || [],
          _haystack: [
            r.title, r.contributor, r.category,
            ...(r.components || []).flatMap((c) => [c.name, ...c.ingredients]),
          ].join(' ').toLowerCase(),
        }))
        .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.title.localeCompare(b.title));
      byId = new Map(recipes.map((r) => [r.id, r]));
      renderChips();
      renderGrid();
      const id = decodeURIComponent(location.hash.slice(1));
      if (id && byId.has(id)) openRecipe(id, { pushHash: false });
    })
    .catch((err) => {
      els.count.textContent = '';
      els.toc.hidden = true;
      els.grid.hidden = false;
      const hint = location.protocol === 'file:'
        ? 'You opened this file directly. Run <code>python3 scripts/build.py</code> and then <code>python3 -m http.server</code> instead.'
        : 'The recipe data wasn\'t built for this deployment. In the repo, check that <strong>Settings → Pages → Source</strong> is set to <strong>GitHub Actions</strong>. Locally, run <code>python3 scripts/build.py</code> first.';
      els.grid.innerHTML = `<p class="empty">Couldn't load recipes (${esc(err.message)}). ${hint}</p>`;
    });
})();
