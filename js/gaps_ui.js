// #14 Evidence gap map: every oxygen/pressure point NASA's microgravity combustion tests covered (data/gaps.json).
import { h, card, tip, untip } from './lib.js';
import { C } from './charts.js';
const KIND = { 'solids': C.s2, 'liquid droplets': C.s1, 'gas flames': C.s3 };
export function gapCard(g) {
  const W = 640, H = 360, m = { l: 56, r: 16, t: 14, b: 44 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const xmax = 90, lyMin = Math.log10(40), lyMax = Math.log10(600);
  const X = v => m.l + v / xmax * iw, Y = v => m.t + ih - (Math.log10(v) - lyMin) / (lyMax - lyMin) * ih;
  const NS = 'http://www.w3.org/2000/svg', s = (t, a = {}, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Oxygen and pressure tested by NASA microgravity combustion experiments' });
  for (const v of [0, 20, 40, 60, 80]) svg.append(s('line', { x1: X(v), x2: X(v), y1: m.t, y2: m.t + ih, stroke: C.grid }), s('text', { x: X(v), y: m.t + ih + 16, 'text-anchor': 'middle' }, `${v}%`));
  for (const v of [50, 100, 200, 500]) svg.append(s('line', { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), stroke: C.grid }), s('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, String(v)));
  svg.append(s('text', { x: m.l + iw / 2, y: H - 6, 'text-anchor': 'middle' }, 'Oxygen, % by volume'));
  const yl = s('text', { x: 14, y: m.t + ih / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ih / 2})` }, 'Pressure, kPa (log)'); svg.append(yl);
  for (const t of g.tested) for (const [o, p] of t.points) {
    const c = s('circle', { cx: X(o), cy: Y(p), r: 4, fill: KIND[t.kind], 'fill-opacity': t.pressure_assumed ? 0.35 : 0.75, stroke: C.surface, 'stroke-width': 1 });
    c.addEventListener('pointermove', e => tip(e, `<b>${t.inv}</b><br>${t.kind}<br>${o}% O₂, ${p} kPa${t.pressure_assumed ? '<br><span>pressure assumed (not in the table)</span>' : ''}`)); c.addEventListener('pointerleave', untip);
    svg.append(c);
  }
  g.probes.forEach((p, k) => {
    const empty = Object.values(p.counts).some(v => v === 0), x = X(p.o2), y = Y(p.kpa), ly = y + (k % 2 ? 30 : -22);
    svg.append(s('rect', { x: x - 9, y: y - 9, width: 18, height: 18, rx: 3, fill: 'none', stroke: empty ? C.warn : C.ink, 'stroke-width': 2 }));
    svg.append(s('line', { x1: x, x2: x + 18, y1: y + (k % 2 ? 9 : -9), y2: ly - 4, stroke: C.mute }));
    const t = s('text', { x: x + 20, y: ly, style: `fill:${C.ink};font-size:12px` }, p.atmosphere);
    svg.append(t);
  });
  const el = card('What NASA has not tested', g.status, 'Every oxygen and pressure combination in the summary tables of five NASA microgravity combustion experiments. Squares are cabin atmospheres we probe for gaps.',
    svg, h('div', { class: 'legend' }, ...Object.entries(KIND).map(([k, c]) => h('span', {}, h('i', { style: `background:${c};border-radius:50%` }), k)), h('span', {}, h('i', { style: `border:2px solid ${C.warn};background:none` }), 'Gap for at least one fuel type')),
    h('ul', { style: 'margin:10px 0 0;padding-left:18px' }, ...g.verdicts.map(v => h('li', { style: 'margin-bottom:6px' }, v.text, ' ', h('small', {}, v.source)))),
    h('p', {}, h('small', {}, g.note + ' ' + g.source)));
  el.style.gridColumn = '1 / -1';
  return el;
}
