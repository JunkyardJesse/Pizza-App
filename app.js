(function () {
  const C = window.PizzaCalc;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const LS_RECIPES = 'pizza.recipes', LS_DRAFT = 'pizza.draft';

  /* ---------- storage ---------- */
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { alert('Could not save: storage is full or blocked.'); } };

  const dbp = new Promise((res, rej) => {
    const q = indexedDB.open('pizza', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('photos');
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
  const idb = async (mode, fn) => { const db = await dbp; return new Promise((res, rej) => {
    const st = db.transaction('photos', mode).objectStore('photos'); const r = fn(st);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
  const putPhoto = (id, blob) => idb('readwrite', s => s.put(blob, id));
  const getPhoto = (id) => idb('readonly', s => s.get(id));
  const delPhoto = (id) => idb('readwrite', s => s.delete(id));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const merge = (base, over) => {
    if (!over || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
    const out = { ...base };
    for (const k in over) out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : over[k];
    return out;
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- state ---------- */
  let recipes = lsGet(LS_RECIPES, []);
  let r = merge(C.defaults(), lsGet(LS_DRAFT, null) || {});
  const urls = {};

  const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };

  function fillInputs() {
    $$('[data-k]').forEach(el => {
      const v = getPath(r, el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = el.value === v;
      else el.value = v ?? '';
    });
  }

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'hydroRange') { r.hydration = +el.value; $('[data-k=hydration]').value = r.hydration; return update(); }
    if (!el.dataset.k) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'radio' && !el.checked) return;
    if ('n' in el.dataset) v = el.value === '' ? '' : +el.value;
    setPath(r, el.dataset.k, v);
    update();
  });

  /* ---------- outputs ---------- */
  const pctFmt = (n, dp = 2) => (+n.toFixed(dp)).toString();
  const row = (label, pct, g, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="p">${pct === null ? '' : pctFmt(pct, label.startsWith('Yeast') ? 3 : 2) + '%'}</td><td class="g">${C.fmt(g)}</td></tr>`;
  const sec = (t) => `<tr class="sub"><td colspan="3">${t}</td></tr>`;

  function update() {
    const c = C.compute(r), fe = r.ferment;
    const pfName = r.pf.type === 'sourdough' ? 'Sourdough starter' : 'Poolish';

    $('#ballsFields').hidden = r.scaleBy !== 'balls';
    $('#flourField').hidden = r.scaleBy !== 'flour';
    $('#pfFields').hidden = !c.hasPf;
    $('#pfYeastField').hidden = r.pf.type !== 'poolish';
    $('#pfTempField').hidden = !c.hasPf;
    ['salt', 'oil', 'sugar'].forEach(k => $(`[data-ing=${k}]`).classList.toggle('off', !r[k].on));
    $('#hydroRange').value = r.hydration;

    let h = '<table><thead><tr><th></th><th>% flour</th><th>grams</th></tr></thead>';
    const P = c.pct, F = c.final, T = c.totals;
    const pctOfTotal = (g) => (T.flour ? g / T.flour * 100 : 0);
    if (c.hasPf) {
      h += sec(pfName);
      h += row('Flour', pctOfTotal(c.pf.flour), c.pf.flour) + row('Water', pctOfTotal(c.pf.water), c.pf.water);
      if (c.pf.yeast > 0) h += row('Yeast', pctOfTotal(c.pf.yeast), c.pf.yeast);
      h += sec('Final mix');
      h += row(pfName, null, c.pf.total);
      h += row('Flour', pctOfTotal(F.flour), F.flour) + row('Water', pctOfTotal(F.water), F.water);
    } else {
      h += sec('Mix');
      h += row('Flour', 100, F.flour) + row('Water', P.water, F.water);
    }
    if (r.salt.on) h += row('Salt', P.salt, F.salt);
    if (r.oil.on) h += row('Oil', P.oil, F.oil);
    if (r.sugar.on) h += row('Sugar', P.sugar, F.sugar);
    h += row('Yeast', pctOfTotal(F.yeast), F.yeast);
    h += sec('Whole formula');
    h += row('Flour', 100, T.flour) + row('Water', P.water, T.water);
    if (r.salt.on) h += row('Salt', P.salt, T.salt);
    if (r.oil.on) h += row('Oil', P.oil, T.oil);
    if (r.sugar.on) h += row('Sugar', P.sugar, T.sugar);
    h += row('Yeast', P.yeast, T.yeast);
    h += row('Dough', null, T.dough, 'tot') + '</table>';
    $('#weights').innerHTML = h;
    $('#warnings').innerHTML = c.warnings.map(w => `<p class="warn">⚠ ${w}</p>`).join('');
    $('#weightsHint').textContent = r.scaleBy === 'flour' && c.ballWeight && r.balls
      ? `${C.fmt(c.ballWeight, 1)} g per ball at ${r.balls} balls` : '';

    $('#hydroHint').textContent = c.hasPf && c.finalHydration !== null
      ? `Total ${pctFmt(r.hydration, 1)}% · ${pfName.toLowerCase()} carries ${C.fmt(c.pf.water, 1)} g of water · final mix alone ${C.fmt(c.finalHydration, 1)}% of the added flour`
      : `${C.fmt(T.water, 1)} g water for ${C.fmt(T.flour, 1)} g flour`;

    $('#coldLabel').textContent = `${fe.coldDays} day${+fe.coldDays === 1 ? '' : 's'} at ${fe.fridge}°C`;
    const b = C.bulkHours(r);
    $('#bulkOut').textContent = b.hours === null ? '–' : (b.over ? 'none needed' : '≈ ' + C.fmtHours(b.hours));
    $('#bulkHint').className = 'hint' + (b.over || b.longHours ? ' warn' : '');
    $('#bulkHint').textContent = b.hours === null ? 'Enter a yeast amount.'
      : b.over ? `At ${fe.room}°C this much yeast already over-ferments in the fridge alone. Use less yeast or a shorter cold ferment.`
      : b.longHours ? 'Very long counter time. Consider more yeast or a warmer room.'
      : `Counter at ${fe.room}°C before balling and going in the fridge, with ${C.fmt(C.effectiveYeast(r), 3)}% effective yeast${r.pf.type === 'sourdough' ? ' (incl. starter)' : ''}.`;

    const w = C.waterTemp(r);
    $('#waterTemp').textContent = `${C.fmt(w.temp, 1)} °C`;
    $('#waterHint').className = 'hint' + (w.temp < 1 || w.temp > 43 ? ' warn' : '');
    $('#waterHint').textContent = w.temp < 1 ? 'Colder than tap water can give. Use ice, or aim for a warmer dough.'
      : w.temp > 43 ? 'Too hot, it would harm the yeast. Cool the flour/pre-ferment or aim for a lower dough temp.'
      : `Desired × ${w.factors} − (flour${c.hasPf ? ' + pre-ferment' : ''} + room + friction). Room temp is shared with Fermentation.`;

    lsSet(LS_DRAFT, r);
  }

  $('#suggestBtn').onclick = () => {
    const y = C.suggestYeast(r);
    if (y === null) return;
    r.yeast = y; $('[data-k=yeast]').value = y; update();
  };

  /* ---------- photos ---------- */
  async function renderPhotos() {
    const box = $('#photos'); box.innerHTML = '';
    for (const id of r.photos) {
      const blob = await getPhoto(id); if (!blob) continue;
      const url = urls[id] ||= URL.createObjectURL(blob);
      const d = document.createElement('div');
      d.innerHTML = `<img src="${url}" alt="Pizza photo"><button aria-label="Remove photo">×</button>`;
      $('img', d).onclick = () => openBox(url);
      $('button', d).onclick = async () => { if (!confirm('Remove this photo?')) return;
        r.photos = r.photos.filter(x => x !== id); await delPhoto(id); delete urls[id]; persistIfSaved(); update(); renderPhotos(); };
      box.append(d);
    }
  }
  function openBox(url) { const l = $('#lightbox'); l.innerHTML = `<img src="${url}">`; l.hidden = false; l.onclick = () => l.hidden = true; }

  async function shrink(file, max = 1280) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = bmp.width * s; cv.height = bmp.height * s;
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise(res => cv.toBlob(res, 'image/jpeg', 0.82));
  }
  $('#photoInput').onchange = async (e) => {
    for (const f of e.target.files) { const id = uid(); await putPhoto(id, await shrink(f)); r.photos.push(id); }
    e.target.value = ''; persistIfSaved(); update(); renderPhotos();
  };

  /* ---------- recipes ---------- */
  const isSaved = () => r.id && recipes.some(x => x.id === r.id);
  function persistIfSaved() { if (isSaved()) save(true); }
  function save(quiet) {
    if (!r.id) r.id = uid();
    if (!r.name.trim()) r.name = `${r.style || 'Pizza'} ${C.fmt(r.hydration, 1).replace(/\.0$/, '')}% – ${new Date().toLocaleDateString()}`;
    r.updated = Date.now(); r.created ||= r.updated;
    const i = recipes.findIndex(x => x.id === r.id);
    if (i >= 0) recipes[i] = clone(r); else recipes.push(clone(r));
    lsSet(LS_RECIPES, recipes); fillInputs(); update(); renderRecipes();
    if (!quiet) { const m = $('#saveMsg'); m.textContent = 'Saved ✓'; setTimeout(() => m.textContent = '', 2000); }
  }
  $('#saveBtn').onclick = () => save();

  function load(rec, asCopy) {
    r = merge(C.defaults(), clone(rec));
    if (asCopy) { r.id = null; r.created = null; r.photos = []; r.name += ' (copy)'; }
    fillInputs(); update(); renderPhotos(); showTab('calc'); scrollTo(0, 0);
  }
  $('#newBtn').onclick = () => { r = C.defaults(); fillInputs(); update(); renderPhotos(); scrollTo(0, 0); };

  async function renderRecipes() {
    const q = $('#search').value.toLowerCase();
    $('#recipeCount').textContent = recipes.length ? `(${recipes.length})` : '';
    const list = [...recipes].sort((a, b) => b.updated - a.updated)
      .filter(x => !q || `${x.name} ${x.style} ${x.notes}`.toLowerCase().includes(q));
    const box = $('#recipeList'); box.innerHTML = list.length ? '' : '<p class="hint">No recipes yet. Build one on the Calculator tab and press Save.</p>';
    for (const rec of list) {
      const c = C.compute(merge(C.defaults(), rec)), pid = rec.photos?.[0];
      let thumb = '<div class="ph">🍕</div>';
      if (pid) { const b = await getPhoto(pid); if (b) thumb = `<img src="${urls[pid] ||= URL.createObjectURL(b)}" alt="">`; }
      const d = document.createElement('div'); d.className = 'rcard';
      const pf = rec.pf.type === 'none' ? '' : ` · ${rec.pf.type} ${rec.pf.pct}%`;
      d.innerHTML = `${thumb}<div class="meta"><b></b><small>${rec.style || ''} · ${rec.hydration}% hydration${pf} · yeast ${rec.yeast}% · ${rec.ferment.coldDays}d cold<br>${new Date(rec.updated).toLocaleDateString()}</small><div class="note"></div></div>
        <div class="acts"><button class="small" data-a="copy">Copy</button><button class="small" data-a="del">Delete</button></div>`;
      $('b', d).textContent = rec.name; $('.note', d).textContent = rec.notes || '';
      d.onclick = (e) => {
        const a = e.target.dataset.a;
        if (a === 'del') { if (confirm(`Delete "${rec.name}"?`)) { recipes = recipes.filter(x => x.id !== rec.id); (rec.photos || []).forEach(delPhoto); lsSet(LS_RECIPES, recipes); renderRecipes(); } }
        else load(rec, a === 'copy');
      };
      box.append(d);
    }
  }
  $('#search').oninput = renderRecipes;

  /* ---------- backup ---------- */
  const b64 = (blob) => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(blob); });
  $('#exportBtn').onclick = async () => {
    const photos = {};
    for (const rec of recipes) for (const id of rec.photos || []) { const b = await getPhoto(id); if (b) photos[id] = await b64(b); }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ recipes, photos })], { type: 'application/json' }));
    a.download = `pizza-recipes-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  $('#importInput').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      for (const [id, url] of Object.entries(data.photos || {})) await putPhoto(id, await (await fetch(url)).blob());
      for (const rec of data.recipes) { const i = recipes.findIndex(x => x.id === rec.id); if (i >= 0) recipes[i] = rec; else recipes.push(rec); }
      lsSet(LS_RECIPES, recipes); renderRecipes(); alert(`Imported ${data.recipes.length} recipes.`);
    } catch { alert('That file is not a valid backup.'); }
    e.target.value = '';
  };

  /* ---------- tabs ---------- */
  function showTab(t) {
    $$('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    $('#tab-calc').hidden = t !== 'calc'; $('#tab-recipes').hidden = t !== 'recipes';
    $('.savebar').hidden = t !== 'calc';
    if (t === 'recipes') renderRecipes();
  }
  $$('nav button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

  fillInputs(); update(); renderPhotos(); renderRecipes();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
