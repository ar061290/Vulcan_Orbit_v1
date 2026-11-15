// Put it out (#/respond) figures, built from NASA data files and the M7 model outputs (site/REBUILD_PLAN.md §3.7).
// Frozen exports (§2.12): coverageCard, extinctionCard, coolFlameCard, flexCard, efieldCard, mistTrialCard, readingCard.
// mistTrialCard is also meant for the Bench rig page, so it uses only shared component classes (no page-scoped CSS).
// Every number shown here is read from data/gaps.json, data/investigations.json, data/m7_explorer.json,
// data/flex_suppression.json, data/efield.json or data/response_trials.json. Ion wind is not mentioned (spec C6).
import { h, card, empty, fmt, pct, seg, stat, legend, table, isMissing, badge, setParams, tip, untip } from './lib.js';
import { C, SERIES, bars, keyNav, numbers } from './charts.js';
import { efieldText, sentences, SCRAPPED } from './overlays.js';
import { figLink, revealFigure } from './passes.js';

const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, a = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const k in a) if (a[k] != null && a[k] !== false) e.setAttribute(k, a[k]);
  if (text != null) e.textContent = text;
  return e;
};
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isNum = v => typeof v === 'number' && Number.isFinite(v);
// Row marks: a shape per row plus the matching legend mark (lib.legend has no triangle, so triangle comes last).
const ROW_SHAPE = ['circle', 'square', 'diamond', 'triangle'], ROW_MARK = ['dot', 'square', 'diamond', 'dot'];
const o2pct = v => (isNum(v) ? `${(v * 100).toFixed(1)}%` : 'n/a');   // old respond_ui.js format: one decimal, % by volume

/** A dot of the given shape, so rows are not told apart by colour alone (D5.12). */
function mark(kind, cx, cy, r, a) {
  if (kind === 'square') return sv('rect', { x: cx - r * 0.9, y: cy - r * 0.9, width: r * 1.8, height: r * 1.8, rx: 1, ...a });
  if (kind === 'triangle') return sv('path', { d: `M${cx} ${cy - r * 1.15}L${cx + r * 1.05} ${cy + r * 0.8}L${cx - r * 1.05} ${cy + r * 0.8}Z`, ...a });
  if (kind === 'diamond') return sv('path', { d: `M${cx} ${cy - r * 1.25}L${cx + r * 1.1} ${cy}L${cx} ${cy + r * 1.25}L${cx - r * 1.1} ${cy}Z`, ...a });
  return sv('circle', { cx, cy, r, ...a });
}

/** A link to a figure. On the same page it opens the figure's fold and scrolls to it without re-rendering. */
function figA(pageId, title, text) {
  const href = figLink(pageId, title);
  return h('a', { href, onclick: e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    const here = (location.hash.replace(/^#\/?/, '').split('?')[0]) === pageId;
    if (!here || !document.getElementById('view')?.contains(e.currentTarget)) return;
    if (revealFigure(title)) { e.preventDefault(); setParams({ fig: href.split('fig=')[1] }); }
  } }, text);
}

// ---------------------------------------------------------------------------------------------------------------------
// 1. "What does the evidence cover for this fire?"  (gaps.json; investigations.json for names and DOIs)
// ---------------------------------------------------------------------------------------------------------------------
const KINDS = [
  ['solids', 'A solid (fabric, plastic, wiring)'],
  ['liquid droplets', 'A fuel droplet or spray'],
  ['gas flames', 'A gas leak flame'],
];
// "What this site can tell you": main's text, with today's page names and links that open the figure (REBUILD_PLAN §3.7).
const OURS = {
  'solids': [
    ['flame', 'How fast flame crosses a solid', 'Flame lab', 'Spread over thin and thick acrylic vs NASA BASS-II; survival map vs airflow and oxygen'],
    ['detect', 'Blind Spot: who alarms first?', 'Find it', 'How late the cabin smoke detector alarmed in the real Saffire-III fabric fire'],
    ['assess', null, 'Assess', 'Run the spread model on a solid fuel (PMMA, SIBAL fabric or cotton) and see the risk parts'],
  ],
  'liquid droplets': [
    ['respond', 'When does a droplet flame go out?', 'Put it out', 'Oxygen at which a droplet flame goes out, with CO2 or helium (M7, FLEX)'],
    ['respond', 'Looks out, still burning: cool flames', 'Put it out', 'Cool flames that keep burning after the visible flame is out (M7, CFI)'],
    ['flame', 'Droplet burning rate vs NASA FLEX', 'Flame lab', 'Droplet burning rate vs NASA FLEX'],
  ],
  'gas flames': [
    ['flame', 'Flame simulator', 'Flame lab', 'Flame shape in orbit vs Earth for gas jets (model)'],
    ['respond', 'NASA: flames in an electric field', 'Put it out', 'NASA E-FIELD: electric fields on gas flames (not extinguishing)'],
  ],
};
const psiOf = s => (/\b(PSI-\d+)\b/.exec(String(s || '')) || [])[1] || null;

/** Plan §2.12: coverageCard(gaps). `inv` (investigations.json) is an optional extra, used for each investigation's DOI. */
export function coverageCard(gaps, inv) {
  const T = 'What does the evidence cover for this fire?';
  if (isMissing(gaps) || !Array.isArray(gaps.probes) || !gaps.probes.length) {
    return card(T, 'missing', 'Pick a fire and a cabin atmosphere to see how many NASA tests sit near it.',
      empty('Waiting for the evidence map', 'gaps', 'Counts of NASA tests near each cabin atmosphere, by fuel type, built from the NASA tables by scripts/build_gaps.py.',
        '{ "status":"real", "tested":[{ "inv":"FLEX (PSI-69)", "kind":"liquid droplets", "n":..., "o2":[lo,hi], "kpa":[lo,hi] }],\n  "probes":[{ "atmosphere":"ISS cabin air", "o2":..., "kpa":..., "counts":{ "solids":..., "liquid droplets":..., "gas flames":... } }] }'));
  }
  const items = isMissing(inv) ? [] : (inv.items || []);
  const doiFor = name => { const p = psiOf(name); const it = p && items.find(x => x.psi === p); return it?.doi || null; };
  const st = { kind: 'solids', atm: 0 };
  const holder = h('div', { class: 'fr-cov' });
  function draw() {
    const p = gaps.probes[st.atm], n = p?.counts?.[st.kind];
    const tested = (gaps.tested || []).filter(x => x.kind === st.kind);
    const has = isNum(n) && n > 0;
    holder.replaceChildren(
      h('div', { class: 'grid g2 fr-cov-grid' },
        h('div', { class: 'statbox' },
          h('span', { class: 'stat-label' }, `NASA tests near ${p.atmosphere}`),
          h('div', { class: 'stat', style: { color: has ? 'var(--good)' : 'var(--crit)' } }, isNum(n) ? String(n) : 'n/a',
            h('small', {}, has ? 'tests within 3 O₂ points, 10 kPa' : 'none: untested')),
          has ? null : h('p', { class: 'fr-gap' }, h('b', {}, 'Gap: '), 'no NASA test near this atmosphere for this fuel type.')),
        h('div', {},
          h('span', { class: 'stat-label' }, 'Investigations for this fuel type'),
          tested.length ? h('ul', { class: 'fr-inv' }, tested.map(x => {
            const doi = doiFor(x.inv);
            return h('li', {}, h('b', {}, x.inv),
              ` ${x.n} tests, O₂ ${x.o2[0]}–${x.o2[1]}%, ${x.kpa[0]}–${x.kpa[1]} kPa${x.pressure_assumed ? ' (pressure assumed)' : ''}`,
              doi ? h('small', {}, ' · ', h('a', { href: `https://doi.org/${doi}`, rel: 'noopener' }, `doi:${doi}`)) : null);
          })) : h('p', {}, 'No NASA investigation in our tables covers this fuel type.'))),
      h('h3', {}, 'What this site can tell you'),
      h('ul', { class: 'fr-ours' }, (OURS[st.kind] || []).map(([pg, fig, label, text]) =>
        h('li', {}, fig ? figA(pg, fig, label) : h('a', { href: `#/${pg}` }, label), ': ', text))),
      h('p', {}, has
        ? 'There is NASA data near this atmosphere, so the results above are inside or near what was tested.'
        : 'No NASA test is near this atmosphere for this fuel type, so anything here is an extrapolation. That is a gap, not an answer.'));
  }
  draw();
  return card(T, gaps.status, 'Pick a fire and a cabin atmosphere. This is a map of evidence, not a firefighting procedure.',
    seg({ label: 'Fire', options: KINDS, value: st.kind, onChange: v => { st.kind = v; draw(); } }),
    seg({ label: 'Cabin', options: gaps.probes.map((p, i) => [i, p.atmosphere]), value: st.atm, onChange: v => { st.atm = Number(v); draw(); } }),
    holder);
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. "When does a droplet flame go out?"  (m7_explorer.extinction)
// ---------------------------------------------------------------------------------------------------------------------
const gasLabel = g => (g === 'no added gas' ? 'No added gas' : `${g} for N₂`);
const refitsOf = note => (/(\d[\d,]*)\s+session-bootstrap refits/.exec(note || '') || [])[1] || null;

export function extinctionCard(m7) {
  const T = 'When does a droplet flame go out?';
  const x = m7?.extinction;
  if (isMissing(m7) || !x || !Array.isArray(x.table) || !x.table.length) {
    return card(T, 'missing', 'The oxygen level at which a droplet flame has a 50% chance of going out, by fuel, pressure and added gas.',
      empty('Waiting for the M7 explorer file', 'm7_explorer', 'Built from the M7 extinction model by scripts/build_m7_explorer.py.',
        '{ "status":"model", "extinction":{ "rows":..., "headline":{ "auc_median":..., "auc_session_bootstrap_95":[lo,hi] },\n  "table":[{ "fuel":"heptane", "p_atm":..., "added_gas":"no added gas", "o2_half":..., "o2_half_range":[lo,hi] }] } }'));
  }
  const T0 = x.table;
  const fuels = [...new Set(T0.map(t => t.fuel))];
  const press = [...new Set(T0.map(t => t.p_atm))].sort((a, b) => b - a);
  const st = { fuel: fuels.includes('heptane') ? 'heptane' : fuels[0], p: press.includes(1.0) ? 1.0 : press[0] };   // main's defaults
  const all = T0.flatMap(t => [t.o2_half, ...(t.o2_half_range || [])]).filter(isNum);
  // x range: main's 16–34% view, widened only if a value would fall outside it
  const lo = Math.min(0.16, Math.floor(Math.min(...all) / 0.02) * 0.02), hi = Math.max(0.34, Math.ceil(Math.max(...all) / 0.02) * 0.02);
  const AIR = 0.21;   // source: main's js/respond_ui.js "air" line; dry air is about 21% oxygen by volume
  const holder = h('div');
  const refits = refitsOf(x.note);
  function draw() {
    const rows = T0.filter(t => t.fuel === st.fuel && t.p_atm === st.p);
    const W = 620, m = { l: 160, r: 64, t: 14, b: 40 }, rowH = 52;
    const H = Math.max(210, m.t + 26 + Math.max(0, rows.length - 1) * rowH + 30 + m.b);
    const X = v => m.l + (v - lo) / (hi - lo) * (W - m.l - m.r);
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart' });
    for (let v = lo; v <= hi + 1e-9; v += 0.04) {
      svg.append(sv('line', { class: 'ch-grid', x1: X(v), x2: X(v), y1: m.t, y2: H - m.b }),
        sv('text', { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle' }, `${Math.round(v * 100)}%`));
    }
    svg.append(sv('line', { class: 'ch-mute', x1: X(AIR), x2: X(AIR), y1: m.t, y2: H - m.b, 'stroke-dasharray': '4 4' }),
      sv('text', { x: X(AIR) + 4, y: m.t + 10, class: 'ch-ink' }, 'air'),
      sv('text', { x: m.l + (W - m.l - m.r) / 2, y: H - 4, 'text-anchor': 'middle' }, 'Oxygen, % by volume'));
    const items = [];
    rows.forEach((r, i) => {
      const y = m.t + 26 + i * rowH, col = SERIES[i % SERIES.length], [a, b] = r.o2_half_range || [];
      svg.append(sv('text', { x: m.l - 12, y: y + 4, 'text-anchor': 'end', class: 'ch-ink' }, gasLabel(r.added_gas)));
      if (isNum(a) && isNum(b)) svg.append(sv('line', { x1: X(a), x2: X(b), y1: y, y2: y, stroke: col, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.45 }));
      const dot = mark(ROW_SHAPE[i % 4], X(r.o2_half), y, 6, { fill: col, class: 'ch-surf', 'stroke-width': 2 });
      const html = `<b>${esc(gasLabel(r.added_gas))}</b><br>${esc(st.fuel)}, ${esc(st.p)} atm<br>50% chance of going out at <b>${o2pct(r.o2_half)}</b> O₂<br>95% range ${o2pct(a)}–${o2pct(b)}`;
      dot.addEventListener('pointermove', e => tip(e, html));
      dot.addEventListener('pointerdown', e => tip(e, html));
      dot.addEventListener('pointerleave', untip);
      svg.append(dot, sv('text', { x: X(isNum(b) ? b : r.o2_half) + 8, y: y + 4, class: 'ch-ink' }, o2pct(r.o2_half)));
      items.push({ html, anchor: dot });
    });
    keyNav(svg, items, { label: `${T} Oxygen at a 50% chance of extinction for ${st.fuel} at ${st.p} atm, by added gas` });
    holder.replaceChildren(
      h('div', { class: 'chart-wrap' }, svg,
        legend(rows.map((r, i) => ({ label: gasLabel(r.added_gas), color: SERIES[i % SERIES.length], mark: ROW_MARK[i % 4] }))),
        numbers(`${st.fuel} at ${st.p} atm: oxygen at a 50% chance the flame goes out (model output)`,
          ['Added gas', 'O₂ at 50% chance, % by volume', '95% range low', '95% range high'],
          rows.map(r => [gasLabel(r.added_gas), o2pct(r.o2_half), o2pct(r.o2_half_range?.[0]), o2pct(r.o2_half_range?.[1])]))),
      h('p', { class: 'fr-cap' }, h('small', {}, `Dot: oxygen at which the model gives a 50% chance the flame goes out. Bar: 95% range from ${refits ? refits + ' refits' : 'repeated refits'}. Below the dot, flames mostly go out; above it, they mostly keep burning.`)));
  }
  draw();
  const hd = x.headline || {}, r95 = hd.auc_session_bootstrap_95 || [];
  const auc = isNum(hd.auc_median) ? `AUC ${hd.auc_median.toFixed(2)}${isNum(r95[0]) && isNum(r95[1]) ? ` (${r95[0].toFixed(2)}–${r95[1].toFixed(2)})` : ''}` : 'AUC not in the file';
  const drivers = (x.drivers || []).map(d => `${d.name} ${Math.round(d.share * 100)}%`).join(', ');
  return card(T, m7.status, `M7 model trained on ${x.rows} NASA FLEX burns. Score on held-out test days: ${auc}.`,
    seg({ label: 'Fuel', options: fuels.map(f => [f, f]), value: st.fuel, onChange: v => { st.fuel = v; draw(); } }),
    seg({ label: 'Pressure', options: press.map(p => [p, `${p} atm`]), value: st.p, onChange: v => { st.p = Number(v); draw(); } }),
    holder,
    h('p', {}, h('small', {}, [x.note, drivers ? `Drivers: ${drivers}.` : null, m7.source ? `${m7.source}.` : null].filter(Boolean).join(' '))));
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. "Looks out, still burning: cool flames"  (m7_explorer.cool_flame)
// ---------------------------------------------------------------------------------------------------------------------
/** Where a pressure sits on the categorical pressure axis: a fractional bar index, interpolated between neighbours. */
function fracIndex(ps, P) {
  if (!isNum(P) || !ps.length) return null;
  const k = ps.indexOf(P); if (k >= 0) return k;
  for (let i = 0; i < ps.length - 1; i++) if (P > ps[i] && P < ps[i + 1]) return i + (P - ps[i]) / (ps[i + 1] - ps[i]);
  return null;   // outside the tested pressures: no marker is drawn, the text still gives the value
}

export function coolFlameCard(m7) {
  const T = 'Looks out, still burning: cool flames';
  const cf = m7?.cool_flame;
  if (isMissing(m7) || !cf || !Array.isArray(cf.observed)) {
    return card(T, 'missing', 'After the visible flame goes out, a cool flame can keep eating the fuel.',
      empty('Waiting for the M7 explorer file', 'm7_explorer', 'Cool-flame counts from NASA CFI burns and the M7 cool-flame model, built by scripts/build_m7_explorer.py.',
        '{ "status":"model", "cool_flame":{ "pressure_at_half_atm":..., "headline":{ "auc_median":..., "auc_session_bootstrap_95":[lo,hi] },\n  "observed":[{ "p_atm":..., "x_he":0, "burns":..., "used_up":... }] } }'));
  }
  const obs = cf.observed.filter(o => o.x_he === 0).sort((a, b) => a.p_atm - b.p_atm);
  const ps = obs.map(o => o.p_atm), P = cf.pressure_at_half_atm, at = fracIndex(ps, P);
  const hd = cf.headline || {}, r95 = hd.auc_session_bootstrap_95 || [];
  const auc = isNum(hd.auc_median) ? `AUC ${hd.auc_median.toFixed(2)}${isNum(r95[0]) && isNum(r95[1]) ? ` (${r95[0].toFixed(2)}–${r95[1].toFixed(2)})` : ''}` : null;
  const chart = bars({
    title: T,
    yLabel: 'Burns where the cool flame used up the droplet, %', unit: '%', yMax: 100,
    groups: obs.map(o => ({ name: `${o.p_atm} atm`, values: [{ key: `${o.used_up} of ${o.burns} burns`, value: Math.round(o.used_up / o.burns * 100), color: C.s2,
      label: `<b>${esc(o.p_atm)} atm</b><br>Fuel used up by the cool flame in <b>${esc(o.used_up)} of ${esc(o.burns)}</b> burns (${pct(o.used_up / o.burns)})` }] })),
    xMarkers: at == null ? [] : [{ at, label: `Model 50% point: ${fmt(P, 2)} atm` }],
  });
  return card(T, m7.status, 'After the visible flame goes out, a cool flame can keep eating the fuel. Share of NASA CFI burns (air, no helium) where it burned the droplet away, by pressure.',
    chart,
    h('p', {}, `In this data, higher pressure makes it far more likely that a cool flame finishes the fuel. The M7 model puts the 50% point near `,
      h('b', {}, `${fmt(P, 1)} atm`), cf.pressure_at_half_case ? ` (${cf.pressure_at_half_case})` : null, auc ? `; ${auc} on held-out sessions.` : '.'),
    h('p', {}, h('small', {}, `The dashed line marks the model's 50% point (${fmt(P, 2)} atm). The pressure axis lists the tested pressures in order, so the line is placed between the two nearest bars by straight-line interpolation. `,
      cf.cfig_quote ? `Gas flames too: ${cf.cfig_quote}${cf.cfig_source ? ` (${cf.cfig_source})` : ''}. ` : '',
      'Counts are burns that ended "fuel used up" out of all analysed burns at that pressure.')));
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. "NASA: which gas puts a droplet flame out"  (flex_suppression, beside the M7 50% O₂ points; spec C10 #17)
// ---------------------------------------------------------------------------------------------------------------------
const gasKey = g => { const s = String(g || ''); if (/^none\b|no added gas/i.test(s)) return 'none'; if (/co2/i.test(s)) return 'CO2'; if (/\bhe\b|helium/i.test(s)) return 'He'; return s; };
const FLEX_LABEL = { none: 'Nitrogen only, no added suppressant', CO2: 'Added carbon dioxide (CO₂)', He: 'Added helium (He)' };

export function flexCard(flex, m7) {
  const T = 'NASA: which gas puts a droplet flame out';
  if (isMissing(flex) || !Array.isArray(flex.groups) || !flex.groups.length) {
    return card(T, 'missing', 'Share of FLEX tests that ended in extinction, by added gas.',
      empty('Waiting for the FLEX table', 'flex_suppression', 'Counts per suppressant gas from the FLEX summary table.',
        '{ "status":"real", "source":"PSI-69 ...", "groups":[{ "gas":"CO2", "tests":..., "extinguished":... }] }'));
  }
  const groups = flex.groups.map(g => ({ ...g, key: gasKey(g.gas), label: FLEX_LABEL[gasKey(g.gas)] || g.gas }));
  const chart = bars({
    title: T,
    yLabel: 'Tests ending in extinction, %', unit: '%', yMax: 100,
    groups: groups.map(g => ({ name: g.label, values: [{ key: `${g.extinguished} of ${g.tests} tests`, value: Math.round(g.extinguished / g.tests * 100), color: C.s3,
      label: `<b>${esc(g.label)}</b><br>NASA file label: ${esc(g.gas)}<br><b>${esc(g.extinguished)} of ${esc(g.tests)}</b> tests ended in extinction (${pct(g.extinguished / g.tests)})` }] })),
  });
  const src = String(flex.source || '');
  const ss = sentences(src).map(s => s.trim()).filter(Boolean);
  const caveat = ss.find(s => /controlled comparison/i.test(s)) || null;
  const cite = ss.filter(s => s !== caveat).join(' ');

  // Beside it: the M7 model's 50% oxygen point for each added gas, for every fuel and pressure in the file.
  let model;
  const tb = m7?.extinction?.table;
  if (isMissing(m7) || !Array.isArray(tb) || !tb.length) {
    model = h('p', {}, 'The M7 model points are not available yet (data/m7_explorer.json missing).');
  } else {
    const combos = [];
    for (const t of tb) if (!combos.some(c => c.fuel === t.fuel && c.p === t.p_atm)) combos.push({ fuel: t.fuel, p: t.p_atm });
    combos.sort((a, b) => (a.fuel < b.fuel ? 1 : a.fuel > b.fuel ? -1 : b.p - a.p));   // heptane first, 1 atm before 0.7 atm, as on the extinction card
    const rowsOut = groups.map(g => {
      const cells = combos.map(c => {
        const r = tb.find(t => t.fuel === c.fuel && t.p_atm === c.p && gasKey(t.added_gas) === g.key);
        return r ? `${o2pct(r.o2_half)} (${o2pct(r.o2_half_range?.[0])}–${o2pct(r.o2_half_range?.[1])})` : 'not in the model table';
      });
      return [g.label, `${g.extinguished} of ${g.tests} (${pct(g.extinguished / g.tests)})`, ...cells];
    });
    const m7gas = [...new Set(tb.map(t => t.added_gas))].filter(a => a !== 'no added gas');
    model = h('div', { class: 'fr-beside' },
      h('h3', {}, 'Beside it: the M7 model\'s 50% oxygen point for each added gas ', badge(m7.status)),
      table(['Added gas', h('span', {}, 'NASA FLEX: tests ending in extinction ', badge(flex.status)),
        ...combos.map(c => `M7: ${c.fuel}, ${c.p} atm`)], rowsOut,
        { caption: `Two sources side by side, never merged. FLEX shares are counts from all NASA burns; the M7 columns are model output: the oxygen (% by volume) at which the flame has a 50% chance of going out, with its 95% range.${m7gas.length ? ` In the model table the added gas replaces nitrogen (${m7gas.join(', ')}).` : ''}` }));
  }
  return card(T, flex.status, 'Share of FLEX tests that ended in extinction, by added gas, labelled "N of M tests".',
    chart,
    caveat ? h('blockquote', { class: 'fr-quote' }, h('p', {}, caveat), h('footer', {}, 'From the FLEX source note in data/flex_suppression.json')) : null,
    model,
    cite ? h('p', {}, h('small', {}, cite)) : null);
}

// ---------------------------------------------------------------------------------------------------------------------
// 6. "NASA: flames in an electric field"  (efield; NASA context only, spec C6)
// ---------------------------------------------------------------------------------------------------------------------
const HEAD = { round: 'Test round', date: 'Date', mesh_polarity: 'Mesh polarity', fuel: 'Fuel', fuel_conc: 'Fuel concentration', flames_ignited: 'Flames ignited' };
const human = k => HEAD[k] || String(k).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

export function efieldCard(ef) {
  const T = 'NASA: flames in an electric field';
  if (isMissing(ef)) {
    return card(T, 'missing', 'What the ACME E-FIELD Flames experiment studied in orbit, shown as NASA context.',
      empty('Waiting for the E-FIELD table', 'efield', 'Rows from the NASA experiment table, plus a short finding with its source.',
        '{ "status":"real", "source":"NASA PSI-22 ...", "finding":"...", "units":{ "flames_ignited":"count" },\n  "totals":{ "test_days":..., "flames_ignited":... }, "rows":[{ "round":"...", "date":"...", "fuel":"...", "flames_ignited":... }] }'));
  }
  const rows = Array.isArray(ef.rows) ? ef.rows : [];
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const units = ef.units || {};
  const tot = ef.totals || {};
  return card(T, ef.status, ef.source || null,
    h('p', {}, efieldText(ef)),
    h('p', {}, h('b', {}, 'Shown as NASA context only. '), 'This panel shows what NASA studied with electric fields on flames. It is not evidence about putting fires out.'),
    ef.quotes?.objective ? h('blockquote', { class: 'fr-quote' }, h('p', {}, `“${ef.quotes.objective}”`), h('footer', {}, 'NASA\'s stated objective, quoted in data/efield.json')) : null,
    (isNum(tot.test_days) || isNum(tot.flames_ignited)) ? h('div', { class: 'grid g2 fr-stats' },
      isNum(tot.test_days) ? stat('Test days on the station', String(tot.test_days)) : null,
      isNum(tot.flames_ignited) ? stat('Flames ignited', String(tot.flames_ignited), units.flames_ignited ? `(${units.flames_ignited})` : null) : null) : null,
    rows.length ? table(keys.map(k => units[k] ? `${human(k)} (${units[k]})` : human(k)), rows.map(r => keys.map(k => String(r[k] ?? ''))),
      { caption: `${rows.length} rows from NASA's E-FIELD Flames experiment table.` }) : h('p', {}, 'The file has no table rows.'));
}

// ---------------------------------------------------------------------------------------------------------------------
// 7. "Bench mist trial"  (response_trials; spec C6: not completed unless status "dome", then mist rows only)
// ---------------------------------------------------------------------------------------------------------------------
const MIST = /mist/i;
/** The mist rows that can be drawn: status "dome", method mentions mist, finite before and after. */
export function mistRows(tr) {
  if (isMissing(tr) || tr.status !== 'dome' || !Array.isArray(tr.trials)) return [];
  return tr.trials.filter(t => MIST.test(String(t.method || '')) && isNum(t.before) && isNum(t.after));
}

export function mistTrialCard(tr) {
  const T = 'Bench mist trial';
  const optional = SCRAPPED.optional.includes('response_trials') ? ' This trial is optional.' : '';
  const schema = '{ "status":"dome", "reading":"<the dome sensor reading used>", "unit":"<its unit>",\n  "trials":[{ "method":"Fine mist", "source":"<flame source>", "before":<number>, "after":<number>, "repeat":1, "note":"" }] }';
  const rows = mistRows(tr);
  if (!rows.length) {
    const why = isMissing(tr)
      ? null
      : tr.status !== 'dome'
        ? `data/response_trials.json has status "${tr.status}", not "dome", so nothing from it is drawn.`
        : 'data/response_trials.json has no fine-mist rows with a before and an after value, so nothing is drawn.';
    return card(T, isMissing(tr) ? 'missing' : tr.status, `Measured by the dome's own sensors, before and after each mist run, at Earth gravity.${optional}`,
      h('p', {}, h('b', {}, 'Bench mist trial: not completed.')),
      why ? h('p', {}, why) : null,
      empty('Waiting for the mist trial', 'response_trials', 'One entry per run, repeated at least 3 times. Use the same dome sensor reading before and after, so the change is measured, not judged by eye.', schema));
  }
  const unit = tr.unit || '';
  const chg = t => (t.before !== 0 ? (t.after - t.before) / t.before * 100 : null);
  const ch = rows.map(chg).filter(isNum);
  const mean = ch.length ? ch.reduce((a, b) => a + b, 0) / ch.length : null;
  return card(T, tr.status, `${tr.reading}, before and after each mist run. Earth gravity.${optional}`,
    bars({
      title: T,
      yLabel: `${tr.reading}${unit ? ', ' + unit : ''}`, unit: unit ? ' ' + unit : '',
      groups: rows.map(t => ({ name: `${t.method} #${t.repeat || 1}`, values: [{ key: 'Before', value: t.before, color: C.s1 }, { key: 'After', value: t.after, color: C.s2 }] })),
    }),
    ch.length ? h('p', {}, `Change across ${ch.length} run${ch.length > 1 ? 's' : ''}: mean ${fmt(mean, 0)}%, from ${fmt(Math.min(...ch), 0)}% to ${fmt(Math.max(...ch), 0)}%.`) : null,
    table(['Method', 'Source', `Before${unit ? ` (${unit})` : ''}`, `After${unit ? ` (${unit})` : ''}`, 'Change', 'Note'],
      rows.map(t => [h('b', {}, t.method), t.source || '', fmt(t.before), fmt(t.after), isNum(chg(t)) ? `${fmt(chg(t), 0)}%` : 'n/a', t.note || ''])),
    h('p', {}, h('small', {}, 'A bench result shows that mist can disturb a flame at Earth gravity. It does not show that mist works in orbit.')));
}

// ---------------------------------------------------------------------------------------------------------------------
// 8. "Reading the comparison"  ("Where the two meet": NASA beside the bench, never merged)
// ---------------------------------------------------------------------------------------------------------------------
export function readingCard() {
  return card('Reading the comparison', 'team', null,
    h('div', { class: 'grid g2' },
      h('div', {}, h('h3', {}, 'NASA, in orbit'),
        h('p', {}, figA('respond', 'NASA: which gas puts a droplet flame out', 'Which gas puts a droplet flame out'), ': counts from NASA FLEX burns in microgravity.')),
      h('div', {}, h('h3', {}, 'Our bench, at Earth gravity'),
        h('p', {}, figA('respond', 'Bench mist trial', 'Bench mist trial'), ': dome sensor readings before and after a fine-mist run.'))),
    h('p', {}, 'Our mist trial runs at Earth gravity, where hot gas rises and feeds the flame fresh air. A result on the bench shows a method can disturb a flame; it does not show it would work in orbit.'),
    h('p', {}, 'The two are shown side by side and never merged into one number.'),
    h('p', {}, 'This page summarises evidence. It is not a firefighting procedure.'));
}
