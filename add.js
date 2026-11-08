(() => {
  'use strict';

  const CFG = window.SITE_CONFIG || {};
  const { esc, fullHTML, loadCategories } = window.RecipeRender;
  const DRAFT_KEY = 'recipe-draft-v1';

  const form = document.getElementById('add-form');
  const partsEl = document.getElementById('parts');
  const partTpl = document.getElementById('part-template');
  const previewEl = document.getElementById('preview');
  const errorsEl = document.getElementById('errors');
  const statusEl = document.getElementById('status');

  let mode = 'recipe';
  let existingIds = new Set();

  // ---------- Helpers ----------

  const slugify = (s) =>
    String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const BULLET = /^\s*(?:[-*•·]|\(?\d+[.)]|step\s*\d+[:.)-]?)\s*/i;
  const lines = (text, { stripNumbers = false } = {}) =>
    String(text || '').split(/\r?\n/)
      .map((l) => (stripNumbers ? l.replace(BULLET, '') : l.replace(/^\s*[-*•·]\s*/, '')).trim())
      .filter(Boolean);

  const val = (name) => (form.elements[name]?.value || '').trim();
  const today = () => new Date().toISOString().slice(0, 10);

  function uniqueId(base, suffixSource) {
    if (!base) return '';
    if (!existingIds.has(base)) return base;
    const extra = slugify(String(suffixSource || '').split(/\s+/).pop());
    let id = extra ? `${base}-${extra}` : `${base}-2`;
    let n = 2;
    while (existingIds.has(id)) id = `${base}-${extra || 'v'}-${n++}`;
    return id;
  }

  // ---------- Parts (multi-part recipes) ----------

  function addPart(data = {}) {
    const node = partTpl.content.firstElementChild.cloneNode(true);
    node.querySelector('[name=partName]').value = data.name || '';
    node.querySelector('[name=ingredients]').value = data.ingredients || '';
    node.querySelector('[name=directions]').value = data.directions || '';
    partsEl.appendChild(node);
    syncParts();
    return node;
  }

  function syncParts() {
    const parts = [...partsEl.querySelectorAll('.part')];
    const multi = parts.length > 1;
    parts.forEach((p) => {
      p.querySelector('.part-head').hidden = !multi;
      p.querySelector('.remove-part').hidden = !multi;
    });
  }

  function readParts() {
    return [...partsEl.querySelectorAll('.part')].map((p) => ({
      name: p.querySelector('[name=partName]').value.trim(),
      ingredients: p.querySelector('[name=ingredients]').value,
      directions: p.querySelector('[name=directions]').value,
    }));
  }

  // ---------- Build the submission ----------

  function buildRecipe() {
    const title = val('title');
    const submittedBy = val('submittedBy');
    const contributor = val('contributor') || submittedBy || null;
    const parts = readParts();
    const multi = parts.length > 1;
    const preheatRaw = val('preheatF');
    return {
      id: uniqueId(slugify(title), contributor),
      title,
      category: val('category'),
      contributor,
      preheatF: preheatRaw ? Number(preheatRaw) : null,
      components: parts.map((p) => ({
        name: multi ? (p.name || null) : null,
        ingredients: lines(p.ingredients),
        directions: lines(p.directions, { stripNumbers: true }),
      })),
      notes: lines(val('notes')),
    };
  }

  function buildInboxItem() {
    const title = val('title');
    const id = slugify(title);
    return {
      id,
      title,
      type: mode, // "link" | "file"
      submittedBy: val('submittedBy'),
      submitted: today(),
      link: mode === 'link' ? val('link') : null,
      file: mode === 'file' ? `${id}.pdf` : null,
      notes: lines(mode === 'link' ? val('linkNotes') : val('fileNotes')),
    };
  }

  function validate() {
    const errs = [];
    if (!val('title')) errs.push('Give the recipe a name.');
    if (!val('submittedBy')) errs.push('Add your name so Bob knows who sent it.');
    if (mode === 'recipe') {
      const r = buildRecipe();
      if (!r.category) errs.push('Pick a category.');
      if (r.preheatF !== null && !(Number.isInteger(r.preheatF) && r.preheatF >= 150 && r.preheatF <= 550)) {
        errs.push('Oven temperature should be a number between 150 and 550, or blank.');
      }
      r.components.forEach((c, i) => {
        const label = r.components.length > 1 ? `Part ${i + 1}` : 'The recipe';
        if (!c.ingredients.length) errs.push(`${label} needs at least one ingredient.`);
        if (!c.directions.length) errs.push(`${label} needs at least one step.`);
        if (r.components.length > 1 && !c.name) errs.push(`Give part ${i + 1} a name (like "Cake" or "Frosting").`);
      });
    } else if (mode === 'link') {
      try {
        const u = new URL(val('link'));
        if (!/^https?:$/.test(u.protocol)) throw new Error();
      } catch { errs.push('Paste the full link, starting with https://'); }
    }
    return errs;
  }

  // ---------- Email text ----------

  function recipeText(r) {
    const out = [r.title.toUpperCase()];
    const meta = [
      `Category: ${r.category}`,
      r.contributor && `Recipe by: ${r.contributor}`,
      r.preheatF && `Preheat: ${r.preheatF}°F`,
    ].filter(Boolean).join('  |  ');
    out.push(meta, '');
    r.components.forEach((c) => {
      if (c.name) out.push(`== ${c.name} ==`);
      out.push('Ingredients:', ...c.ingredients.map((i) => `  - ${i}`), '');
      out.push('Directions:', ...c.directions.map((d, i) => `  ${i + 1}. ${d}`), '');
    });
    if (r.notes.length) out.push('Notes:', ...r.notes.map((n) => `  - ${n}`), '');
    return out.join('\n');
  }

  function composeEmail() {
    const who = val('submittedBy');
    if (mode === 'recipe') {
      const r = buildRecipe();
      const fileJson = JSON.stringify({ $schema: '../recipe.schema.json', ...r }, null, 2);
      return {
        subject: `Recipe: ${r.title} (from ${who})`,
        body: [
          `${who} sent a recipe for the Family Recipe Book.`, '',
          recipeText(r),
          `----- For Bob: save everything below as recipes/${r.id}.json -----`,
          fileJson,
        ].join('\n'),
        fileName: `${r.id}.json`,
        fileJson,
      };
    }
    const item = buildInboxItem();
    const itemJson = JSON.stringify(item, null, 2);
    const isFile = mode === 'file';
    return {
      subject: `${isFile ? 'Recipe file' : 'Recipe link'}: ${item.title} (from ${who})`,
      body: [
        `${who} sent a recipe ${isFile ? 'file' : 'link'} to type up later.`, '',
        `Recipe: ${item.title}`,
        isFile ? '(The PDF or photo is attached to this email.)' : `Link: ${item.link}`,
        ...(item.notes.length ? ['', 'Notes:', ...item.notes.map((n) => `  - ${n}`)] : []),
        '',
        isFile
          ? `----- For Bob: save the attachment as inbox/${item.id}.pdf (or .jpg/.png, and change "file" to match), and everything below as inbox/${item.id}.json -----`
          : `----- For Bob: save everything below as inbox/${item.id}.json -----`,
        itemJson,
      ].join('\n'),
    };
  }

  // ---------- UI ----------

  function setMode(next) {
    mode = next;
    form.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.mode === mode));
    document.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== mode; });
    form.elements.link.required = mode === 'link';
    document.getElementById('send').textContent = 'Email it to Bob';
    clearMessages();
    update();
  }

  function clearMessages() {
    errorsEl.hidden = true;
    errorsEl.innerHTML = '';
    statusEl.textContent = '';
  }

  function showErrors(errs) {
    errorsEl.innerHTML = `<p>Almost there:</p><ul>${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
    errorsEl.hidden = false;
    errorsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderPreview() {
    if (mode !== 'recipe') return;
    const r = buildRecipe();
    const shown = {
      ...r,
      title: r.title || 'Recipe name',
      components: r.components.map((c, i) => ({
        ...c,
        name: c.name || (r.components.length > 1 ? `Part ${i + 1}` : null),
        ingredients: c.ingredients.length ? c.ingredients : ['Ingredients show up here'],
        directions: c.directions.length ? c.directions : ['Steps show up here'],
      })),
    };
    previewEl.innerHTML = fullHTML(shown);
  }

  // ---------- Draft (this device only) ----------

  function saveDraft() {
    const fields = {};
    ['title', 'submittedBy', 'category', 'preheatF', 'contributor', 'notes', 'link', 'linkNotes', 'fileNotes']
      .forEach((n) => { fields[n] = form.elements[n]?.value || ''; });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, fields, parts: readParts() })); } catch { /* storage unavailable */ }
  }

  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d) return false;
      Object.entries(d.fields || {}).forEach(([n, v]) => { if (form.elements[n]) form.elements[n].value = v; });
      partsEl.innerHTML = '';
      (d.parts?.length ? d.parts : [{}]).forEach(addPart);
      setMode(d.mode || 'recipe');
      return true;
    } catch { return false; }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  function update() {
    renderPreview();
    saveDraft();
    // Once errors are showing, keep them current as people fix things.
    if (!errorsEl.hidden) {
      const errs = validate();
      if (errs.length) errorsEl.querySelector('ul').innerHTML = errs.map((e) => `<li>${esc(e)}</li>`).join('');
      else errorsEl.hidden = true;
    }
  }

  // ---------- Actions ----------

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearMessages();
    const errs = validate();
    if (errs.length) return showErrors(errs);
    if (!CFG.submitEmail) {
      return showErrors(['This page isn\'t set up to send email yet. Use Copy and send it to Bob another way.']);
    }
    const { subject, body } = composeEmail();
    const url = `mailto:${CFG.submitEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
    window.location.href = url;
    statusEl.innerHTML = mode === 'file'
      ? 'Your email app should open with everything filled in. <strong>Attach the PDF or photo</strong>, then send. Afterwards, tap <strong>Start over</strong>.'
      : 'Your email app should open with everything filled in. Just hit send, then tap <strong>Start over</strong>.' +
        (url.length > 1900 ? ' <span class="hint">(If the email looks cut off, tap <strong>Copy</strong> and paste it in instead.)</span>' : '');
  });

  document.getElementById('copy').addEventListener('click', async () => {
    clearMessages();
    const errs = validate();
    if (errs.length) return showErrors(errs);
    const { subject, body } = composeEmail();
    const ok = await copyText(`Subject: ${subject}\n\n${body}`);
    statusEl.textContent = ok
      ? `Copied. Paste it into an email or text to Bob${CFG.submitEmail ? ` (${CFG.submitEmail})` : ''}.`
      : 'Couldn\'t copy automatically. Select the preview and copy it by hand.';
  });

  document.getElementById('download').addEventListener('click', () => {
    clearMessages();
    const errs = validate();
    if (errs.length) return showErrors(errs);
    const { fileName, fileJson } = composeEmail();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([fileJson + '\n'], { type: 'application/json' }));
    a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    statusEl.textContent = `Downloaded ${fileName}. It goes in the recipes/ folder.`;
  });

  document.getElementById('clear').addEventListener('click', () => {
    if (!confirm('Clear the form and start a new one?')) return;
    clearDraft();
    form.reset();
    partsEl.innerHTML = '';
    addPart();
    setMode('recipe');
  });

  document.getElementById('add-part').addEventListener('click', () => {
    const node = addPart();
    node.querySelector('[name=partName]').focus();
    update();
  });

  partsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-part');
    if (!btn) return;
    btn.closest('.part').remove();
    syncParts();
    update();
  });

  form.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
  form.addEventListener('input', update);
  form.addEventListener('change', update);

  // ---------- Inbox list ----------

  function renderInbox(items) {
    if (!items.length) return;
    document.getElementById('inbox-list').innerHTML = items.map((it) => {
      const target = it.link
        ? `<a href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>`
        : it.file ? `<a href="inbox/${esc(it.file)}" target="_blank" rel="noopener">Open file ↗</a>` : '';
      return `<li>
        <div><strong>${esc(it.title)}</strong> <span class="hint">from ${esc(it.submittedBy)}, ${esc(it.submitted)}</span></div>
        ${it.notes?.length ? `<div class="hint">${it.notes.map(esc).join(' · ')}</div>` : ''}
        <div>${target}</div>
      </li>`;
    }).join('');
    document.getElementById('inbox').hidden = false;
  }

  // ---------- Init ----------

  (async () => {
    let recipes = [];
    try {
      const res = await fetch('data/recipes.json');
      if (res.ok) recipes = await res.json();
    } catch { /* offline or file:// — duplicates just won't be detected */ }
    existingIds = new Set(recipes.map((r) => r.id));

    const cats = await loadCategories(recipes);
    form.elements.category.innerHTML = '<option value="">Choose one…</option>' +
      cats.map((c) => `<option>${esc(c)}</option>`).join('');

    if (!loadDraft()) { addPart(); setMode('recipe'); }

    try {
      const res = await fetch('data/inbox.json');
      if (res.ok) renderInbox(await res.json());
    } catch { /* no inbox yet */ }
  })();
})();
