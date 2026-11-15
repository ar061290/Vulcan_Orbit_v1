// Small dependency-free SVG charts. One y-axis per chart, quiet grid, hover on every mark.
// Every chart is also keyboard readable (one tab stop, arrow keys move a tooltip) and carries a
// "Show the numbers" table built from the same values it draws (spec D5.6). Series are told apart by
// dash, shape or a legend as well as colour (D5.12).
import { tip, untip, announce } from './lib.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, a = {}, ...kids) => {
  const e = document.createElementNS(NS, tag);
  for (const k in a) if (a[k] != null && a[k] !== false) e.setAttribute(k, a[k]);
  for (const k of kids) if (k != null && k !== false) e.append(k);
  return e;
};
const txt = (x, y, t, a = {}) => { const e = s('text', { x, y, ...a }); e.textContent = t; return e; };
const hd = (tag, a = {}, ...kids) => {   // tiny HTML builder, so this module only needs tip/untip from lib.js
  const e = document.createElement(tag);
  for (const k in a) if (a[k] != null && a[k] !== false) { if (k === 'class') e.className = a[k]; else e.setAttribute(k, a[k]); }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
};

// ---- palettes: values verbatim from main's js/charts.js ----
export const C = { s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', grid: '#2c2c2a', axis: '#383835', ink: '#f0efec', mute: '#898781', surface: '#1a1a19', good: '#0ca30c', crit: '#d03b3b', warn: '#fab219' };
export const SERIES = [C.s1, C.s2, C.s3, C.s4];
// Live instrument canvases always sit on a dark screen, whatever the page theme.
export const SCREEN = { ink: '#eef1f7', mute: '#9aa3b5', surface: '#0b1020', grid: '#1e2638' };
export const DASH = ['', '6 4', '2 3', '8 3 2 3'];
export const SHAPES = ['circle', 'square', 'triangle', 'diamond'];
const THEMES = {
  // merge: Night = the UI-lock tokens (grid/axis are the rgba lines of css/tokens.css flattened onto --page #05060E),
  // Day = the v3 cool light tokens now in css/tokens.css
  night: { grid: '#14151c', axis: '#2d2e35', ink: '#EDE8DF', mute: '#8C8A93', surface: '#0B0D18' },
  day: { grid: '#e6e9ee', axis: '#c3cad4', ink: '#0a0e15', mute: '#566070', surface: '#ffffff' },
};
/** Charts read C when they are drawn, so switching theme and re-rendering the page recolours every figure.
 *  The SVG charts below also draw grid, axis, text and outlines through CSS tokens (css/charts.css), so they
 *  recolour even before the re-render. */
export const setChartTheme = t => Object.assign(C, THEMES[t] || THEMES.night);

// Keep C in step with html[data-theme] whoever changes it (prefs.js fires vo:prefs / vo:rerender).
if (typeof document !== 'undefined') {
  const sync = () => { const t = document.documentElement.dataset.theme; if (t) setChartTheme(t); };
  sync();
  addEventListener('vo:prefs', sync);
  addEventListener('vo:rerender', sync);
  try { new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch { /* old browser: events still sync */ }
}

// ---- helpers ----
const HINT = 'Use the arrow keys to read values, or open "Show the numbers".';
let uidN = 0;
const uid = p => `${p}${++uidN}`;
const isF = Number.isFinite;
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = html => String(html ?? '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#9632;/g, '').trim();
const firstLine = html => strip(String(html ?? '').split(/<br\s*\/?>/i)[0]);
/** Default value format, shared by tooltip and table so they always agree. */
const num = v => {
  if (v == null || !isF(+v)) return 'n/a';
  v = +v;
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v) >= 10000) return String(Math.round(v));
  return String(Number(v.toPrecision(4)));   // 4 significant figures: enough to match the data files' own rounding
};
const unitOf = label => { const m = /,\s*([^,]+)$/.exec(label || ''); return m ? m[1].trim() : ''; };

function ticks(lo, hi, n = 5) {
  const span = hi - lo || 1, step0 = Math.pow(10, Math.floor(Math.log10(span / n)));
  const step = [1, 2, 5, 10].map(m => m * step0).find(st => span / st <= n) || step0 * 10;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10)); return out;
}
function logTicks(lo, hi) {
  const fixed = [10, 30, 100, 300, 1000, 3000].filter(v => v >= lo && v <= hi);   // main's fixed log ticks
  if (fixed.length >= 2) return fixed;
  const out = [];
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) for (const m of [1, 3]) { const v = m * 10 ** k; if (v >= lo && v <= hi) out.push(+v.toPrecision(6)); }
  return out;
}
const nice = v => Math.abs(v) >= 1000 ? (v / 1000) + 'k' : String(v);
const ext = (arr, pad = 0.06) => { let lo = Math.min(...arr), hi = Math.max(...arr); if (lo === hi) { lo -= 1; hi += 1; } const p = (hi - lo) * pad; return [lo - p, hi + p]; };
const widen = (d, log) => d[0] === d[1] ? (log ? [d[0] / 2, d[1] * 2] : [d[0] - 1, d[1] + 1]) : d;

function frame({ w = 640, hgt = 300, xDom, yDom, xLabel, yLabel, m = { t: 12, r: 16, b: 38, l: 48 }, xLog = false, yTicks = true, xTicks = true, title }) {
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${w} ${hgt}`, role: 'img', tabindex: '0', 'aria-label': `${title ? title + '. ' : 'Chart. '}${HINT}` });
  const iw = w - m.l - m.r, ih = hgt - m.t - m.b;
  const lx = v => xLog ? Math.log10(v) : v;
  const X = v => m.l + (lx(v) - lx(xDom[0])) / (lx(xDom[1]) - lx(xDom[0])) * iw;
  const Y = v => m.t + ih - (v - yDom[0]) / (yDom[1] - yDom[0]) * ih;
  if (yTicks) for (const t of ticks(yDom[0], yDom[1])) svg.append(s('line', { class: 'ch-grid', x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t) }), txt(m.l - 8, Y(t) + 4, nice(t), { 'text-anchor': 'end' }));
  const xt = xLog ? logTicks(xDom[0], xDom[1]) : ticks(xDom[0], xDom[1], 6);
  if (xTicks) for (const t of xt) svg.append(txt(X(t), m.t + ih + 16, nice(t), { 'text-anchor': 'middle' }));
  svg.append(s('line', { class: 'ch-axis', x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih }));
  if (xLabel) svg.append(txt(m.l + iw / 2, hgt - 4, xLabel, { 'text-anchor': 'middle' }));
  if (yLabel) svg.append(txt(12, m.t + ih / 2, yLabel, { 'text-anchor': 'middle', transform: `rotate(-90 12 ${m.t + ih / 2})` }));
  const clip = uid('chclip');
  svg.append(s('defs', {}, s('clipPath', { id: clip }, s('rect', { x: m.l, y: m.t - 1, width: iw, height: ih + 2 }))));
  return { svg, X, Y, m, iw, ih, w, hgt, xt, clip: `url(#${clip})` };
}
/** viewBox point → client px, for tooltips opened from the keyboard. */
const toClient = (f, x, y) => { const r = f.svg.getBoundingClientRect(); return { x: r.left + x / f.w * r.width, y: r.top + y / f.hgt * r.height }; };

/** A mark of the given shape centred on (cx, cy). */
function shape(kind, cx, cy, r, a = {}) {
  switch (kind) {
    case 'square': return s('rect', { x: cx - r * 0.9, y: cy - r * 0.9, width: r * 1.8, height: r * 1.8, rx: 1, ...a });
    case 'triangle': return s('path', { d: `M${cx} ${cy - r * 1.15}L${cx + r * 1.05} ${cy + r * 0.8}L${cx - r * 1.05} ${cy + r * 0.8}Z`, ...a });
    case 'diamond': return s('path', { d: `M${cx} ${cy - r * 1.25}L${cx + r * 1.1} ${cy}L${cx} ${cy + r * 1.25}L${cx - r * 1.1} ${cy}Z`, ...a });
    default: return s('circle', { cx, cy, r, ...a });
  }
}
const PATTERNS = [null, 'hatch', 'dots', 'cross'];   // bar fills per key, so keys are not told apart by colour alone
function patternDef(id, kind) {
  const p = s('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: kind === 'hatch' ? 'rotate(45)' : null });
  if (kind === 'hatch') p.append(s('line', { class: 'ch-pat', x1: 0, y1: 0, x2: 0, y2: 6, 'stroke-width': 2.4 }));
  else if (kind === 'dots') p.append(s('circle', { class: 'ch-patfill', cx: 3, cy: 3, r: 1.3 }));
  else if (kind === 'cross') p.append(s('path', { class: 'ch-pat', d: 'M0 0L6 6M6 0L0 6', 'stroke-width': 1.2 }));
  return p;
}

/** Legend under a chart: each entry shows the same colour + dash / shape / fill pattern the chart uses. */
function chartLegend(items) {
  return hd('ul', { class: 'chart-legend' }, items.map(it => {
    const sw = s('svg', { viewBox: '0 0 28 12', width: 28, height: 12, 'aria-hidden': 'true', focusable: 'false' });
    if (it.kind === 'line') {
      sw.append(s('line', { x1: 1, x2: 27, y1: 6, y2: 6, stroke: it.color, 'stroke-width': 2.4, 'stroke-dasharray': it.dash || null }));
      if (it.shape) sw.append(shape(it.shape, 14, 6, 3.6, { fill: it.color, class: 'ch-surf', 'stroke-width': 1 }));
    } else if (it.kind === 'bar') {
      sw.append(s('rect', { x: 7, y: 0, width: 14, height: 12, rx: 2, fill: it.color }));
      if (it.pattern) { const id = uid('chpat'); sw.append(s('defs', {}, patternDef(id, it.pattern)), s('rect', { x: 7, y: 0, width: 14, height: 12, rx: 2, fill: `url(#${id})` })); }
    } else sw.append(shape(it.shape || 'circle', 14, 6, 4.6, { fill: it.color, class: 'ch-surf', 'stroke-width': 1.2 }));
    return hd('li', {}, sw, it.name);
  }));
}

/** "Show the numbers": a table fold built from the same data as the chart. */
export function numbers(caption, headers, rows, note) {
  const cell = (tag, v) => {
    if (v instanceof Node) return hd(tag, {}, v);
    const isNum = typeof v === 'number';
    return hd(tag, { class: isNum ? 'num' : null }, isNum ? num(v) : (v == null ? '' : String(v)));
  };
  return hd('details', { class: 'numbers' },
    hd('summary', {}, 'Show the numbers'),
    // focusable, named region at creation, so a table built after the passes.js a11y pass can still be scrolled by keyboard (P7-D)
    hd('div', { class: 'scroll', tabindex: '0', role: 'region', 'aria-label': caption ? `Table: ${caption}` : 'Table: the numbers behind this figure', 'data-autolabel': '1' }, hd('table', {},
      caption ? hd('caption', {}, caption) : null,
      hd('thead', {}, hd('tr', {}, headers.map(x => x === '' || x == null ? hd('th', { scope: 'col' }, hd('span', { class: 'sr' }, 'Item')) : hd('th', { scope: 'col' }, x)))),
      hd('tbody', {}, rows.map(r => hd('tr', {}, r.map((v, k) => cell(k === 0 ? 'th' : 'td', v))))))),
    note ? hd('p', { class: 'numbers-note' }, note) : null);
}

/**
 * Keyboard access for any chart, canvas or custom SVG: one tab stop; ←/→/↑/↓ step through items, Home/End jump to the
 * ends, PageUp/PageDown move 10; each step calls tip(anchor, html). Escape and blur call untip().
 * items: [{html, anchor: Element | (() => ({x, y}))}]  (anchor functions return client px)
 * opts: {label}  plus optional extras: cols (grid: ↑/↓ move a whole row), onMove(i), onClear()
 * Returns {show(i), clear(), index}.
 */
export function keyNav(el, items, { label, cols, onMove, onClear } = {}) {
  let i = -1, marked = null;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  if (!el.getAttribute('role')) el.setAttribute('role', 'img');
  if (label) el.setAttribute('aria-label', /arrow keys/i.test(label) ? label : `${label.replace(/\.\s*$/, '')}. ${HINT}`);
  el.setAttribute('data-keynav', '');
  const unmark = () => { marked?.classList?.remove('kfocus'); marked = null; };
  const show = k => {
    if (!items.length) return;
    i = Math.max(0, Math.min(items.length - 1, k));
    onMove?.(i);
    const it = items[i], a = typeof it.anchor === 'function' ? it.anchor() : it.anchor;
    unmark();
    if (a instanceof Element) { a.classList.add('kfocus'); marked = a; }
    if (a) tip(a, it.html);
    announce(plain(it.html));   // the tooltip is aria-hidden; key steps are read through the one #live region (D5.9)
  };
  const clear = () => { unmark(); onClear?.(); untip(); };
  el.addEventListener('keydown', e => {
    if (!items.length) return;
    const n = items.length, row = cols && cols > 0 ? cols : 1;
    let k = null;
    switch (e.key) {
      case 'ArrowRight': k = i < 0 ? 0 : i + 1; break;
      case 'ArrowLeft': k = i < 0 ? 0 : i - 1; break;
      case 'ArrowDown': k = i < 0 ? 0 : i + row; break;
      case 'ArrowUp': k = i < 0 ? 0 : i - row; break;
      case 'Home': k = 0; break;
      case 'End': k = n - 1; break;
      case 'PageDown': k = i < 0 ? 0 : i + 10; break;
      case 'PageUp': k = i < 0 ? 0 : i - 10; break;
      case 'Escape': if (i >= 0 || marked) { clear(); e.preventDefault(); } return;
      default: return;
    }
    e.preventDefault();
    if (row > 1 && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && (k < 0 || k >= n)) k = i;   // grid edge: stay
    show(k);
  });
  el.addEventListener('blur', clear);
  return { show, clear, get index() { return i; }, set index(v) { i = v; } };
}

function plain(html) {
  const d = document.createElement('div');
  d.innerHTML = String(html ?? '').replace(/<br\s*\/?>/gi, ' · ');
  return d.textContent.replace(/\s+/g, ' ').trim();
}

function wrap(svg, { legend, table, extra } = {}) {
  return hd('div', { class: 'chart-wrap' }, svg, legend, extra, table);
}
const noData = title => hd('div', { class: 'chart-wrap' }, hd('p', { class: 'chart-none' }, `${title ? title + ': n' : 'N'}o values to plot.`));

/**
 * Lines over a shared x.
 * series: [{name, color?, dash?, points:[[x,y]], band?:[[x,lo,hi]], dots?, near?}]  (a null y breaks the line)
 * markers: [{x, label, color, dy}] draw labelled vertical event lines. Hover and keys snap to the nearest x over ALL series.
 */
export function lineChart({ title, series = [], xLabel, yLabel, markers = [], xDom, yDom, xLog = false, unit = '', fmtX, fmtY, table = true, legend }) {
  const fx = fmtX || num, fy = fmtY || num;
  const okX = x => isF(x) && (!xLog || x > 0);
  const S = series.map((d, i) => ({
    ...d, i, color: d.color || SERIES[i % SERIES.length], dash: d.dash ?? DASH[i % DASH.length], shp: SHAPES[i % SHAPES.length],
    pts: (d.points || []).filter(p => okX(p[0])),
    bnd: (d.band || []).filter(p => okX(p[0]) && isF(p[1]) && isF(p[2])),
  }));
  const xs = S.flatMap(d => [...d.pts.map(p => p[0]), ...d.bnd.map(p => p[0])]);
  const ys = S.flatMap(d => [...d.pts.map(p => p[1]).filter(isF), ...d.bnd.flatMap(p => [p[1], p[2]])]);
  if (!xs.length || !ys.length) return noData(title);
  const mks = markers.filter(mk => okX(mk.x));
  const xd = widen(xDom || [Math.min(...xs, ...mks.map(mk => mk.x)), Math.max(...xs, ...mks.map(mk => mk.x))], xLog);
  const yd = yDom || [Math.min(0, ...ys), ext(ys)[1]];
  const f = frame({ xDom: xd, yDom: yd, xLabel, yLabel, xLog, title });
  const xIn = x => x >= Math.min(...xd) - 1e-12 && x <= Math.max(...xd) + 1e-12;
  mks.forEach(mk => {
    if (!xIn(mk.x)) return;
    const X = f.X(mk.x), right = X > f.m.l + f.iw * 0.78;
    f.svg.append(s('line', { x1: X, x2: X, y1: f.m.t, y2: f.m.t + f.ih, stroke: mk.color || C.mute, 'stroke-dasharray': '3 3' }));
    if (mk.label) f.svg.append(txt(right ? X - 4 : X + 4, f.m.t + 10 + (mk.dy || 0), mk.label, { class: 'ch-ink', 'text-anchor': right ? 'end' : null }));
  });
  const P = (x, y) => f.X(x).toFixed(1) + ' ' + f.Y(y).toFixed(1);
  for (const d of S) {
    if (d.bnd.length) f.svg.append(s('path', { d: d.bnd.map((p, i) => (i ? 'L' : 'M') + P(p[0], p[2])).join('') + d.bnd.slice().reverse().map(p => 'L' + P(p[0], p[1])).join('') + 'Z', fill: d.color, opacity: 0.22, stroke: 'none', 'clip-path': f.clip }));
    if (d.dots || d.pts.filter(p => isF(p[1])).length === 1) {
      for (const p of d.pts) if (isF(p[1])) f.svg.append(shape(d.shp, f.X(p[0]), f.Y(p[1]), 4, { fill: d.color, class: 'ch-surf', 'stroke-width': 2 }));
    }
    if (!d.dots) {
      let path = '', pen = false;
      for (const p of d.pts) { if (!isF(p[1])) { pen = false; continue; } path += (pen ? 'L' : 'M') + P(p[0], p[1]); pen = true; }
      if (path) f.svg.append(s('path', { d: path, fill: 'none', stroke: d.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-dasharray': d.dash || null, 'clip-path': f.clip }));
      // a point with a gap on both sides draws no line, so mark it with the series' shape
      const fin = k => k >= 0 && k < d.pts.length && isF(d.pts[k][1]);
      if (d.pts.filter(p => isF(p[1])).length > 1) d.pts.forEach((p, k) => { if (fin(k) && !fin(k - 1) && !fin(k + 1)) f.svg.append(shape(d.shp, f.X(p[0]), f.Y(p[1]), 3.5, { fill: d.color, class: 'ch-surf', 'stroke-width': 1.5 })); });
    }
  }
  // hover + keys: one stop per distinct x over all series
  const U = [...new Set(S.flatMap(d => d.pts.map(p => p[0])))].sort((a, b) => a - b);
  const vals = U.map(x0 => S.map(d => {
    const fin = d.pts.filter(p => isF(p[1]));
    if (!fin.length) return null;
    const lo = Math.min(...fin.map(p => p[0])), hi = Math.max(...fin.map(p => p[0]));
    if (x0 < lo - 1e-12 || x0 > hi + 1e-12) return null;   // outside this series: n/a, never the end value
    const q = fin.reduce((a, p) => Math.abs(p[0] - x0) < Math.abs(a[0] - x0) ? p : a, fin[0]);
    return Math.abs(q[0] - x0) <= (d.near ?? Infinity) ? q : null;
  }));
  const xu = unitOf(xLabel);
  const head = x0 => `<b>${esc(fx(x0))}${xu ? ' ' + esc(xu) : ''}</b>${!xu && xLabel ? ' <span>(' + esc(xLabel) + ')</span>' : ''}`;
  const html = k => head(U[k]) + '<br>' + S.map((d, si) => { const q = vals[k][si]; return `<span style="color:${d.color}">&#9632;</span> ${esc(d.name)}: <b>${q ? esc(fy(q[1])) : 'n/a'}</b>${q ? esc(unit) : ''}`; }).join('<br>');
  const cross = s('line', { class: 'ch-cross', y1: f.m.t, y2: f.m.t + f.ih, visibility: 'hidden' });
  const rings = S.map(() => s('circle', { class: 'ch-ring', r: 6, visibility: 'hidden' }));
  const showAt = k => {
    const X = f.X(U[k]); cross.setAttribute('x1', X); cross.setAttribute('x2', X); cross.setAttribute('visibility', 'visible');
    rings.forEach((r, si) => { const q = vals[k][si]; if (q && q[1] >= yd[0] && q[1] <= yd[1]) { r.setAttribute('cx', X); r.setAttribute('cy', f.Y(q[1])); r.setAttribute('visibility', 'visible'); } else r.setAttribute('visibility', 'hidden'); });
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); rings.forEach(r => r.setAttribute('visibility', 'hidden')); };
  const hit = s('rect', { x: f.m.l, y: f.m.t, width: f.iw, height: f.ih, fill: 'transparent' });
  f.svg.append(cross, ...rings, hit);
  const kn = keyNav(f.svg, U.map((x0, k) => ({ html: html(k), anchor: () => { showAt(k); const q = vals[k].find(v => v && v[1] >= yd[0] && v[1] <= yd[1]); return toClient(f, f.X(x0), q ? f.Y(q[1]) : f.m.t + f.ih / 2); } })), { onClear: hide });
  const near = e => {
    const r = f.svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * f.w;
    let k = 0, best = Infinity; U.forEach((x0, j) => { const dd = Math.abs(f.X(x0) - px); if (dd < best) { best = dd; k = j; } });
    return k;
  };
  const onPtr = e => { if (!U.length) return; const k = near(e); kn.index = k; showAt(k); tip(e, html(k)); };
  hit.addEventListener('pointermove', onPtr); hit.addEventListener('pointerdown', onPtr);
  hit.addEventListener('pointerleave', () => { hide(); untip(); });
  // legend + table
  const leg = legend !== false && S.length >= 2 ? chartLegend(S.map(d => ({ kind: 'line', name: d.name, color: d.color, dash: d.dots ? '' : d.dash, shape: d.dots ? d.shp : null }))) : null;
  let tbl = null;
  if (table) {
    const sfx = unit && unit.trim() ? ` (${unit.trim()})` : '';
    const heads = [xLabel || 'x', ...S.flatMap(d => [`${d.name}${sfx}`, ...(d.bnd.length ? [`${d.name}, low${sfx}`, `${d.name}, high${sfx}`] : [])])];
    const allX = [...new Set(S.flatMap(d => [...d.pts.map(p => p[0]), ...d.bnd.map(p => p[0])]))].sort((a, b) => a - b);
    const rows = allX.map(x0 => [fx(x0), ...S.flatMap(d => {
      const p = d.pts.find(q => q[0] === x0), b = d.bnd.find(q => q[0] === x0);
      const v = p ? (isF(p[1]) ? fy(p[1]) : 'n/a') : '';
      return d.bnd.length ? [v, b ? fy(b[1]) : '', b ? fy(b[2]) : ''] : [v];
    })]);
    const note = mks.filter(mk => mk.label).map(mk => `${mk.label} at ${fx(mk.x)}${xu ? ' ' + xu : ''}`).join('; ');
    tbl = numbers(title || 'Chart values', heads, rows, note ? `Marked lines: ${note}.` : null);
  }
  return wrap(f.svg, { legend: leg, table: tbl });
}

/**
 * Scatter. points: [{x, y, label, color?, shape?, x2?, y2?, lo?, hi?, group?}]; label is the tooltip HTML.
 * x2/y2 draws a thin line to a second position; errorBars draws lo–hi on y; diagonal draws y = x.
 * group gives each group its own colour + shape and a legend. columns: optional [[header, p => value]] for the table.
 */
export function scatter({ title, points = [], xLabel, yLabel, diagonal = false, square = false, xDom, yDom, errorBars = false, columns, table = true, legend }) {
  const pts = points.filter(p => isF(p.x) && isF(p.y));
  if (!pts.length) return noData(title);
  const groups = [...new Set(pts.map(p => p.group).filter(g => g != null))];
  const gi = p => groups.indexOf(p.group);
  const col = p => p.color || (p.group != null ? SERIES[gi(p) % SERIES.length] : C.s1);
  const shp = p => p.shape || (p.group != null ? SHAPES[gi(p) % SHAPES.length] : 'circle');
  const xs = pts.flatMap(p => [p.x, isF(p.x2) ? p.x2 : p.x]);
  const ys = pts.flatMap(p => [p.y, isF(p.y2) ? p.y2 : p.y, ...(errorBars && isF(p.lo) && isF(p.hi) ? [p.lo, p.hi] : [])]);
  let xd = xDom || ext(xs), yd = yDom || ext(ys);
  if (diagonal || square) { const lo = Math.min(xd[0], yd[0]), hi = Math.max(xd[1], yd[1]); xd = yd = [lo, hi]; }
  const f = frame({ w: 640, hgt: square || diagonal ? 420 : 300, xDom: xd, yDom: yd, xLabel, yLabel, title });
  for (const t of f.xt) f.svg.append(s('line', { class: 'ch-grid', x1: f.X(t), x2: f.X(t), y1: f.m.t, y2: f.m.t + f.ih }));
  if (diagonal) f.svg.append(s('line', { class: 'ch-axis', x1: f.X(xd[0]), y1: f.Y(xd[0]), x2: f.X(xd[1]), y2: f.Y(xd[1]), 'stroke-dasharray': '4 4' }));
  const dflt = p => `${esc(xLabel || 'x')}: <b>${esc(num(p.x))}</b><br>${esc(yLabel || 'y')}: <b>${esc(num(p.y))}</b>`;
  const marks = new Map();
  let kn = null;
  const order = pts.map((p, k) => k).sort((a, b) => pts[a].x - pts[b].x || pts[a].y - pts[b].y);
  const pos = new Map(order.map((k, j) => [k, j]));
  pts.forEach((p, k) => {
    if (errorBars && isF(p.lo) && isF(p.hi)) {
      const X = f.X(p.x), cw = 3;
      f.svg.append(s('path', { d: `M${X} ${f.Y(p.lo)}V${f.Y(p.hi)}M${X - cw} ${f.Y(p.lo)}h${2 * cw}M${X - cw} ${f.Y(p.hi)}h${2 * cw}`, stroke: col(p), 'stroke-width': 1.2, opacity: 0.6, fill: 'none', 'clip-path': f.clip }));
    }
    if (isF(p.x2) && isF(p.y2)) f.svg.append(s('line', { class: 'ch-mute', x1: f.X(p.x), y1: f.Y(p.y), x2: f.X(p.x2), y2: f.Y(p.y2) }), s('circle', { class: 'ch-mute', cx: f.X(p.x2), cy: f.Y(p.y2), r: 3.5, fill: 'none', 'stroke-width': 1.5 }));
    const c = shape(shp(p), f.X(p.x), f.Y(p.y), 5, { fill: col(p), class: 'ch-surf', 'stroke-width': 2 });
    const show = e => { if (kn) kn.index = pos.get(k); tip(e, p.label || dflt(p)); };
    c.addEventListener('pointermove', show); c.addEventListener('pointerdown', show); c.addEventListener('pointerleave', untip);
    f.svg.append(c); marks.set(k, c);
  });
  kn = keyNav(f.svg, order.map(k => ({ html: pts[k].label || dflt(pts[k]), anchor: marks.get(k) })));
  const leg = legend !== false && groups.length ? chartLegend(groups.map(g => { const p = pts.find(q => q.group === g); return { kind: 'dot', name: String(g), color: col(p), shape: shp(p) }; })) : null;
  let tbl = null;
  if (table) {
    let heads, rows;
    if (columns?.length) {
      heads = columns.map(c => Array.isArray(c) ? c[0] : c.header);
      rows = order.map(k => columns.map(c => (Array.isArray(c) ? c[1] : c.value)(pts[k])));
    } else {
      const has = key => pts.some(p => isF(p[key]));
      const labelled = pts.some(p => p.label);
      heads = [...(labelled ? ['Point'] : []), ...(groups.length ? ['Group'] : []), xLabel || 'x', yLabel || 'y',
        ...(has('x2') ? ['Second x', 'Second y'] : []), ...(has('lo') ? ['Low'] : []), ...(has('hi') ? ['High'] : [])];
      rows = order.map(k => { const p = pts[k]; return [...(labelled ? [firstLine(p.label) || String(k + 1)] : []), ...(groups.length ? [p.group ?? ''] : []), p.x, p.y,
        ...(has('x2') ? [isF(p.x2) ? p.x2 : '', isF(p.y2) ? p.y2 : ''] : []), ...(has('lo') ? [isF(p.lo) ? p.lo : ''] : []), ...(has('hi') ? [isF(p.hi) ? p.hi : ''] : [])]; });
    }
    tbl = numbers(title || 'Chart values', heads, rows, diagonal ? 'The dashed diagonal is where the two values are equal.' : null);
  }
  return wrap(f.svg, { legend: leg, table: tbl });
}

/**
 * Horizontal dot plot on a log x axis with reference lines and an optional shaded zone.
 * rows: [{name, value, text, label, lo?, hi?}]; refs: [{x, label, color}]; shadeBelow: x; colorFn/shapeFn: row → colour/shape.
 */
export function dotRows({ title, rows = [], xDom, xLabel, refs = [], shadeBelow, color = C.s1, colorFn, shapeFn, table = true }) {
  const ok = v => isF(v) && v > 0;
  if (!rows.length) return noData(title);
  if (!xDom) { const v = rows.flatMap(r => [r.value, r.lo, r.hi]).filter(ok); xDom = v.length ? [Math.min(...v) / 1.5, Math.max(...v) * 1.5] : [1, 10]; }
  const rowH = 30, hgt = rows.length * rowH + 50, m = { t: 10, r: 20, b: 38, l: 120 };
  const f = frame({ w: 640, hgt, xDom, yDom: [0, 1], xLabel, m, xLog: true, yTicks: false, title });
  const cl = v => Math.max(xDom[0], Math.min(xDom[1], v));
  if (ok(shadeBelow)) f.svg.append(s('rect', { class: 'ch-shade', x: f.m.l, y: f.m.t, width: Math.max(0, f.X(cl(shadeBelow)) - f.m.l), height: f.ih }));
  refs.forEach((r, k) => {
    if (!ok(r.x)) return;
    const X = f.X(cl(r.x)), right = X > f.m.l + f.iw * 0.7;
    f.svg.append(s('line', { class: r.color ? null : 'ch-warn', x1: X, x2: X, y1: f.m.t, y2: f.m.t + f.ih, stroke: r.color || null, 'stroke-dasharray': '4 3' }));
    if (r.label) f.svg.append(txt(right ? X - 5 : X + 5, f.m.t + 11 + k * 13, r.label, { class: 'ch-ink', 'text-anchor': right ? 'end' : null }));
  });
  const dflt = r => `<b>${esc(r.name)}</b><br>${esc(num(r.value))}${unitOf(xLabel) ? ' ' + esc(unitOf(xLabel).replace(/\s*\(.*\)$/, '')) : ''}`;
  const marks = [];
  let kn = null;
  rows.forEach((r, i) => {
    const y = f.m.t + 22 + i * rowH, c0 = colorFn ? colorFn(r) : color;
    f.svg.append(s('line', { class: 'ch-grid', x1: f.m.l, x2: f.m.l + f.iw, y1: y, y2: y }), txt(f.m.l - 10, y + 4, r.name, { 'text-anchor': 'end', class: 'ch-ink' }));
    if (ok(r.lo) && ok(r.hi)) f.svg.append(s('line', { x1: f.X(cl(r.lo)), x2: f.X(cl(r.hi)), y1: y, y2: y, stroke: c0, 'stroke-width': 3, opacity: 0.45, 'stroke-linecap': 'round' }));
    if (!ok(r.value)) { marks.push(null); f.svg.append(txt(f.m.l + 6, y + 4, 'n/a')); return; }
    const X = f.X(cl(r.value));
    const c = shape(shapeFn ? shapeFn(r) : 'circle', X, y, 6, { fill: c0, class: 'ch-surf', 'stroke-width': 2 });
    const show = e => { if (kn) kn.index = i; tip(e, r.label || dflt(r)); };
    c.addEventListener('pointermove', show); c.addEventListener('pointerdown', show); c.addEventListener('pointerleave', untip);
    const flip = r.text && X + 11 + String(r.text).length * 5.8 > f.w - 2;   // keep the note inside the chart
    f.svg.append(c, txt(flip ? X - 11 : X + 11, y + 4, r.text || '', { 'text-anchor': flip ? 'end' : null })); marks.push(c);
  });
  kn = keyNav(f.svg, rows.map((r, i) => ({ html: r.label || dflt(r), anchor: marks[i] || (() => toClient(f, f.m.l + 6, f.m.t + 22 + i * rowH)) })));
  let tbl = null;
  if (table) {
    const hasR = rows.some(r => ok(r.lo) || ok(r.hi)), hasT = rows.some(r => r.text);
    const heads = ['Name', xLabel || 'Value', ...(hasR ? ['Low', 'High'] : []), ...(hasT ? ['Note'] : [])];
    const body = rows.map(r => [r.name, ok(r.value) ? r.value : 'n/a', ...(hasR ? [ok(r.lo) ? r.lo : '', ok(r.hi) ? r.hi : ''] : []), ...(hasT ? [r.text || ''] : [])]);
    const notes = [...refs.filter(r => r.label && ok(r.x)).map(r => `${r.label} (line at ${num(r.x)})`), ...(ok(shadeBelow) ? [`shaded below ${num(shadeBelow)}`] : [])];
    tbl = numbers(title || 'Chart values', heads, body, notes.length ? `Reference: ${notes.join('; ')}.` : null);
  }
  return wrap(f.svg, { table: tbl });
}

/**
 * Grouped vertical bars. groups: [{name, values:[{key, value, color?, label?}]}]; label is the tooltip HTML.
 * Keys that repeat across groups get a fill pattern and a legend. xMarkers: [{at, label}], `at` a fractional group
 * index (0 = centre of the first group, 0.5 = between the first and second).
 */
export function bars({ title, groups = [], yLabel, unit = '', yMax, xMarkers = [], table = true, legend }) {
  const all = groups.flatMap(g => g.values || []), vals = all.map(v => v.value).filter(isF);
  if (!groups.length || !all.length) return noData(title);
  const keys = [...new Set(all.map(v => v.key))];
  const multi = groups.some(g => (g.values || []).length > 1);
  const pat = v => multi ? PATTERNS[keys.indexOf(v.key) % PATTERNS.length] : null;
  const lo = Math.min(0, ...vals);
  const w = 640, m = { t: 12, r: 16, b: 38, l: 48 };
  // wrap long group names into at most 3 lines
  const gwGuess = (w - m.l - m.r) / groups.length, maxCh = Math.max(6, Math.floor(gwGuess / 6.2));
  const lines = groups.map(g => { const out = []; let cur = ''; for (const word of String(g.name).split(/\s+/)) { if (cur && (cur + ' ' + word).length > maxCh) { out.push(cur); cur = word; } else cur = cur ? cur + ' ' + word : word; } if (cur) out.push(cur); return out.slice(0, 3); });
  const nl = Math.max(1, ...lines.map(l => l.length));
  m.b = 38 + (nl - 1) * 13;
  const hgt = 280 + (nl - 1) * 13;
  const f = frame({ w, hgt, xDom: [0, 1], yDom: [lo < 0 ? lo * 1.1 : 0, yMax ?? (Math.max(...vals, 0) * 1.1 || 1)], yLabel, m, xTicks: false, title });
  const defs = s('defs'); f.svg.append(defs);
  const patId = {};
  for (const k of keys) { const kind = multi ? PATTERNS[keys.indexOf(k) % PATTERNS.length] : null; if (kind) { patId[k] = uid('chpat'); defs.append(patternDef(patId[k], kind)); } }
  const gw = f.iw / groups.length, y0 = f.Y(0);
  const items = [];
  let kn = null;
  const label = (g, v) => v.label || `<b>${esc(g.name)}</b><br>${esc(v.key)}: <b>${esc(num(v.value))}</b>${esc(unit)}`;
  const showVals = all.length <= 24;
  groups.forEach((g, gi) => {
    const vs = g.values || [], n = vs.length, bw = Math.max(2, Math.min(26, (gw - 16) / Math.max(1, n) - 2)), x0 = f.m.l + gi * gw + (gw - n * (bw + 2)) / 2;
    vs.forEach((v, vi) => {
      const x = x0 + vi * (bw + 2), fill = v.color || SERIES[(multi ? keys.indexOf(v.key) : 0) % SERIES.length];
      if (!isF(v.value)) { const t = txt(x + bw / 2, y0 - 4, 'n/a', { 'text-anchor': 'middle' }); f.svg.append(t); items.push({ html: label(g, v), anchor: t }); return; }
      const y = f.Y(v.value), r4 = Math.min(4, bw / 2, Math.abs(y0 - y));
      const d = v.value >= 0
        ? `M${x} ${y0}V${y + r4}q0 -${r4} ${r4} -${r4}h${bw - 2 * r4}q${r4} 0 ${r4} ${r4}V${y0}Z`
        : `M${x} ${y0}V${y}h${bw}V${y0}Z`;
      const grp = s('g', { class: 'ch-bar' }, s('path', { d, fill }), patId[v.key] ? s('path', { d, fill: `url(#${patId[v.key]})` }) : null);
      const j = items.length;
      const show = e => { if (kn) kn.index = j; tip(e, label(g, v)); };
      grp.addEventListener('pointermove', show); grp.addEventListener('pointerdown', show); grp.addEventListener('pointerleave', untip);
      f.svg.append(grp);
      if (showVals) f.svg.append(txt(x + bw / 2, v.value >= 0 ? y - 4 : y + 12, num(v.value) + (unit && unit.trim().length <= 2 ? unit.trim() : ''), { 'text-anchor': 'middle', class: 'ch-ink ch-val' }));
      items.push({ html: label(g, v), anchor: grp });
    });
    lines[gi].forEach((ln, li) => f.svg.append(txt(f.m.l + gi * gw + gw / 2, f.m.t + f.ih + 16 + li * 13, ln, { 'text-anchor': 'middle' })));
  });
  xMarkers.forEach((mk, k) => {
    if (!isF(mk.at)) return;
    const X = f.m.l + (mk.at + 0.5) * gw;
    f.svg.append(s('line', { class: 'ch-mute', x1: X, x2: X, y1: f.m.t, y2: f.m.t + f.ih, 'stroke-dasharray': '3 3' }));
    if (mk.label) f.svg.append(txt(X + 4, f.m.t + 10 + k * 13, mk.label, { class: 'ch-ink' }));
  });
  kn = keyNav(f.svg, items);
  const leg = legend !== false && multi && keys.length >= 2 ? chartLegend(keys.map((k, i) => ({ kind: 'bar', name: String(k), color: (all.find(v => v.key === k) || {}).color || SERIES[i % SERIES.length], pattern: PATTERNS[i % PATTERNS.length] }))) : null;
  let tbl = null;
  if (table) {
    const sfx = unit && unit.trim() ? ` (${unit.trim()})` : '';
    let heads, rows;
    if (multi) {
      heads = ['Group', ...keys.map(k => `${k}${sfx}`)];
      rows = groups.map(g => [g.name, ...keys.map(k => { const v = (g.values || []).find(q => q.key === k); return v ? (isF(v.value) ? v.value : 'n/a') : ''; })]);
    } else {
      heads = ['Group', `${yLabel || 'Value'}${sfx && !(yLabel || '').includes(unit.trim()) ? sfx : ''}`, 'Detail'];
      rows = groups.map(g => { const v = (g.values || [])[0]; return [g.name, v && isF(v.value) ? v.value : 'n/a', v ? String(v.key ?? '') : '']; });
    }
    const note = xMarkers.filter(mk => mk.label).map(mk => mk.label).join('; ');
    tbl = numbers(title || 'Chart values', heads, rows, note ? `Marked lines: ${note}.` : null);
  }
  return wrap(f.svg, { legend: leg, table: tbl });
}
