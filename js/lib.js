// Shared helpers: DOM builder, data loading, status badges, empty states.
export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('aria-') && typeof v === 'boolean') { el.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};

const cache = new Map();
/** Load data/<name>.json. Returns {status:'missing'} if the file is absent, so pages can show an empty state. */
export async function load(name) {
  if (cache.has(name)) return cache.get(name);
  let out;
  try {
    const r = await fetch(`data/${name}.json`, { cache: 'no-cache' });
    out = r.ok ? await r.json() : { status: 'missing' };
  } catch { out = { status: 'missing' }; }
  out.status ||= 'missing';
  cache.set(name, out);
  return out;
}

const LABEL = { real: 'NASA data', dome: 'Dome data', reported: 'Reported, unverified', demo: 'Demo data', missing: 'No data yet', model: 'Model output' };
export const badge = (status) => h('span', { class: `badge ${status === 'dome' || status === 'model' ? 'real' : status}`, title: TITLE[status] || '' }, LABEL[status] || status);
const TITLE = {
  demo: 'Placeholder numbers so the layout can be built. Must be replaced before submission.',
  reported: 'Taken from a paper or another team\'s write-up. Check against the NASA source before relying on it.',
  real: 'Loaded from a NASA dataset we downloaded ourselves.', dome: 'Measured on our own rig.', missing: 'Waiting for this file.'
};

export const card = (title, status, sub, ...body) =>
  h('section', { class: 'card' }, h('h2', {}, title, status && badge(status)), sub && h('div', { class: 'sub' }, sub), ...body);

/** Empty state that tells the next person exactly which file to drop in and what shape it has. */
export const empty = (title, file, why, schema) =>
  h('div', { class: 'empty' }, h('h3', {}, title), h('p', {}, why),
    h('p', {}, 'Drop in ', h('code', {}, `data/${file}.json`), ' and this panel fills itself. Expected shape:'),
    h('pre', {}, schema));

export const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? 'n/a' : Number(v).toLocaleString('en', { maximumFractionDigits: d }));
export const page = (title, lead, ...body) => h('div', {}, h('h1', {}, title), h('p', { class: 'lead' }, lead), ...body);

// Tooltip shared by all charts.
const tipEl = () => document.getElementById('tip');
export function tip(evt, html) {
  const t = tipEl(); t.innerHTML = html; t.hidden = false;
  const x = Math.min(evt.clientX + 14, innerWidth - t.offsetWidth - 8), y = Math.min(evt.clientY + 14, innerHeight - t.offsetHeight - 8);
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
export const untip = () => { tipEl().hidden = true; };
