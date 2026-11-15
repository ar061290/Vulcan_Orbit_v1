// Shared helpers: DOM builder, data loading, status stamps, cards, empty states, number formats,
// the shared tooltip, URL state, form controls and the one polite live region.
// Frozen interface: site/REBUILD_PLAN.md §2.1.

const flat = kids => kids.flat(Infinity).filter(k => k != null && k !== false);
const node = k => (k.nodeType ? k : document.createTextNode(String(k)));

/** DOM builder. null/false/undefined attributes and children are dropped, so `cond ? el : null` never prints "null". */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if ((k.startsWith('aria-') || k.startsWith('data-')) && typeof v === 'boolean') { el.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of flat(kids)) el.append(node(kid));
  return el;
}
/** Append children with the same filtering as h(). Returns the parent. */
export function add(parent, ...kids) { for (const kid of flat(kids)) parent.append(node(kid)); return parent; }

// ---------- data ----------
const cache = new Map();
function fetchJSON(url) {
  if (!cache.has(url)) cache.set(url, (async () => {
    try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : { status: 'missing' }; }
    catch { return { status: 'missing' }; }
  })());
  return cache.get(url);
}
/** True when data/manifest.json loads and says data/<name>.json does not exist: the name is not listed, or its line has
 *  status 'missing' (AGENTS.md rule 5: every data file gets its manifest line in the same commit). If the manifest itself
 *  is missing or broken, nothing is skipped. This keeps expected 404s (response_trials, cv_latest…) out of the console. */
async function notInManifest(name) {
  if (name === 'manifest') return false;
  const m = await fetchJSON('data/manifest.json');
  if (!m || !Array.isArray(m.files)) return false;
  const line = m.files.find(f => f && f.name === name);
  return !line || line.status === 'missing';
}
/** data/<name>.json, cached once per name. A missing or broken file returns {status:'missing'}. A file the manifest
 *  marks as missing (or does not list) is not fetched and also returns {status:'missing'}. */
export async function load(name) {
  if (await notInManifest(name)) return { status: 'missing' };
  const out = await fetchJSON(`data/${name}.json`);
  if (out && typeof out === 'object' && !Array.isArray(out)) out.status ||= 'missing';
  return out;
}
/** Any relative path, e.g. 'models/m6b-predictor/results.json'. A missing or broken file returns {status:'missing'}.
 *  A file that loads but has no status of its own (the models/*\/results.json files) is returned as it is, without
 *  a status, so it is not mistaken for a missing file. */
export async function loadPath(relPath) { return fetchJSON(relPath); }
export const isMissing = d => !d || d.status === 'missing';

// ---------- status stamps ----------
export const STATUS = {
  real: { label: 'NASA data', title: 'Loaded from a NASA dataset we downloaded ourselves.' },
  dome: { label: 'Dome data', title: 'Measured on our own rig.' },
  model: { label: 'Model output', title: 'Computed by a model we ran ourselves. "Made by" says how it was built and checked.' },
  reported: { label: 'Reported, unverified', title: 'Taken from a paper or another team\'s write-up. Check against the NASA source before relying on it.' },
  demo: { label: 'Demo data', title: 'Placeholder numbers so the layout can be built. Must be replaced before submission.' },
  plan: { label: 'Plan, not built', title: 'Planned work. Nothing here is a result.' },
  team: { label: 'Team choice', title: 'A choice the team made, such as a rule, a wording or a layout. It is not a measurement.' },
  missing: { label: 'No data yet', title: 'Waiting for this file.' },
  scrapped: { label: 'Scrapped (see plan v2)', title: 'Dropped in plan v2. Kept on the page so nothing disappears without a trace.' },
};
export function badge(status) {
  const s = STATUS[status] || { label: String(status), title: '' };
  const cls = status === 'real' || status === 'dome' || status === 'model' ? 'real' : status;
  return h('span', { class: `badge ${cls}`, 'data-status': status, title: s.title || null }, s.label);
}

/** A figure card: h2 = title + stamp, optional sub line, then the body. */
export const card = (title, status, sub, ...body) =>
  h('section', { class: 'card', 'data-title': typeof title === 'string' ? title : null },
    h('h2', {}, title, status ? badge(status) : null),
    sub ? h('div', { class: 'sub' }, sub) : null, ...body);

/** Empty state that tells the next person exactly which file to drop in and what shape it has. */
export const empty = (title, file, why, schema) =>
  h('div', { class: 'empty' }, h('h3', {}, title), why ? h('p', {}, why) : null,
    h('p', {}, 'Drop in ', h('code', {}, `data/${file}.json`), ' and this panel fills itself.', schema ? ' Expected shape:' : null),
    schema ? h('pre', {}, schema) : null);

// ---------- numbers ----------
export const fmt = (v, d = 1) => (v == null || Number.isNaN(Number(v)) ? 'n/a' : Number(v).toLocaleString('en', { maximumFractionDigits: d }));
export const sig = (v, n = 3) => (v == null || !Number.isFinite(Number(v)) ? 'n/a' : String(Number(Number(v).toPrecision(n))));
export const pct = (x, d = 0) => `${(100 * x).toFixed(d)}%`;
export const rng = (lo, hi, f = fmt, sep = '–') => `${f(lo)}${sep}${f(hi)}`;

export const page = (title, lead, ...body) => h('div', { class: 'page' }, h('h1', {}, title), lead ? h('p', { class: 'lead' }, lead) : null, ...body);

// ---------- shared tooltip (#tip, aria-hidden; keyboard values are announced through #live by charts.keyNav) ----------
const tipEl = () => document.getElementById('tip');
/** target: a PointerEvent (placed at the pointer), an Element (placed under it) or {x, y} in client pixels. */
export function tip(target, html) {
  const t = tipEl(); if (!t) return;
  t.innerHTML = html; t.hidden = false;
  let x, y;
  if (target && typeof target.clientX === 'number') { x = target.clientX + 14; y = target.clientY + 14; }
  else if (target && typeof target.getBoundingClientRect === 'function') { const r = target.getBoundingClientRect(); x = r.left + r.width / 2 + 8; y = r.bottom + 8; }
  else if (target && typeof target.x === 'number') { x = target.x + 14; y = target.y + 14; }
  else { x = 16; y = 16; }
  x = Math.max(8, Math.min(x, innerWidth - t.offsetWidth - 8)); y = Math.max(8, Math.min(y, innerHeight - t.offsetHeight - 8));
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
export function untip() { const t = tipEl(); if (t) t.hidden = true; }

// ---------- URL state after the hash route ----------
/** '#/predict?o2=30&flow=10' → {o2:'30', flow:'10'} */
export const params = () => Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));
/** Write query keys after the route with history.replaceState (no hashchange). null or '' removes a key. */
export function setParams(obj, { merge = true } = {}) {
  const [route] = (location.hash || '#/overview').split('?');
  const q = new URLSearchParams(merge ? (location.hash.split('?')[1] || '') : '');
  for (const [k, v] of Object.entries(obj || {})) { if (v == null || v === '') q.delete(k); else q.set(k, String(v)); }
  const s = q.toString();
  history.replaceState(history.state, '', `${location.pathname}${location.search}${route}${s ? '?' + s : ''}`);
}

// ---------- controls ----------
let uid = 0;
const nextId = p => `${p}-${++uid}`;
/** Segmented control: a visible label plus pressed buttons in a labelled group. */
export function seg({ label, options, value, onChange, id }) {
  const lid = id || nextId('seg');
  const btns = options.map(([v, text]) => h('button', { type: 'button', 'data-v': String(v), 'aria-pressed': String(v) === String(value) }, text));
  const group = h('div', { class: 'seg', role: 'group', 'aria-labelledby': lid }, btns);
  btns.forEach((b, i) => b.addEventListener('click', () => {
    btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    onChange?.(options[i][0]);
  }));
  const row = h('div', { class: 'seg-row' }, h('span', { id: lid, class: 'seg-label' }, label), group);
  row.set = v => btns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === String(v))));
  return row;
}
const plain = v => String(Number(v));
/** Slider plus number field kept in sync, unit in the visible label, min and max read out. */
export function numField({ id, label, unit, min, max, step, value, onInput }) {
  const fid = id || nextId('nf'), lid = `${fid}-label`, rid = `${fid}-range`;
  const vt = v => `${plain(v)}${unit ? ' ' + unit : ''}`;
  const range = h('input', { type: 'range', id: rid, min, max, step, value, 'aria-labelledby': lid, 'aria-valuetext': vt(value) });
  const num = h('input', { type: 'number', id: fid, min, max, step, value, inputmode: 'decimal' });
  const clamp = v => Math.min(Number(max), Math.max(Number(min), v));
  const sync = (v, from) => {
    if (from !== range) range.value = v;
    if (from !== num) num.value = v;
    range.setAttribute('aria-valuetext', vt(v));
  };
  range.addEventListener('input', () => { const v = Number(range.value); sync(v, range); onInput?.(v); });
  num.addEventListener('input', () => { const v = Number(num.value); if (num.value === '' || !Number.isFinite(v) || v < Number(min) || v > Number(max)) return; sync(v, num); onInput?.(v); });
  num.addEventListener('change', () => { let v = Number(num.value); if (!Number.isFinite(v) || num.value === '') v = Number(range.value); v = clamp(v); sync(v, null); onInput?.(v); });
  const el = h('div', { class: 'numfield' },
    h('label', { for: fid, id: lid }, unit ? `${label} (${unit})` : label),
    h('div', { class: 'nf-row' }, range, num),
    h('small', { class: 'nf-range' }, `min ${plain(min)} · max ${plain(max)}${unit ? ' ' + unit : ''}`));
  el.set = v => sync(Number(v), null);
  el.get = () => Number(num.value);
  return el;
}
export const stat = (label, value, small) =>
  h('div', { class: 'statbox' }, h('span', { class: 'stat-label' }, label), h('div', { class: 'stat' }, value, small ? h('small', {}, small) : null));

const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, a) => { const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
function markSVG(mark, color) {
  const s = sv('svg', { width: 18, height: 12, viewBox: '0 0 18 12', 'aria-hidden': 'true', class: 'mk' });
  s.style.color = color || 'currentColor';
  const c = 'currentColor';
  if (mark === 'square') s.append(sv('rect', { x: 4, y: 1, width: 10, height: 10, rx: 1.5, fill: c }));
  else if (mark === 'line') s.append(sv('line', { x1: 1, y1: 6, x2: 17, y2: 6, stroke: c, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
  else if (mark === 'dash') s.append(sv('line', { x1: 1, y1: 6, x2: 17, y2: 6, stroke: c, 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));
  else if (mark === 'hatch') { s.append(sv('rect', { x: 1.5, y: 1.5, width: 15, height: 9, fill: 'none', stroke: c, 'stroke-width': 1.2 })); for (const x of [2, 7, 12]) s.append(sv('line', { x1: x, y1: 10.5, x2: x + 5, y2: 1.5, stroke: c, 'stroke-width': 1.2 })); }
  else if (mark === 'diamond') s.append(sv('polygon', { points: '9,0.5 14.5,6 9,11.5 3.5,6', fill: c }));
  else s.append(sv('circle', { cx: 9, cy: 6, r: 4.5, fill: c }));
  return s;
}
/** Legend with a shape per item, so colour is never the only clue. */
export const legend = items => h('div', { class: 'legend' }, items.map(it => h('span', { class: 'lg-item' }, markSVG(it.mark || 'dot', it.color), it.label)));

/** A scrolling table region. An empty header gets screen-reader text. */
export function table(headers, rows, { caption, cls } = {}) {
  const t = h('table', { class: cls || null },
    caption ? h('caption', {}, caption) : null,
    h('thead', {}, h('tr', {}, headers.map(x => h('th', { scope: 'col' }, x === '' ? h('span', { class: 'sr' }, 'Item') : x)))),
    h('tbody', {}, rows.map(r => h('tr', {}, r.map(c => h('td', {}, c))))));
  return h('div', { class: 'scroll' }, t);
}
export const fold = (summary, ...body) => h('details', { class: 'fold' }, h('summary', {}, summary), ...body);

// ---------- the one polite live region ----------
let lastSaid = '';
export function announce(msg) {
  const live = document.getElementById('live');
  if (!live || !msg || msg === lastSaid) return;
  lastSaid = msg; live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 60);
}
export const calm = () => document.documentElement.dataset.motion === 'calm';
export const slug = title => String(title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
