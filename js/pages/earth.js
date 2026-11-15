// On Earth (#/earth): "What does this mean on Earth?" (site/REBUILD_PLAN.md §3.14, spec B9; package P5-F).
// Three cards from data/earth_apps.json (status team): Water mist, Smoke detectors, Materials and firefighter gear.
// No number is typed in this module or in earth_apps.json: every number is a {ref:{file, path}} item resolved at run
// time against data/<file>.json. An unresolved ref prints no number, and says which file it was waiting for.
// The India Gaganyaan water-mist fact is not used here (§7 item 13: spacecraft hardware, rated "news only").
import { h, load, page, card, empty, badge, isMissing, fmt, sig, pct, table, fold } from '../lib.js';
import { figLink } from '../passes.js';
import { scrubIonWind, SCRAPPED } from '../overlays.js';
import { mistRows } from '../fig_respond.js';

// The three card titles are MADE keys (js/provenance.js). They are listed here so the page keeps its three titled
// panels (and the Sources site map sees them) even when data/earth_apps.json is missing or drops a card.
const CARDS = [
  { id: 'water-mist', title: 'Water mist', files: ['flex_suppression', 'response_trials'] },
  { id: 'smoke-detectors', title: 'Smoke detectors', files: ['smoke_sizes', 'models', 'daft'] },
  { id: 'materials-gear', title: 'Materials and firefighter gear', files: ['flame_spread', 'spread_predictor'] },
];
const SCHEMA = '{ "status":"team", "what":"…",\n  "cards":[{ "id":"water-mist", "title":"Water mist", "status":"team", "sub":"…",\n    "text":[ {"h":"What NASA\'s data shows"}, {"t":"…"}, {"ref":{"file":"flex_suppression","path":"groups[gas=CO2].tests","fmt":"num"},"unit":"burns"} ],\n    "short":[ … ], "links":[{"label":"…","page":"respond","fig":"<figure title>"}],\n    "sources":[{"label":"…","doi":"…"}] }] }';

// ---------- path resolver: a.b[2].c, list[key=value,key2=value2].field ----------
/** Split a path into steps: {key} | {index} | {match:[[k, v], …]}. */
function steps(path) {
  const out = [];
  const re = /([^.[\]]+)|\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(String(path || '')))) {
    if (m[1] != null) out.push({ key: m[1] });
    else if (/^\d+$/.test(m[2].trim())) out.push({ index: Number(m[2]) });
    else out.push({ match: m[2].split(',').map(p => { const i = p.indexOf('='); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }) });
  }
  return out;
}
/** The value at `path` inside obj, or undefined. Exported for tests. */
export function resolvePath(obj, path) {
  let cur = obj;
  for (const s of steps(path)) {
    if (cur == null) return undefined;
    if (s.key != null) cur = cur[s.key];
    else if (s.index != null) cur = Array.isArray(cur) ? cur[s.index] : undefined;
    else cur = Array.isArray(cur) ? cur.find(el => el && s.match.every(([k, v]) => String(el[k]) === v)) : undefined;
  }
  return cur;
}

/** Format a resolved value. Returns null when the value cannot carry the requested format (so no number is shown). */
function show(v, ref) {
  if (ref.map && v != null && Object.prototype.hasOwnProperty.call(ref.map, String(v))) return ref.map[String(v)];
  switch (ref.fmt) {
    case 'count': return Array.isArray(v) ? String(v.length) : null;
    case 'text': return typeof v === 'string' ? scrubIonWind(v) : null;
    case 'pct': return Number.isFinite(v) ? pct(v, ref.d ?? 0) : null;
    case 'sig': return Number.isFinite(v) ? sig(v, ref.d ?? 3) : null;
    default: return Number.isFinite(v) ? fmt(v, ref.d ?? 1) : null;
  }
}

/** Resolve one {ref:{file, path}} against the loaded files. → {ok, text, file, path, status, why} */
function resolveRef(ref, files) {
  const d = files[ref.file];
  if (!d || isMissing(d)) return { ok: false, file: ref.file, path: ref.path, why: `data/${ref.file}.json missing` };
  const text = show(resolvePath(d, ref.path), ref);
  return text == null
    ? { ok: false, file: ref.file, path: ref.path, status: d.status, why: `no value at ${ref.path} in data/${ref.file}.json` }
    : { ok: true, text, file: ref.file, path: ref.path, status: d.status };
}

/** Every file a card's items name (refs in text, short and table headers). */
function filesOf(c) {
  const out = new Set();
  const walk = items => (items || []).forEach(it => {
    if (it.ref?.file) out.add(it.ref.file);
    if (it.table?.file) { out.add(it.table.file); it.table.columns?.forEach(col => walk(col.label)); }
    if (it.trial) out.add('response_trials');
  });
  walk(c.text); walk(c.short);
  return [...out];
}

// ---------- rendering ----------
/** The bench trial line, worded as on Put it out (pages/respond.js short()). */
function trialText(files) {
  const n = mistRows(files.response_trials).length;
  const optional = SCRAPPED.optional.includes('response_trials') ? ' This trial is optional.' : '';
  return n ? `Bench mist trial: ${n} mist run${n > 1 ? 's' : ''} measured on the dome, at Earth gravity.${optional}`
    : `Bench mist trial: not completed.${optional}`;
}

/** Inline items → nodes. Each resolved number is logged in `used` for the card's source table. */
function inline(items, files, used) {
  return (items || []).map(it => {
    if (it.t != null) return scrubIonWind(String(it.t));
    if (it.ref) {
      const r = resolveRef(it.ref, files);
      used?.push(r);
      if (!r.ok) return h('span', { class: 'ea-ref ea-gap' }, `[not available: ${r.why}]`);
      const quote = it.ref.fmt === 'text' && !it.ref.map;   // a sentence quoted from the file wraps like body text
      return h('span', { class: quote ? 'ea-ref ea-quote' : 'ea-ref', title: `data/${r.file}.json → ${r.path}` }, r.text, it.unit ? ` ${it.unit}` : null);
    }
    if (it.trial === 'mist') {
      const tr = files.response_trials, n = mistRows(tr).length;
      // Always ok: a missing trial file is the expected "not completed" state, not a broken number.
      used?.push({ ok: true, file: 'response_trials', path: 'trials (fine-mist rows with before and after)', status: isMissing(tr) ? 'missing' : tr.status, text: n ? `${n} mist run${n > 1 ? 's' : ''}` : 'not completed' });
      return h('b', { class: 'ea-trial' }, ` ${trialText(files)}`);
    }
    return null;
  });
}

/** A table item: rows from an array in a data file, one column per {label, path, fmt}. */
function dataTable(spec, files, used) {
  const d = files[spec.file];
  const rows = isMissing(d) ? null : resolvePath(d, spec.path);
  if (!Array.isArray(rows) || !rows.length) {
    used.push({ ok: false, file: spec.file, path: spec.path, why: isMissing(d) ? `data/${spec.file}.json missing` : `no rows at ${spec.path}` });
    return h('p', { class: 'ea-gap' }, `The table is not available (${isMissing(d) ? `data/${spec.file}.json missing` : `no rows at ${spec.path} in data/${spec.file}.json`}).`);
  }
  const heads = spec.columns.map(col => h('span', {}, inline(col.label, files, used)));
  const body = rows.map(row => spec.columns.map(col => show(resolvePath(row, col.path), col) ?? 'n/a'));
  spec.columns.forEach(col => used.push({ ok: true, file: spec.file, path: `${spec.path}[*].${col.path}`, status: d.status, text: `${rows.length} rows` }));
  const out = table(heads, body, { caption: spec.caption || null, cls: 'ea-table' });
  // v3 layout: a column whose every cell is a number is right-aligned in tabular figures (no value changes)
  const numCol = spec.columns.map((_, j) => body.every(r => /^[\d.,%\s–-]+$/.test(String(r[j]))));
  out.querySelectorAll('tr').forEach(tr => [...tr.cells].forEach((c, j) => { if (numCol[j]) c.classList.add('num'); }));
  return out;
}

/** The card text: {h} starts a new block (heading + paragraph); a table item gets its own place in the block. */
function blocks(items, files, used) {
  const out = [];
  let cur = null, para = null;
  const flush = () => { para = null; };
  for (const it of items || []) {
    if (it.h != null) { cur = h('div', { class: 'ea-block' }, h('h3', {}, scrubIonWind(String(it.h)))); out.push(cur); flush(); continue; }
    if (!cur) { cur = h('div', { class: 'ea-block' }); out.push(cur); }
    if (it.table) { cur.append(dataTable(it.table, files, used)); flush(); continue; }
    if (!para) { para = h('p', {}); cur.append(para); }
    for (const n of inline([it], files, used)) if (n != null) para.append(n.nodeType ? n : document.createTextNode(n));
  }
  return out;
}

/** "Where these numbers come from": each file's stamp, then a fold listing every number and its path. */
function provenanceList(used, files) {
  const byFile = [...new Set(used.map(u => u.file))];
  if (!byFile.length) return h('p', { class: 'ea-files' }, h('small', {}, 'This card reads no numbers from the data files, so it shows none.'));
  const st = f => (isMissing(files[f]) ? 'missing' : files[f].status);
  return h('div', { class: 'ea-files' },
    h('h3', {}, 'Where these numbers come from'),
    h('ul', {}, byFile.map(f => h('li', {}, h('code', {}, `data/${f}.json`), ' ', badge(st(f))))),
    fold('Show each number and where it is read',
      table(['Shown', 'File', 'Path in the file'],
        used.map(u => [u.ok ? u.text : `not available (${u.why})`, `data/${u.file}.json`, h('code', {}, u.path)]),
        { caption: 'Every number on this card, read from the data files when the page loads.' })));
}

const doiHref = d => `https://doi.org/${d}`;
function linkList(links) {
  if (!links?.length) return null;
  return h('div', { class: 'ea-links' }, h('h3', {}, 'See it on this site'),
    h('ul', {}, links.map(l => h('li', {}, h('a', { href: l.href || (l.fig ? figLink(l.page, l.fig) : `#/${l.page}`) }, l.label)))));
}
function sourceList(sources) {
  if (!sources?.length) return null;
  return h('div', { class: 'ea-src' }, h('h3', {}, 'Sources'),
    h('ul', {}, sources.map(s => h('li', {}, s.doi || s.url
      ? h('a', { href: s.doi ? doiHref(s.doi) : s.url, rel: 'noopener', target: '_blank' }, s.label, s.doi ? ` (doi:${s.doi})` : null)
      : s.label))));
}

function earthCard(c, files) {
  const used = [];
  const body = blocks(c.text, files, used);
  return card(c.title, c.status || 'team', c.sub || null,
    h('div', { class: 'ea-grid' }, body),
    h('div', { class: 'ea-foot' }, linkList(c.links), sourceList(c.sources)),
    provenanceList(used, files));
}

function missingCard(spec, ea) {
  const why = isMissing(ea)
    ? 'The On Earth cards are written in data/earth_apps.json, which is not there yet.'
    : `data/earth_apps.json has no card with id "${spec.id}".`;
  return card(spec.title, 'missing', null, empty('No data yet', 'earth_apps', why, SCHEMA));
}

/** Load earth_apps and every file its refs name (plus the expected files, so a missing one is named). */
async function loadAll() {
  const ea = await load('earth_apps');
  const cards = isMissing(ea) || !Array.isArray(ea.cards) ? [] : ea.cards;
  const names = new Set(CARDS.flatMap(c => c.files));
  cards.forEach(c => filesOf(c).forEach(f => names.add(f)));
  const list = [...names];
  const loaded = await Promise.all(list.map(n => load(n)));
  return { ea, cards, files: Object.fromEntries(list.map((n, i) => [n, loaded[i]])) };
}

export default async function render(root, ctx) {
  const { ea, cards, files } = await loadAll();
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  const known = new Set(CARDS.map(c => c.id));
  const els = [
    ...CARDS.map(spec => (byId[spec.id] ? earthCard({ title: spec.title, ...byId[spec.id] }, files) : missingCard(spec, ea))),
    ...cards.filter(c => !known.has(c.id) && c.title).map(c => earthCard(c, files)),
  ];
  root.append(page('On Earth',
    'Three findings from this site, each linked to an Earth use. The NASA tests ran in orbit, so they point to questions worth asking on Earth; they do not answer them. Every number is read from a data file when the page loads.',
    ...els));
}

/** "The short answer": one sentence per card, from each card's `short` items (D1.4: a missing file is named). */
export async function short() {
  const { ea, cards, files } = await loadAll();
  if (isMissing(ea)) return ['The On Earth cards are not available yet (data/earth_apps.json missing).'];
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  return CARDS.map(spec => {
    const c = byId[spec.id];
    if (!c?.short?.length) return `${spec.title} is not available yet (no "${spec.id}" card in data/earth_apps.json).`;
    const used = [];
    const parts = inline(c.short, files, used);
    const gap = used.find(u => !u.ok);
    if (gap) return `${spec.title}: the numbers are not available yet (${gap.why}).`;
    return parts.map(p => (p == null ? '' : p.nodeType ? p.textContent : p)).join('').replace(/\s+/g, ' ').trim();
  });
}
