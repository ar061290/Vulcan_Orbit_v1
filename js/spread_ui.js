// M6b flame-spread predictor and fire-growth examples (data/spread_predictor.json, data/growth_examples.json; status model).
// Outside NASA's calibration box a value is shown greyed and labelled as an extrapolation, never as a result.
import { h, card } from './lib.js';
import { C, SERIES } from './charts.js';
const NS = 'http://www.w3.org/2000/svg';
const s = (t, a = {}, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
const VERD = { 0: 'Spreads', 1: 'Near a NASA no-spread case', 2: 'NASA saw no spread here' };

export function spreadCard(sp, opts = {}) {
  const cases = sp.cases, O2 = sp.o2_vol_pct, FL = sp.flow_cm_s;
  const pick = (a, v) => a.reduce((b, x, i) => Math.abs(x - v) < Math.abs(a[b] - v) ? i : b, 0);
  const st = { c: Math.max(0, cases.findIndex(c => c.id === (opts.case || 'pmma_slab_1mm_opposed'))), o: pick(O2, opts.o2 ?? 21), f: pick(FL, opts.flow ?? 10) };
  if (opts.o2 == null && opts.flow == null) {   // open on the in-domain cell nearest to normal air and 10 cm/s
    let best = null; cases[st.c].in_domain.forEach((row, i) => row.forEach((d, j) => { if (d) { const sc = Math.abs(O2[i] - 21) + Math.abs(FL[j] - 10) / 4; if (!best || sc < best[0]) best = [sc, i, j]; } }));
    if (best) { st.o = best[1]; st.f = best[2]; }
  }
  const sel = h('select', { 'aria-label': 'Fuel and flow direction' }, ...cases.map((c, i) => h('option', { value: i }, `${c.fuel} · ${c.flow_direction} flow`)));
  const oIn = h('input', { type: 'range', min: 0, max: O2.length - 1, value: st.o, 'aria-label': 'Oxygen' }), fIn = h('input', { type: 'range', min: 0, max: FL.length - 1, value: st.f, 'aria-label': 'Airflow' });
  const oLab = h('b'), fLab = h('b'), out = h('div', { class: 'sp-out', 'aria-live': 'polite' }), note = h('p', { class: 'sp-note' });
  const W = 520, H = 300, m = { l: 48, r: 12, t: 10, b: 40 }, cw = (W - m.l - m.r) / FL.length, ch = (H - m.t - m.b) / O2.length;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Spread rate by oxygen and airflow for the chosen fuel' });
  const draw = () => {
    const c = cases[st.c], r = c.rate_mm_s?.[st.o]?.[st.f], lo = c.lo?.[st.o]?.[st.f], hi = c.hi?.[st.o]?.[st.f], v = c.verdict?.[st.o]?.[st.f], dom = c.in_domain?.[st.o]?.[st.f], cal = c.calibration?.[st.o]?.[st.f];
    oLab.textContent = `${O2[st.o]}% O₂`; fLab.textContent = `${FL[st.f]} cm/s`;
    const max = Math.max(...c.rate_mm_s.flat().filter(x => x != null), 0.01);
    svg.replaceChildren();
    c.rate_mm_s.forEach((row, i) => row.forEach((x, j) => {
      const inD = c.in_domain[i][j], y = m.t + (O2.length - 1 - i) * ch, xx = m.l + j * cw;
      const fill = x == null ? 'transparent' : `color-mix(in srgb, ${SERIES[1]} ${Math.round(15 + 85 * Math.min(1, x / max))}%, ${C.surface})`;
      svg.append(s('rect', { x: xx, y, width: cw + 0.3, height: ch + 0.3, fill, opacity: inD ? 1 : 0.35 }));
      if (c.verdict[i][j] === 2) svg.append(s('text', { x: xx + cw / 2, y: y + ch * 0.8, 'text-anchor': 'middle', style: `fill:${C.ink};font-size:8px` }, '×'));
    }));
    // calibration box outline: in-domain cells get a border
    c.in_domain.forEach((row, i) => row.forEach((d, j) => { if (d) svg.append(s('rect', { x: m.l + j * cw, y: m.t + (O2.length - 1 - i) * ch, width: cw, height: ch, fill: 'none', stroke: C.ink, 'stroke-width': 0.6 })); }));
    svg.append(s('rect', { x: m.l + st.f * cw - 1, y: m.t + (O2.length - 1 - st.o) * ch - 1, width: cw + 2, height: ch + 2, fill: 'none', stroke: C.warn, 'stroke-width': 2.5 }));
    for (const v of [15, 21, 25, 30, 35]) { const i = O2.indexOf(v); if (i >= 0) svg.append(s('text', { x: m.l - 6, y: m.t + (O2.length - 1 - i) * ch + ch * 0.75, 'text-anchor': 'end' }, `${v}%`)); }
    for (const v of [0, 10, 20, 30, 40, 50]) { const j = FL.indexOf(v); if (j >= 0) svg.append(s('text', { x: m.l + j * cw + cw / 2, y: H - m.b + 16, 'text-anchor': 'middle' }, v)); }
    svg.append(s('text', { x: m.l + (W - m.l - m.r) / 2, y: H - 6, 'text-anchor': 'middle' }, `Airflow, cm/s (${c.flow_direction})`));
    out.replaceChildren(...[
      r == null ? h('div', { class: 'sp-big' }, '—', h('small', {}, ' no data and no model here'))
        : h('div', { class: `sp-big ${dom ? '' : 'out'}` }, `${r.toFixed(2)}`, h('small', {}, ` mm/s  [${lo?.toFixed(2)}–${hi?.toFixed(2)}]`)),
      h('div', { class: 'sp-tags' },
        h('span', { class: `lvl ${v === 0 ? '' : 'demo'}` }, VERD[v] ?? '—'),
        h('span', { class: `lvl ${dom ? 'real' : 'demo'}` }, dom ? 'Inside NASA\'s data' : 'Outside NASA\'s data: extrapolation'),
        cal ? h('span', { class: 'lvl' }, cal) : null),
      !dom && r != null ? h('p', { class: 'sp-warn' }, 'These conditions are outside the range NASA tested for this fuel. The number is the model carried beyond its data: treat it as a guess, not a result.') : null].filter(Boolean));
    note.textContent = c.note;
  };
  sel.value = String(st.c);
  sel.onchange = () => { st.c = +sel.value; draw(); }; oIn.oninput = () => { st.o = +oIn.value; draw(); }; fIn.oninput = () => { st.f = +fIn.value; draw(); };
  draw();
  return card('Will it spread, and how fast?', sp.status, 'Flame spread over solid fuels in microgravity at 1 atm, from NASA\'s BASS-II and Saffire flights. Pick a fuel, then move oxygen and airflow.',
    h('div', { class: 'sp-grid' },
      h('div', {}, h('label', { class: 'sp-ctl' }, 'Fuel ', sel), h('label', { class: 'sp-ctl' }, 'Oxygen ', oLab, oIn), h('label', { class: 'sp-ctl' }, 'Airflow ', fLab, fIn), out),
      h('div', {}, svg, h('div', { class: 'legend' }, h('span', {}, h('i', { style: `background:${SERIES[1]}` }), 'faster spread'), h('span', {}, h('i', { style: `border:1px solid ${C.ink};background:none` }), 'inside NASA\'s data'), h('span', {}, '× NASA saw no spread'), h('span', {}, h('i', { style: `border:2px solid ${C.warn};background:none` }), 'your choice')))),
    note, h('p', {}, h('small', {}, `${sp.verdict_meaning} ${sp.limits}`)));
}

export function growthCard(g) {
  const ex = g.examples, sel = h('select', { 'aria-label': 'Example fire' }, ...ex.map((e, i) => h('option', { value: i }, e.title)));
  const box = h('div'), why = h('p');
  const draw = () => {
    const e = ex[+sel.value], t = e.t_s, A = e.area_cm2, W = 560, H = 260, m = { l: 52, r: 14, t: 12, b: 40 };
    const tm = Math.max(...t), am = Math.max(...['lo', 'mid', 'hi'].flatMap(k => A[k] || []).filter(x => x != null), 1);
    const X = v => m.l + v / tm * (W - m.l - m.r), Y = v => H - m.b - v / am * (H - m.t - m.b);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `Burning area over time: ${e.title}` });
    for (let k = 0; k <= 4; k++) { const v = am * k / 4; svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: C.grid }), s('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, v.toFixed(0))); }
    for (let k = 0; k <= 4; k++) { const v = tm * k / 4; svg.append(s('text', { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle' }, v.toFixed(0))); }
    svg.append(s('text', { x: (W + m.l) / 2, y: H - 6, 'text-anchor': 'middle' }, 'Seconds after the flame state'), s('text', { x: 12, y: H / 2, transform: `rotate(-90 12 ${H / 2})`, 'text-anchor': 'middle' }, 'Burning area, cm²'));
    if (A.lo && A.hi) { const pts = t.map((x, i) => `${X(x)},${Y(A.hi[i] ?? 0)}`).concat(t.slice().reverse().map((x, i) => `${X(x)},${Y(A.lo[t.length - 1 - i] ?? 0)}`)); svg.append(s('polygon', { points: pts.join(' '), fill: SERIES[1], opacity: 0.18 })); }
    for (const [k, w] of [['lo', 1.5], ['mid', 2.5], ['hi', 1.5]]) if (A[k]) svg.append(s('polyline', { points: t.map((x, i) => `${X(x)},${Y(A[k][i] ?? 0)}`).join(' '), fill: 'none', stroke: SERIES[1], 'stroke-width': w, 'stroke-dasharray': k === 'mid' ? '' : '4 3' }));
    const S = e.summary.mid || e.summary.hi;
    box.replaceChildren(svg, h('p', { class: 'sp-note' }, `Middle run: largest burning area ${S.max_area_cm2} cm² at ${S.t_max_s} s; stops at ${S.t_end_s} s (${S.stop_reason}). Shaded band: slow-to-fast runs, an envelope, not a confidence interval.`),
      h('details', { class: 'fold' }, h('summary', {}, 'What is calibrated, extrapolated and assumed'), h('ul', {}, ...[...e.calibrated.map(x => ['Calibrated', x]), ...e.extrapolated.map(x => ['Extrapolated', x]), ...e.assumed.map(x => ['Assumed', x])].map(([k, x]) => h('li', {}, h('b', {}, k + ': '), x)))));
    why.textContent = e.why;
  };
  sel.onchange = draw; draw();
  return card('How big does it get, and when does it stop?', g.status, 'The spread predictor run forward in time on three worked examples, from a starting flame to burnout or the fuel edge.', h('label', { class: 'sp-ctl' }, 'Example ', sel), why, box, h('p', {}, h('small', {}, g.limits)));
}
