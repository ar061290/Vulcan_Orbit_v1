// Small dependency-free SVG charts. One y-axis per chart, recessive grid, hover on every mark.
import { tip, untip } from './lib.js';
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, a = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); e.append(...kids.filter(Boolean)); return e; };
const txt = (x, y, t, a = {}) => { const e = s('text', { x, y, ...a }); e.textContent = t; return e; };
export const C = { s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', grid: '#2c2c2a', axis: '#383835', ink: '#f0efec', mute: '#898781', surface: '#1a1a19', good: '#0ca30c', crit: '#d03b3b', warn: '#fab219' };
export const SERIES = [C.s1, C.s2, C.s3, C.s4];
// Live instrument canvases always sit on a dark screen, whatever the page theme.
export const SCREEN = { ink: '#eef1f7', mute: '#9aa3b5', surface: '#0b1020', grid: '#1e2638' };
const THEMES = {
  night: { grid: '#1e2638', axis: '#2c3550', ink: '#eef1f7', mute: '#8d96a8', surface: '#0e1320' },
  day: { grid: '#e3ddd0', axis: '#c9c1b0', ink: '#121722', mute: '#596171', surface: '#fffdf8' },
};
/** Charts read C when they are drawn, so switching theme and re-rendering the page recolours every SVG figure. */
export const setChartTheme = t => Object.assign(C, THEMES[t] || THEMES.night);

function ticks(lo, hi, n = 5) {
  const span = hi - lo || 1, step0 = Math.pow(10, Math.floor(Math.log10(span / n)));
  const step = [1, 2, 5, 10].map(m => m * step0).find(st => span / st <= n) || step0 * 10;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10)); return out;
}
const nice = v => Math.abs(v) >= 1000 ? (v / 1000) + 'k' : String(v);

function frame({ w = 640, hgt = 300, xDom, yDom, xLabel, yLabel, m = { t: 12, r: 16, b: 38, l: 48 }, xLog = false }) {
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${w} ${hgt}`, role: 'img' });
  const iw = w - m.l - m.r, ih = hgt - m.t - m.b;
  const lx = v => xLog ? Math.log10(v) : v;
  const X = v => m.l + (lx(v) - lx(xDom[0])) / (lx(xDom[1]) - lx(xDom[0])) * iw;
  const Y = v => m.t + ih - (v - yDom[0]) / (yDom[1] - yDom[0]) * ih;
  for (const t of ticks(yDom[0], yDom[1])) svg.append(s('line', { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), stroke: C.grid }), txt(m.l - 8, Y(t) + 4, nice(t), { 'text-anchor': 'end' }));
  const xt = xLog ? [10, 30, 100, 300, 1000, 3000].filter(v => v >= xDom[0] && v <= xDom[1]) : ticks(xDom[0], xDom[1], 6);
  for (const t of xt) svg.append(txt(X(t), m.t + ih + 16, nice(t), { 'text-anchor': 'middle' }));
  svg.append(s('line', { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, stroke: C.axis }));
  if (xLabel) svg.append(txt(m.l + iw / 2, hgt - 4, xLabel, { 'text-anchor': 'middle' }));
  if (yLabel) svg.append(txt(12, m.t + ih / 2, yLabel, { 'text-anchor': 'middle', transform: `rotate(-90 12 ${m.t + ih / 2})` }));
  return { svg, X, Y, m, iw, ih };
}
const ext = (arr, pad = 0.06) => { let lo = Math.min(...arr), hi = Math.max(...arr); if (lo === hi) { lo -= 1; hi += 1; } const p = (hi - lo) * pad; return [lo - p, hi + p]; };

/** Lines over a shared x. series: [{name, color, points:[[x,y],...]}]. markers: [{x, label, color}] draw vertical event lines. */
export function lineChart({ series, xLabel, yLabel, markers = [], yDom, unit = '' }) {
  const xs = series.flatMap(d => d.points.map(p => p[0])), ys = series.flatMap(d => d.points.map(p => p[1]));
  const f = frame({ xDom: [Math.min(...xs), Math.max(...xs)], yDom: yDom || [Math.min(0, ...ys), ext(ys)[1]], xLabel, yLabel });
  for (const mk of markers) f.svg.append(s('line', { x1: f.X(mk.x), x2: f.X(mk.x), y1: f.m.t, y2: f.m.t + f.ih, stroke: mk.color, 'stroke-dasharray': '3 3' }), txt(f.X(mk.x) + 4, f.m.t + 10 + (mk.dy || 0), mk.label, { fill: C.ink }));
  for (const d of series) {
    if (d.band) f.svg.append(s('path', { d: d.band.map((p, i) => (i ? 'L' : 'M') + f.X(p[0]).toFixed(1) + ' ' + f.Y(p[2]).toFixed(1)).join('') + d.band.slice().reverse().map(p => 'L' + f.X(p[0]).toFixed(1) + ' ' + f.Y(p[1]).toFixed(1)).join('') + 'Z', fill: d.color, opacity: 0.22, stroke: 'none' }));
    if (d.dots) for (const p of d.points) f.svg.append(s('circle', { cx: f.X(p[0]), cy: f.Y(p[1]), r: 4, fill: d.color, stroke: C.surface, 'stroke-width': 2 }));
    else f.svg.append(s('path', { d: d.points.map((p, i) => (i ? 'L' : 'M') + f.X(p[0]).toFixed(1) + ' ' + f.Y(p[1]).toFixed(1)).join(''), fill: 'none', stroke: d.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  }
  const cross = s('line', { y1: f.m.t, y2: f.m.t + f.ih, stroke: C.mute, visibility: 'hidden' });
  const hit = s('rect', { x: f.m.l, y: f.m.t, width: f.iw, height: f.ih, fill: 'transparent' });
  const base = series[0].points;
  hit.addEventListener('pointermove', e => {
    const r = f.svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * 640;
    let i = 0, best = 1e9; base.forEach((p, k) => { const dd = Math.abs(f.X(p[0]) - px); if (dd < best) { best = dd; i = k; } });
    cross.setAttribute('x1', f.X(base[i][0])); cross.setAttribute('x2', f.X(base[i][0])); cross.setAttribute('visibility', 'visible');
    tip(e, `<b>${base[i][0]} ${xLabel ? xLabel.split(' ').pop() : ''}</b><br>` + series.map(d => { const x0 = base[i][0]; const q = d.points.reduce((a, p) => Math.abs(p[0] - x0) < Math.abs(a[0] - x0) ? p : a, d.points[0]); return `<span style="color:${d.color}">&#9632;</span> ${d.name}: <b>${q && Math.abs(q[0] - x0) <= (d.near ?? Infinity) ? q[1].toFixed(2) : 'n/a'}</b>${unit}`; }).join('<br>'));
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); untip(); });
  f.svg.append(cross, hit); return f.svg;
}

/** Scatter. points: [{x,y,label,color,x2?,y2?}] ; x2/y2 draws a thin error line to a second position. diagonal draws y=x. */
export function scatter({ points, xLabel, yLabel, diagonal = false, square = false, xDom, yDom }) {
  const xs = points.flatMap(p => [p.x, p.x2 ?? p.x]), ys = points.flatMap(p => [p.y, p.y2 ?? p.y]);
  let xd = xDom || ext(xs), yd = yDom || ext(ys);
  if (diagonal || square) { const lo = Math.min(xd[0], yd[0]), hi = Math.max(xd[1], yd[1]); xd = yd = [lo, hi]; }
  const f = frame({ w: 640, hgt: square || diagonal ? 420 : 300, xDom: xd, yDom: yd, xLabel, yLabel });
  for (const t of ticks(xd[0], xd[1], 6)) f.svg.append(s('line', { x1: f.X(t), x2: f.X(t), y1: f.m.t, y2: f.m.t + f.ih, stroke: C.grid }));
  if (diagonal) f.svg.append(s('line', { x1: f.X(xd[0]), y1: f.Y(xd[0]), x2: f.X(xd[1]), y2: f.Y(xd[1]), stroke: C.axis, 'stroke-dasharray': '4 4' }));
  for (const p of points) {
    if (p.x2 != null) f.svg.append(s('line', { x1: f.X(p.x), y1: f.Y(p.y), x2: f.X(p.x2), y2: f.Y(p.y2), stroke: C.mute }), s('circle', { cx: f.X(p.x2), cy: f.Y(p.y2), r: 3.5, fill: 'none', stroke: C.ink2 || C.mute, 'stroke-width': 1.5 }));
    const c = s('circle', { cx: f.X(p.x), cy: f.Y(p.y), r: 5, fill: p.color || C.s1, stroke: C.surface, 'stroke-width': 2 });
    c.addEventListener('pointermove', e => tip(e, p.label)); c.addEventListener('pointerleave', untip); f.svg.append(c);
  }
  return f.svg;
}

/** Horizontal dot plot on a log x axis with reference bands/lines. rows: [{name, value, label}] ; refs: [{x, label, color}] ; shade: [x0,x1] */
export function dotRows({ rows, xDom, xLabel, refs = [], shadeBelow, color = C.s1, colorFn }) {
  const rowH = 30, hgt = rows.length * rowH + 50, m = { t: 10, r: 20, b: 38, l: 120 };
  const f = frame({ w: 640, hgt, xDom, yDom: [0, 1], xLabel, m, xLog: true });
  [...f.svg.querySelectorAll('line,text')].forEach(n => { if (n.getAttribute('text-anchor') === 'end' || (n.tagName === 'line' && n.getAttribute('stroke') === C.grid)) n.remove(); });
  if (shadeBelow) f.svg.append(s('rect', { x: f.m.l, y: f.m.t, width: f.X(shadeBelow) - f.m.l, height: f.ih, fill: C.crit, opacity: .1 }));
  for (const r of refs) f.svg.append(s('line', { x1: f.X(r.x), x2: f.X(r.x), y1: f.m.t, y2: f.m.t + f.ih, stroke: r.color || C.warn, 'stroke-dasharray': '4 3' }), txt(f.X(r.x) + 5, f.m.t + 11, r.label, { fill: C.ink }));
  rows.forEach((r, i) => {
    const y = f.m.t + 22 + i * rowH;
    f.svg.append(s('line', { x1: f.m.l, x2: f.m.l + f.iw, y1: y, y2: y, stroke: C.grid }), txt(f.m.l - 10, y + 4, r.name, { 'text-anchor': 'end', fill: C.ink }));
    const c = s('circle', { cx: f.X(r.value), cy: y, r: 6, fill: colorFn ? colorFn(r) : color, stroke: C.surface, 'stroke-width': 2 });
    c.addEventListener('pointermove', e => tip(e, r.label)); c.addEventListener('pointerleave', untip);
    f.svg.append(c, txt(f.X(r.value) + 11, y + 4, r.text || '', { fill: C.mute }));
  });
  return f.svg;
}

/** Grouped vertical bars. groups: [{name, values:[{key,value,color}]}] */
export function bars({ groups, yLabel, unit = '' }) {
  const vals = groups.flatMap(g => g.values.map(v => v.value)), w = 640, hgt = 280, m = { t: 12, r: 16, b: 38, l: 48 };
  const f = frame({ w, hgt, xDom: [0, 1], yDom: [0, Math.max(...vals) * 1.1 || 1], yLabel, m });
  [...f.svg.querySelectorAll('text[text-anchor=middle]')].forEach(n => { if (!n.getAttribute('transform')) n.remove(); });
  const gw = f.iw / groups.length;
  groups.forEach((g, gi) => {
    const n = g.values.length, bw = Math.min(26, (gw - 16) / n - 2), x0 = f.m.l + gi * gw + (gw - n * (bw + 2)) / 2;
    g.values.forEach((v, vi) => {
      const y = f.Y(v.value), r = s('path', { d: `M${x0 + vi * (bw + 2)} ${f.m.t + f.ih}V${y + 4}q0 -4 4 -4h${bw - 8}q4 0 4 4V${f.m.t + f.ih}Z`, fill: v.color });
      r.addEventListener('pointermove', e => tip(e, `<b>${g.name}</b><br>${v.key}: <b>${v.value}</b>${unit}`)); r.addEventListener('pointerleave', untip); f.svg.append(r);
    });
    f.svg.append(txt(f.m.l + gi * gw + gw / 2, f.m.t + f.ih + 16, g.name, { 'text-anchor': 'middle' }));
  });
  return f.svg;
}
