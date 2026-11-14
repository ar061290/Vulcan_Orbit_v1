// Respond page panels built on the M7 models (data/m7_explorer.json) and the evidence gap map (data/gaps.json).
import { h, card, fmt } from './lib.js';
import { C, SERIES } from './charts.js';

function chips(label, opts, cur, onPick, show = o => o) {
  const wrap = h('div', { class: 'row', style: 'margin-bottom:8px' }, h('label', { style: 'min-width:70px' }, label));
  for (const o of opts) { const b = h('button', { class: 'chip', 'aria-pressed': String(o === cur), onclick: () => { wrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b))); onPick(o); } }, show(o)); wrap.append(b); }
  return wrap;
}

/** #10 + #17: oxygen level where a 3 mm droplet has a 50% chance of going out, by fuel, pressure and added gas. */
export function extinctionCard(x) {
  const T = x.extinction.table, st = { fuel: 'heptane', p: 1.0 }, holder = h('div');
  const W = 620, H = 210, m = { l: 160, r: 30, t: 14, b: 40 }, lo = 0.16, hi = 0.34, X = v => m.l + (v - lo) / (hi - lo) * (W - m.l - m.r);
  function draw() {
    const rows = T.filter(t => t.fuel === st.fuel && t.p_atm === st.p);
    const NS = 'http://www.w3.org/2000/svg', s = (t, a = {}, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
    const root = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Oxygen at 50% chance of extinction' });
    for (const v of [0.16, 0.20, 0.24, 0.28, 0.32]) { root.append(s('line', { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, stroke: C.grid }), s('text', { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle' }, `${Math.round(v * 100)}%`)); }
    root.append(s('line', { x1: X(0.21), x2: X(0.21), y1: m.t, y2: H - m.b, stroke: C.mute, 'stroke-dasharray': '4 4' }), s('text', { x: X(0.21) + 4, y: m.t + 10, fill: C.ink }, 'air'));
    root.append(s('text', { x: m.l + (W - m.l - m.r) / 2, y: H - 4, 'text-anchor': 'middle' }, 'Oxygen, % by volume'));
    rows.forEach((r, i) => {
      const y = m.t + 26 + i * 52, col = SERIES[i];
      root.append(s('text', { x: m.l - 12, y: y + 4, 'text-anchor': 'end', fill: C.ink }, r.added_gas === 'no added gas' ? 'No added gas' : `${r.added_gas} for N₂`));
      root.append(s('line', { x1: X(r.o2_half_range[0]), x2: X(r.o2_half_range[1]), y1: y, y2: y, stroke: col, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.45 }));
      root.append(s('circle', { cx: X(r.o2_half), cy: y, r: 6, fill: col, stroke: C.surface, 'stroke-width': 2 }));
      root.append(s('text', { x: X(r.o2_half_range[1]) + 8, y: y + 4, fill: C.ink }, `${(r.o2_half * 100).toFixed(1)}%`));
    });
    holder.replaceChildren(root, h('p', { style: 'margin-top:6px' }, h('small', {}, 'Dot: oxygen at which the model gives a 50% chance the flame goes out. Bar: 95% range from 200 refits. Below the dot, flames mostly go out; above it, they mostly keep burning.')));
  }
  draw();
  const hd = x.extinction.headline;
  return card('When does a droplet flame go out?', x.status, `M7 model trained on ${x.extinction.rows} NASA FLEX burns. Score on held-out test days: AUC ${hd.auc_median.toFixed(2)} (${hd.auc_session_bootstrap_95[0].toFixed(2)}–${hd.auc_session_bootstrap_95[1].toFixed(2)}).`,
    chips('Fuel', ['heptane', 'methanol'], st.fuel, v => { st.fuel = v; draw(); }), chips('Pressure', [1.0, 0.7], st.p, v => { st.p = v; draw(); }, o => `${o} atm`),
    holder, h('p', {}, h('small', {}, x.extinction.note + ' Drivers: ' + x.extinction.drivers.map(d => `${d.name} ${Math.round(d.share * 100)}%`).join(', ') + '. ' + x.source + '.')));
}

/** #11: cool flames that keep burning after the visible flame goes out. */
export function coolFlameCard(x) {
  const cf = x.cool_flame, obs = cf.observed.filter(o => o.x_he === 0).sort((a, b) => a.p_atm - b.p_atm);
  const W = 620, H = 220, m = { l: 48, r: 16, t: 14, b: 40 }, bw = (W - m.l - m.r) / obs.length;
  const NS = 'http://www.w3.org/2000/svg', s = (t, a = {}, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
  const root = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Share of burns where the cool flame used up the droplet, by pressure' });
  const Y = v => m.t + (1 - v) * (H - m.t - m.b);
  for (const v of [0, 0.5, 1]) root.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: C.grid }), s('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, `${v * 100}%`));
  obs.forEach((o, i) => {
    const sh = o.used_up / o.burns, x0 = m.l + i * bw + 6, w = bw - 12;
    root.append(s('rect', { x: x0, y: Y(sh), width: w, height: Y(0) - Y(sh), rx: 4, fill: C.s2 }));
    root.append(s('text', { x: x0 + w / 2, y: Y(sh) - 6, 'text-anchor': 'middle', fill: C.ink }, `${o.used_up}/${o.burns}`));
    root.append(s('text', { x: x0 + w / 2, y: H - m.b + 16, 'text-anchor': 'middle' }, `${o.p_atm} atm`));
  });
  return card('Looks out, still burning: cool flames', x.status, 'After the visible flame goes out, a cool flame can keep eating the fuel. Share of NASA CFI burns (air, no helium) where it burned the droplet away, by pressure.',
    root, h('p', { style: 'margin-top:6px' }, `In this data, higher pressure makes it far more likely that a cool flame finishes the fuel. The M7 model puts the 50% point near `, h('b', {}, `${fmt(cf.pressure_at_half_atm, 1)} atm`), ` (${cf.pressure_at_half_case}); AUC ${cf.headline.auc_median.toFixed(2)} on held-out sessions.`),
    h('p', {}, h('small', {}, `Gas flames too: ${cf.cfig_quote} (${cf.cfig_source}). Counts are burns that ended "fuel used up" out of all analysed burns at that pressure.`)));
}

/** #18: for a chosen fire, which NASA evidence covers it and which of our results apply. */
export function evidenceCard(gaps, inv) {
  const st = { kind: 'solids', atm: 0 }, holder = h('div');
  const kinds = { 'solids': 'A solid (fabric, plastic, wiring)', 'liquid droplets': 'A fuel droplet or spray', 'gas flames': 'A gas leak flame' };
  const ours = {
    'solids': [['Flame page', 'Spread over thin and thick acrylic vs NASA BASS-II; survival map vs airflow and oxygen', '#/flame'], ['Detect page', 'How late the cabin smoke detector alarmed in the real Saffire-III fabric fire', '#/detect']],
    'liquid droplets': [['Respond page', 'Oxygen at which a droplet flame goes out, with CO2 or helium (M7, FLEX)', '#/respond'], ['Respond page', 'Cool flames that keep burning after the visible flame is out (M7, CFI)', '#/respond'], ['Flame page', 'Droplet burning rate vs NASA FLEX', '#/flame']],
    'gas flames': [['Flame page', 'Flame shape in orbit vs Earth for gas jets (model)', '#/flame'], ['Respond page', 'NASA E-FIELD: electric fields on gas flames (not extinguishing)', '#/respond']],
  };
  function draw() {
    const p = gaps.probes[st.atm], n = p.counts[st.kind], t = gaps.tested.filter(x => x.kind === st.kind);
    holder.replaceChildren(
      h('div', { class: 'grid g2', style: 'margin:6px 0 10px' },
        h('div', {}, h('small', {}, `NASA tests near ${p.atmosphere}`), h('div', { class: 'stat', style: `color:${n ? 'var(--good)' : 'var(--crit)'}` }, String(n), h('small', {}, n ? 'tests within 3 O₂ points, 10 kPa' : 'none: untested'))),
        h('div', {}, h('small', {}, 'Investigations for this fuel type'), h('div', { style: 'margin-top:6px' }, ...t.map(x => h('div', {}, h('b', {}, x.inv), h('small', {}, ` ${x.n} tests, O₂ ${x.o2[0]}–${x.o2[1]}%, ${x.kpa[0]}–${x.kpa[1]} kPa${x.pressure_assumed ? ' (pressure assumed)' : ''}`)))))),
      h('h3', {}, 'What this site can tell you'), h('ul', { style: 'margin:0 0 8px;padding-left:18px' }, ...ours[st.kind].map(([pg, txt, href]) => h('li', {}, h('a', { href }, pg), ': ', txt))),
      h('p', {}, h('small', {}, n ? 'There is NASA data near this atmosphere, so the results above are inside or near what was tested.' : 'No NASA test is near this atmosphere for this fuel type, so anything here is an extrapolation. That is a gap, not an answer.')));
  }
  draw();
  return card('What does the evidence cover for this fire?', gaps.status, 'Pick a fire and a cabin atmosphere. This is a map of evidence, not a firefighting procedure.',
    h('div', { class: 'row', style: 'margin-bottom:8px' }, h('label', { style: 'min-width:70px' }, 'Fire'), ...Object.entries(kinds).map(([k, l]) => { const b = h('button', { class: 'chip', 'aria-pressed': String(k === st.kind), onclick: () => { st.kind = k; b.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b))); draw(); } }, l); return b; })),
    h('div', { class: 'row', style: 'margin-bottom:8px' }, h('label', { style: 'min-width:70px' }, 'Cabin'), ...gaps.probes.map((p, i) => { const b = h('button', { class: 'chip', 'aria-pressed': String(i === st.atm), onclick: () => { st.atm = i; b.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b))); draw(); } }, p.atmosphere); return b; })),
    holder);
}
