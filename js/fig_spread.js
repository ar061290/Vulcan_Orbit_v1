// M6b flame-spread predictor, its growth examples, its score card and the spread-vs-airflow chart (Predict it).
// Data: data/spread_predictor.json, data/growth_examples.json (status model) and models/m6b-predictor/results.json.
// Ported from main's js/spread_ui.js (wording kept); site/REBUILD_PLAN.md §2.12 and §3.6 rows 8-11.
// Outside NASA's calibration box a value is shown greyed and labelled as an extrapolation, never as a result.
// No number is typed in here: every value is read from those files or computed by js/growth.js spreadRates() from
// spread_predictor.json -> constants. The heatmap tick lists and the 21% O2 / 10 cm/s starting cell are main's.
import { h, card, empty, isMissing, sig, pct, tip, untip, announce, setParams, numField, stat, table, fold } from './lib.js';
import { C, SERIES, lineChart, scatter, keyNav, numbers } from './charts.js';
import { spreadRates } from './growth.js';
import { figLink } from './passes.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (t, a = {}, txt) => { const e = document.createElementNS(NS, t); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
const isF = Number.isFinite;
const cap = t => (t ? t[0].toUpperCase() + t.slice(1) : t);
const note = (...kids) => h('p', {}, h('small', {}, ...kids));
const missingCard = (title, file, why, schema) => card(title, 'missing', null, empty('No data yet', file, why, schema));
let nid = 0;
const uid = p => `${p}-${++nid}`;
/** Index of the grid value nearest v (first one on a tie). */
const pick = (a, v) => a.reduce((b, x, i) => (Math.abs(x - v) < Math.abs(a[b] - v) ? i : b), 0);
/** Step of an evenly spaced grid, or 'any' when it is not even. */
const stepOf = a => { if (a.length < 2) return 'any'; const d = a[1] - a[0]; return a.every((x, i) => !i || Math.abs(x - a[i - 1] - d) < 1e-9) ? d : 'any'; };
const f2 = v => (isF(v) ? v.toFixed(2) : 'n/a');     // main's readout format: rate.toFixed(2)
const SP_SCHEMA = '{ "status":"model", "o2_vol_pct":[15,…,35], "flow_cm_s":[0,…,50], "verdict_codes":{"0":"spreads",…},\n  "cases":[{ "id", "fuel", "material", "thickness_mm", "sides_burning", "flow_direction",\n    "rate_mm_s":[[…]], "lo":[[…]], "hi":[[…]], "verdict":[[…]], "in_domain":[[…]], "calibration":[[…]], "note" }],\n  "constants":{…}, "verdict_meaning":"…", "limits":"…" }';

// ---------------------------------------------------------------------------------------------------------------------
// "Will it spread, and how fast?" [NIS] (#9): the M6b grid for one fuel, by oxygen and airflow.
// opts: {case, o2, flow} from ?fuel=&o2=&flow= (nearest grid value), ctx (detached: never write the URL or announce).
export function spreadCard(sp, opts = {}) {
  const title = 'Will it spread, and how fast?';
  if (isMissing(sp) || !Array.isArray(sp.cases) || !sp.cases.length) return missingCard(title, 'spread_predictor', 'The M6b spread predictor grid is built by models/m6b-predictor/build.py.', SP_SCHEMA);
  const cases = sp.cases, O2 = sp.o2_vol_pct, FL = sp.flow_cm_s, live = !opts.ctx?.detached;
  const VERD = code => cap(sp.verdict_codes?.[String(code)]) || 'n/a';
  const at = (c, k, i, j) => c[k]?.[i]?.[j];
  const want = Number(opts.o2), wantF = Number(opts.flow), hasO = isF(want) && opts.o2 !== '' && opts.o2 != null, hasF = isF(wantF) && opts.flow !== '' && opts.flow != null;
  const st = { c: Math.max(0, cases.findIndex(c => c.id === (opts.case || 'pmma_slab_1mm_opposed'))), o: pick(O2, hasO ? want : 21), f: pick(FL, hasF ? wantF : 10) };
  if (!hasO && !hasF) {   // open on the in-domain cell nearest to normal air and 10 cm/s (main's rule)
    let best = null;
    (cases[st.c].in_domain || []).forEach((row, i) => row.forEach((d, j) => { if (d) { const sc = Math.abs(O2[i] - 21) + Math.abs(FL[j] - 10) / 4; if (!best || sc < best[0]) best = [sc, i, j]; } }));
    if (best) { st.o = best[1]; st.f = best[2]; }
  }

  const selId = uid('sp-fuel');
  const sel = h('select', { id: selId }, cases.map((c, i) => h('option', { value: i }, `${c.fuel} · ${c.flow_direction} flow`)));
  sel.value = String(st.c);
  const oF = numField({ label: 'Oxygen', unit: '%', min: O2[0], max: O2[O2.length - 1], step: stepOf(O2), value: O2[st.o], onInput: v => { st.o = pick(O2, v); update({ from: 'field' }); } });
  const fF = numField({ label: 'Airflow', unit: 'cm/s', min: FL[0], max: FL[FL.length - 1], step: stepOf(FL), value: FL[st.f], onInput: v => { st.f = pick(FL, v); update({ from: 'field' }); } });
  const out = h('div', { class: 'sp-out' }), cellNote = h('p', { class: 'sp-cell' }), noteEl = h('p', { class: 'sp-note' });
  const mapBox = h('div', { class: 'sp-map' }), sumEl = h('p', { class: 'sp-sum' }), tblBox = h('div');
  let map = null, said = null;

  // ---- heatmap: one rect per cell; rebuilt only when the fuel changes ----
  const W = 520, H = 300, m = { l: 58, r: 12, t: 10, b: 40 }, cw = (W - m.l - m.r) / FL.length, ch = (H - m.t - m.b) / O2.length;
  const cx = j => m.l + j * cw, cy = i => m.t + (O2.length - 1 - i) * ch;
  const cellHtml = (c, i, j) => {
    const r = at(c, 'rate_mm_s', i, j), dom = at(c, 'in_domain', i, j);
    const head = `<b>${O2[i]}% O₂, ${FL[j]} cm/s</b>`;
    if (r == null) return `${head}<br>No data and no model here<br>${VERD(at(c, 'verdict', i, j))}`;
    return `${head}<br>${f2(r)} mm/s [${f2(at(c, 'lo', i, j))}–${f2(at(c, 'hi', i, j))}]<br>${VERD(at(c, 'verdict', i, j))}<br>${dom ? 'Inside NASA\'s data' : 'Outside NASA\'s data: extrapolation'}`;
  };
  function buildMap() {
    const c = cases[st.c];
    const rates = (c.rate_mm_s || []).flat().filter(x => x != null);
    const max = Math.max(...rates, 0.01);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart sp-heat' });
    const rects = [];
    (c.rate_mm_s || []).forEach((row, i) => row.forEach((x, j) => {
      const inD = at(c, 'in_domain', i, j);
      const r = s('rect', { x: cx(j), y: cy(i), width: cw + 0.3, height: ch + 0.3, opacity: inD ? 1 : 0.35 });
      r.style.fill = x == null ? 'transparent' : `color-mix(in srgb, ${SERIES[1]} ${Math.round(15 + 85 * Math.min(1, x / max))}%, var(--surface, ${C.surface}))`;
      const show = e => tip(e, cellHtml(c, i, j));
      r.addEventListener('pointermove', show); r.addEventListener('pointerleave', untip);
      r.addEventListener('click', () => { st.o = i; st.f = j; oF.set(O2[i]); fF.set(FL[j]); update({ from: 'map' }); });
      svg.append(r); rects.push({ el: r, i, j });
      const v = at(c, 'verdict', i, j);
      if (v === 2) svg.append(s('text', { x: cx(j) + cw / 2, y: cy(i) + ch * 0.8, 'text-anchor': 'middle', class: 'sp-mark', 'pointer-events': 'none' }, '×'));
      else if (v === 1) svg.append(s('text', { x: cx(j) + cw / 2, y: cy(i) + ch * 0.8, 'text-anchor': 'middle', class: 'sp-mark', 'pointer-events': 'none' }, '•'));
    }));
    // calibration box: in-domain cells get an outline
    (c.in_domain || []).forEach((row, i) => row.forEach((d, j) => { if (d) svg.append(s('rect', { x: cx(j), y: cy(i), width: cw, height: ch, fill: 'none', class: 'sp-box', 'pointer-events': 'none' })); }));
    const pickRect = s('rect', { width: cw + 2, height: ch + 2, fill: 'none', class: 'sp-pick', 'pointer-events': 'none' });
    svg.append(pickRect);
    for (const v of [15, 21, 25, 30, 35]) { const i = O2.indexOf(v); if (i >= 0) svg.append(s('text', { x: m.l - 6, y: cy(i) + ch * 0.75, 'text-anchor': 'end' }, `${v}%`)); }
    for (const v of [0, 10, 20, 30, 40, 50]) { const j = FL.indexOf(v); if (j >= 0) svg.append(s('text', { x: cx(j) + cw / 2, y: H - m.b + 16, 'text-anchor': 'middle' }, String(v))); }
    svg.append(s('text', { x: m.l + (W - m.l - m.r) / 2, y: H - 6, 'text-anchor': 'middle' }, `Airflow, cm/s (${c.flow_direction})`));
    svg.append(s('text', { x: 14, y: m.t + (H - m.t - m.b) / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + (H - m.t - m.b) / 2})` }, 'Oxygen, % by volume'));
    // keyboard: cells in reading order (top row = most oxygen); ↑/↓ move a row; each step also picks the cell
    const order = [];
    for (let i = O2.length - 1; i >= 0; i--) for (let j = 0; j < FL.length; j++) order.push(rects.find(r => r.i === i && r.j === j));
    const items = order.filter(Boolean).map(r => ({ html: cellHtml(c, r.i, r.j), anchor: r.el }));
    const kn = keyNav(svg, items, { label: `Spread rate by oxygen and airflow for ${c.fuel}, ${c.flow_direction} flow`, cols: FL.length,
      onMove: k => { const r = order[k]; if (!r) return; st.o = r.i; st.f = r.j; oF.set(O2[r.i]); fF.set(FL[r.j]); update({ from: 'keys' }); } });
    const markPick = () => { pickRect.setAttribute('x', cx(st.f) - 1); pickRect.setAttribute('y', cy(st.o) - 1); kn.index = order.findIndex(r => r && r.i === st.o && r.j === st.f); };
    return { svg, markPick };
  }
  // ---- one-paragraph text summary and the full table for the chosen fuel (D5.6) ----
  function summary(c) {
    const cells = [];
    (c.rate_mm_s || []).forEach((row, i) => row.forEach((x, j) => cells.push({ i, j, x, d: at(c, 'in_domain', i, j), v: at(c, 'verdict', i, j) })));
    const rated = cells.filter(q => q.x != null), inD = cells.filter(q => q.d);
    const span = (arr, f) => { const v = arr.map(f); return `${Math.min(...v)}–${Math.max(...v)}`; };
    const n2 = cells.filter(q => q.v === 2).length, n1 = cells.filter(q => q.v === 1).length;
    const parts = [`${c.fuel}, ${c.flow_direction} flow: ${cells.length} cells (${O2.length} oxygen levels × ${FL.length} airflows).`];
    parts.push(rated.length ? `Rates run from ${f2(Math.min(...rated.map(q => q.x)))} to ${f2(Math.max(...rated.map(q => q.x)))} mm/s; ${cells.length - rated.length} cells have no data and no model.` : 'No cell has a rate: no data and no model for this fuel and direction.');
    parts.push(inD.length ? `${inD.length} cells are inside NASA's data (oxygen ${span(inD, q => O2[q.i])}%, airflow ${span(inD, q => FL[q.j])} cm/s); every other value is an extrapolation.` : 'No cell is inside NASA\'s data, so every value is an extrapolation.');
    parts.push(`${VERD(2)}: ${n2} cells. ${VERD(1)}: ${n1} cells.`);
    return parts.join(' ');
  }
  function tableFor(c) {
    const rows = [];
    for (let i = O2.length - 1; i >= 0; i--) for (let j = 0; j < FL.length; j++) {
      const r = at(c, 'rate_mm_s', i, j);
      rows.push([`${O2[i]}%`, FL[j], r == null ? '—' : r, r == null ? '—' : at(c, 'lo', i, j), r == null ? '—' : at(c, 'hi', i, j), VERD(at(c, 'verdict', i, j)), at(c, 'in_domain', i, j) ? 'inside' : 'outside', at(c, 'calibration', i, j) || '—']);
    }
    return numbers(`Spread rate by oxygen and airflow: ${c.fuel}, ${c.flow_direction} flow`, ['Oxygen', 'Airflow (cm/s)', 'Rate (mm/s)', 'Low (mm/s)', 'High (mm/s)', 'Verdict', 'NASA\'s data', 'Calibration'], rows,
      '— means no data and no model for that cell.');
  }
  function setFuel() {
    const c = cases[st.c];
    map = buildMap(); mapBox.replaceChildren(map.svg);
    sumEl.textContent = summary(c);
    tblBox.replaceChildren(tableFor(c));
    noteEl.textContent = c.note || '';
  }
  function update({ from } = {}) {
    const c = cases[st.c], i = st.o, j = st.f;
    const r = at(c, 'rate_mm_s', i, j), lo = at(c, 'lo', i, j), hi = at(c, 'hi', i, j), v = at(c, 'verdict', i, j), dom = at(c, 'in_domain', i, j), cal = at(c, 'calibration', i, j);
    map?.markPick();
    cellNote.textContent = `Cell shown: ${O2[i]}% O₂, ${FL[j]} cm/s (the grid steps are ${stepOf(O2)}% and ${stepOf(FL)} cm/s; a typed value uses the nearest cell).`;
    out.replaceChildren(
      r == null ? h('div', { class: 'sp-big' }, '—', h('small', {}, ' no data and no model here'))
        : h('div', { class: `sp-big${dom ? '' : ' out'}` }, f2(r), h('small', {}, ` mm/s  [${f2(lo)}–${f2(hi)}]`)),
      h('div', { class: 'sp-tags' },
        h('span', { class: `lvl${v === 0 ? '' : ' demo'}` }, VERD(v)),
        h('span', { class: `lvl ${dom ? 'real' : 'demo'}` }, dom ? 'Inside NASA\'s data' : 'Outside NASA\'s data: extrapolation'),
        cal ? h('span', { class: 'lvl' }, cal) : null),
      !dom && r != null ? h('p', { class: 'sp-warn' }, 'These conditions are outside the range NASA tested for this fuel. The number is the model carried beyond its data: treat it as a guess, not a result.') : null);
    if (!live || !from) return;
    setParams({ fuel: c.id, o2: O2[i], flow: FL[j] });
    // one announcement when the verdict or the in/out flag changes (key steps are already read by keyNav)
    const now = `${VERD(v)}; ${dom ? 'inside NASA\'s data' : 'outside NASA\'s data'}`;
    if (now !== said && from !== 'keys') announce(`${c.fuel}, ${O2[i]}% oxygen, ${FL[j]} cm/s: ${r == null ? 'no data and no model' : f2(r) + ' mm/s'}. ${now}.`);
    said = now;
  }
  sel.addEventListener('change', () => { st.c = +sel.value; setFuel(); update({ from: 'fuel' }); });
  setFuel(); update();
  said = (() => { const c = cases[st.c]; return `${VERD(at(c, 'verdict', st.o, st.f))}; ${at(c, 'in_domain', st.o, st.f) ? 'inside NASA\'s data' : 'outside NASA\'s data'}`; })();

  const legendEl = h('div', { class: 'legend sp-legend' },
    h('span', {}, h('i', { class: 'sp-sw', style: `background:${SERIES[1]}` }), 'faster spread (darker)'),
    h('span', {}, h('i', { class: 'sp-sw sp-sw-box' }), 'inside NASA\'s data'),
    h('span', {}, h('i', { class: 'sp-sw sp-sw-faint', style: `background:${SERIES[1]}` }), 'faded: outside NASA\'s data'),
    h('span', {}, h('b', { 'aria-hidden': 'true' }, '×'), ` ${VERD(2)}`),
    h('span', {}, h('b', { 'aria-hidden': 'true' }, '•'), ` ${VERD(1)}`),
    h('span', {}, h('i', { class: 'sp-sw sp-sw-pick' }), 'your choice'),
    h('span', {}, 'blank: no data and no model'));
  return card(title, sp.status, 'Flame spread over solid fuels in microgravity at 1 atm, from NASA\'s BASS-II and Saffire flights. Pick a fuel, then move oxygen and airflow.',
    h('div', { class: 'sp-grid' },
      h('div', { class: 'sp-ctls' }, h('div', { class: 'sp-ctl' }, h('label', { for: selId }, 'Fuel and flow direction'), sel), oF, fF, cellNote, out),
      h('div', {}, mapBox, legendEl, sumEl, tblBox)),
    noteEl, note(`${sp.verdict_meaning || ''} ${sp.limits || ''}`.trim()));
}

// ---------------------------------------------------------------------------------------------------------------------
// "How big does it get, and when does it stop?" [NIS]: the three worked growth examples (data/growth_examples.json).
export function growthCard(g) {
  const title = 'How big does it get, and when does it stop?';
  if (isMissing(g) || !Array.isArray(g.examples) || !g.examples.length) return missingCard(title, 'growth_examples', 'The worked growth examples are built by models/m6b-predictor/growth.py.',
    '{ "status":"model", "examples":[{ "id", "title", "why", "t_s":[…], "area_cm2":{"lo":[…],"mid":[…],"hi":[…]},\n   "summary":{"lo"|"mid"|"hi":{"max_area_cm2","t_max_s","t_end_s","stop_reason"}}, "calibrated":[…], "extrapolated":[…], "assumed":[…] }], "limits":"…" }');
  const ex = g.examples, selId = uid('gr-ex');
  const sel = h('select', { id: selId }, ex.map((e, i) => h('option', { value: i }, e.title)));
  const box = h('div'), why = h('p');
  const draw = () => {
    const e = ex[+sel.value], t = e.t_s || [], A = e.area_cm2 || {};
    const line = k => t.map((x, i) => [x, A[k]?.[i] ?? null]);
    const series = [
      A.lo && { name: 'Slow run (low rates)', color: SERIES[0], dash: '6 4', points: line('lo') },
      A.mid && { name: 'Middle run', color: SERIES[1], dash: '', points: line('mid') },
      A.hi && { name: 'Fast run (high rates)', color: SERIES[2], dash: '2 3', points: line('hi') },
    ].filter(Boolean);
    const S = e.summary?.mid || e.summary?.hi;
    const runs = ['lo', 'mid', 'hi'].filter(k => e.summary?.[k]);
    box.replaceChildren(
      lineChart({ title: `Burning area over time: ${e.title}`, series, xLabel: 'Seconds after the flame state', yLabel: 'Burning area, cm²', unit: ' cm²' }),
      S ? h('p', { class: 'sp-note' }, `Middle run: largest burning area ${S.max_area_cm2} cm² at ${S.t_max_s} s; stops at ${S.t_end_s} s (${S.stop_reason}). The slow and fast runs bound it: an envelope, not a confidence interval.`) : null,
      runs.length ? table(['Run', 'Largest area (cm²)', 'At (s)', 'Stops at (s)', 'Why it stops'],
        runs.map(k => { const q = e.summary[k]; return [{ lo: 'Slow', mid: 'Middle', hi: 'Fast' }[k], String(q.max_area_cm2), String(q.t_max_s), String(q.t_end_s), q.stop_reason]; }), { caption: 'Each run in numbers', cls: 'sp-runs' }) : null,
      fold('What is calibrated, extrapolated and assumed', h('ul', {},
        [...(e.calibrated || []).map(x => ['Calibrated', x]), ...(e.extrapolated || []).map(x => ['Extrapolated', x]), ...(e.assumed || []).map(x => ['Assumed', x])].map(([k, x]) => h('li', {}, h('b', {}, k + ': '), x)))),
      e.id ? h('p', { class: 'sp-run' }, h('a', { href: `#/assess?pre=${encodeURIComponent(e.id)}` }, 'Run your own on Assess →'), ' ', h('small', {}, 'Start from this example and change the flame, fuel or cabin.')) : null);
    why.textContent = e.why || '';
  };
  sel.addEventListener('change', draw); draw();
  return card(title, g.status, 'The spread predictor run forward in time on three worked examples, from a starting flame to burnout or the fuel edge.',
    h('div', { class: 'sp-ctl' }, h('label', { for: selId }, 'Example fire'), sel), why, box, note(g.limits || ''));
}

// ---------------------------------------------------------------------------------------------------------------------
// "M6b spread predictor: score and calibration box" (C9): read from models/m6b-predictor/results.json and
// spread_predictor.json. Not added to models.json (M6b README Decision 17).
const f3 = v => (isF(v) ? v.toFixed(3) : 'n/a');    // held-out MAE in mm/s, three decimals (0.020 vs 0.163)
const RULE_TEXT = {   // one-line paraphrases of the rule ids in models/m6b-predictor/RULES.md; pass/fail is read from results.json -> rules
  R1: 'Pooled held-out error, session split, no worse than M6\'s one-constant error', R2: 'Nested range coverage on the 39 opposed rows at least 80%',
  R3: 'Nested range coverage on the 6 concurrent rows at least 80%', R4a: 'Both Saffire-II SIBAL rates (PSI-99) inside the shipped range',
  R4b: 'The 100 µm PMMA film rate inside the shipped range', G1: 'Growth front matches a hand calculation within one cell',
  G2: 'Growth reaches the fuel edge and stops there', G3: 'No growth at every placed NASA no-spread case',
  G4: 'Burning area never below zero', G5: 'A longer fuel never lowers the largest area',
};
export function m6bCard(sp, res) {
  const title = 'M6b spread predictor: score and calibration box';
  const haveSp = !isMissing(sp) && sp.constants, haveRes = !isMissing(res) && res.opposed;
  if (!haveSp && !haveRes) return missingCard(title, 'spread_predictor', 'The M6b score lives in models/m6b-predictor/results.json and the calibration box in data/spread_predictor.json; neither loaded.', null);
  const body = [];
  if (haveRes) {
    const o = res.opposed, mae = o.mae_mm_s || {}, r95 = o.mae_range_95 || {}, r2 = o.r2 || {};
    const rng3 = k => (r95[k] ? `[${f3(r95[k][0])}–${f3(r95[k][1])}]` : '');
    body.push(h('div', { class: 'grid g3 m6b-stats' },
      stat('Held-out error, M6b (opposed flow)', `${f3(mae.kept)} mm/s`, rng3('kept')),
      stat('Raw de Ris formula', `${f3(mae.B1_raw_de_ris)} mm/s`, rng3('B1_raw_de_ris')),
      stat('M6\'s one-constant fit', `${f3(mae.B2_one_constant)} mm/s`, rng3('B2_one_constant'))));
    body.push(h('p', {}, `Mean absolute error on ${o.rows} BASS-II spread rates from ${o.sessions} ISS sessions, each session held out in turn; range: 95% bootstrap. Its slow-to-fast ranges hold ${pct(o.coverage_nested)} of the held-out rates.`));
    body.push(table(['Model', 'Error (mm/s)', '95% range', 'R²'], [
      ['M6b, one factor per regime (kept)', f3(mae.kept), rng3('kept'), sig(r2.kept, 3)],
      ['M6, one constant (baseline B2)', f3(mae.B2_one_constant), rng3('B2_one_constant'), sig(r2.B2_one_constant, 3)],
      ['Raw de Ris formula (baseline B1)', f3(mae.B1_raw_de_ris), rng3('B1_raw_de_ris'), sig(r2.B1_raw_de_ris, 4)],
    ], { caption: 'Opposed flow over PMMA slabs, whole sessions held out', cls: 'm6b-scores' }));
    const cc = res.concurrent;
    if (cc) body.push(h('p', {}, `Concurrent flow over fabric (${cc.rows} spacecraft flights, one held out at a time): error ${sig(cc.mae_mm_s, 3)} mm/s against ${sig(cc.mae_baseline_mean_mm_s, 3)} for the mean of the other flights, so the law barely beats a constant; its ranges hold ${pct(cc.coverage_nested)} of the held-out flights.`));
    // observed vs predicted: the points the file has (no per-row opposed points are stored)
    const ind = res.independent || {}, pts = [];
    (cc?.points || []).forEach(p => pts.push({ x: p.obs_mm_s, y: p.pred_mm_s, group: 'Fabric calibration flights (fitted, reported)', label: `<b>${p.flight}</b> (${p.material})<br>Observed ${p.obs_mm_s} mm/s<br>Predicted ${p.pred_mm_s} mm/s<br>${p.inside_nested ? 'inside' : 'outside'} its held-out range` }));
    (ind.saffire2 || []).filter(p => p.scored).forEach(p => pts.push({ x: p.obs_mm_s, y: p.pred_mm_s, lo: p.lo, hi: p.hi, group: 'Saffire-II, independent check (PSI-99)', label: `<b>Saffire-II sample ${p.sample}</b>, ${p.flow_cm_s} cm/s<br>Observed ${p.obs_mm_s} mm/s<br>Predicted ${p.pred_mm_s} mm/s [${p.lo}–${p.hi}]<br>${p.inside ? 'inside' : 'outside'} the range${p.in_domain ? '' : '; outside the calibration box'}` }));
    if (ind.film) { const p = ind.film; pts.push({ x: p.obs_mm_s, y: p.pred_mm_s, lo: p.lo, hi: p.hi, group: 'PMMA film, independent check (reported)', label: `<b>100 µm PMMA film</b><br>Observed ${p.obs_mm_s} mm/s<br>Predicted ${p.pred_mm_s} mm/s [${p.lo}–${p.hi}]<br>raw de Ris ${p.raw_de_ris_mm_s} mm/s<br>${p.inside ? 'inside' : 'outside'} the range${p.in_domain ? '' : '; outside the calibration box'}` }); }
    if (pts.length) body.push(scatter({ title: 'M6b: observed against predicted spread rate', points: pts, xLabel: 'Observed, mm/s', yLabel: 'Predicted, mm/s', diagonal: true, errorBars: true,
      columns: [['Point', p => p.label.split('<br>')[0].replace(/<[^>]+>/g, '')], ['Group', p => p.group], ['Observed (mm/s)', p => p.x], ['Predicted (mm/s)', p => p.y], ['Low (mm/s)', p => p.lo ?? '—'], ['High (mm/s)', p => p.hi ?? '—']] }),
      note(`The ${o.rows} held-out opposed-flow points are not stored point by point in results.json, so only their error is shown above. Every independent point is outside the calibration box. Saffire-II sample 2-6 at 25 cm/s (a sensitivity run, not scored) is left out.`));
    const rules = res.rules || {};
    const ids = Object.keys(rules);
    if (ids.length) body.push(h('p', { class: 'm6b-rules' }, h('b', {}, 'Pass rules, written before fitting (models/m6b-predictor/RULES.md): '),
      `${ids.filter(k => rules[k]).length} of ${ids.length} met. `, ids.map(k => h('span', { class: `lvl ${rules[k] ? 'real' : 'demo'}`, title: RULE_TEXT[k] || null }, `${k} ${rules[k] ? 'met' : 'missed'}`))));
    if (isF(mae.kept) && isF(mae.B2_one_constant)) body.push(h('p', { class: 'm6b-disclose' }, h('b', {}, 'Not a blind result. '),
      `The one-factor-per-regime form was written into RULES.md before fitting. It was chosen after M6 had shown that thickness and sides drove its errors. The improvement over M6's model (${f3(mae.kept)} vs ${f3(mae.B2_one_constant)} mm/s) is therefore not a blind result. M6's result stands as M6's.`));
  } else body.push(empty('No score yet', 'spread_predictor', 'models/m6b-predictor/results.json did not load, so the held-out score is not shown. Rebuild it with python models/m6b-predictor/build.py.', null));
  body.push(h('dl', { class: 'kv' }, h('dt', {}, 'What drove it'), h('dd', {}, 'Not computed. M6b has three fitted constants and no permutation importance was run; the thin and thick factors stand in for M6\'s thickness driver.')));
  if (haveSp) {
    const K = sp.constants, op = K.opposed?.domain || {}, cc = K.concurrent?.domain || {}, pb = K.pmma_concurrent_bound?.domain || {};
    const r = a => (Array.isArray(a) ? `${a[0]}–${a[1]}` : '—');
    const cells = id => { const c = sp.cases.find(q => q.id === id); return c ? (c.in_domain || []).flat().filter(Boolean).length : null; };
    const total = sp.o2_vol_pct.length * sp.flow_cm_s.length;
    body.push(table(['Fuel and flow', 'Burning half-thickness τ (mm)', 'Airflow (cm/s)', 'Oxygen (%)', 'Pressure (atm)', 'Area density (mg/cm²)'], [
      ['PMMA, opposed, thin regime', r(op.thin?.tau_mm), r(op.thin?.flow_cm_s), r(op.thin?.o2_vol_pct), r(op.thin?.pressure_atm), '—'],
      ['PMMA, opposed, thick regime', r(op.thick?.tau_mm), r(op.thick?.flow_cm_s), r(op.thick?.o2_vol_pct), r(op.thick?.pressure_atm), '—'],
      ['Thick PMMA, concurrent (observed bound)', '—', r(pb.flow_cm_s), r(pb.o2_vol_pct), r(pb.pressure_atm), '—'],
      ['SIBAL or cotton fabric, concurrent', '—', r(cc.flow_cm_s), r(cc.o2_vol_pct), r(cc.pressure_atm), r(cc.area_density)],
    ], { caption: 'Calibration box: inside these ranges a value is calibrated; outside, it is an extrapolation', cls: 'm6b-box' }));
    body.push(h('p', {}, `In-domain cells on the ${total}-cell grid at ${sp.pressure_atm} atm: `, sp.cases.map(c => `${c.fuel}, ${c.flow_direction}: ${cells(c.id)}`).join('; '), '.'));
    const V = K.verdict;
    if (V?.cases?.length) {
      const nReal = V.cases.filter(c => c.status === 'real').length, nRep = V.cases.length - nReal;
      body.push(fold(`Verdict boxes: ${V.cases.length} NASA no-spread cases (${nReal} NASA data, ${nRep} reported)`,
        h('p', {}, `A condition is "${sp.verdict_codes?.['2'] || 'observed no-spread'}" when it lies within ${V.o2_obs} oxygen points and the larger of ${V.flow_obs_abs} cm/s or ${pct(V.flow_obs_rel)} of the airflow of a case with the same material, flow direction and geometry; "${sp.verdict_codes?.['1'] || 'near observed extinction'}" within ${V.o2_near} points and a factor ${V.flow_near_factor} in airflow. Rods are never matched (not modelled).`),
        table(['Case', 'Status', 'Fuel', 'Flow', 'Airflow (cm/s)', 'Oxygen (%)', 'Outcome', 'Record as written'],
          V.cases.map(c => [c.case_id, c.status === 'real' ? 'NASA data' : 'Reported, unverified', `${c.material} ${c.geometry}`, c.flow_direction,
            c.flow_lo_cm_s === c.flow_hi_cm_s ? String(c.flow_lo_cm_s) : `${c.flow_lo_cm_s}–${c.flow_hi_cm_s}`,
            c.o2_lo_vol_pct === c.o2_hi_vol_pct ? String(c.o2_lo_vol_pct) : `${c.o2_lo_vol_pct}–${c.o2_hi_vol_pct}`, c.outcome, c.record_as_written]), { cls: 'm6b-verdicts' })));
    }
    if (Array.isArray(sp.sources) && sp.sources.length) body.push(note('Sources: ', sp.sources.map(x => `${x.label}${x.doi ? ', doi:' + x.doi : x.url ? ', ' + x.url : ''}`).join('; '), '.'));
    body.push(note(sp.limits || ''));
  }
  body.push(h('p', { class: 'sp-run' }, h('a', { href: figLink('predict', 'Spread rate against airflow: M6b vs de Ris') }, 'See the M6b line beside de Ris →'), ' ',
    h('a', { href: figLink('predict', 'Flame spread over PMMA slabs (BASS-II)') }, 'M6, the model it improves on →')));
  return card(title, haveSp ? sp.status : 'model', 'How close the calibrated spread predictor came on NASA sessions it was not fitted on, beside the textbook formula, and the box of conditions where it is calibrated.', ...body);
}

// ---------------------------------------------------------------------------------------------------------------------
// "Spread rate against airflow: M6b vs de Ris" (#9): spreadRates() from js/growth.js swept over the file's airflow grid.
// opts: {case, o2}. At grid points the middle line equals data/spread_predictor.json rate_mm_s (same formula, same constants).
export function m6bSpreadChartCard(sp, opts = {}) {
  const title = 'Spread rate against airflow: M6b vs de Ris';
  if (isMissing(sp) || !sp.constants || !Array.isArray(sp.cases)) return missingCard(title, 'spread_predictor', 'The chart runs the M6b spread rates from the constants in data/spread_predictor.json.', SP_SCHEMA);
  const O2 = sp.o2_vol_pct, FL = sp.flow_cm_s, K = sp.constants, P = sp.pressure_atm ?? 1;
  const dirOf = (r, c) => (c.flow_direction === 'concurrent' ? r.concurrent : r.opposed);
  const run = (c, o2) => FL.map(u => {
    let r = null;
    try { r = spreadRates({ material: c.material, thickness_mm: c.thickness_mm, sides_burning: c.sides_burning }, { flow_cm_s: u, o2_vol_pct: o2, pressure_atm: P }, K); } catch { r = null; }
    const d = r ? dirOf(r, c) : null;
    return { u, mid: d?.mid ?? null, lo: d?.lo ?? null, hi: d?.hi ?? null, inD: !!d?.in_domain, raw: c.flow_direction === 'opposed' && r ? r.raw_de_ris_mm_s : null, regime: r?.regime };
  });
  const usable = sp.cases.filter(c => run(c, O2[pick(O2, 21)]).some(q => isF(q.mid)));
  if (!usable.length) return missingCard(title, 'spread_predictor', 'No fuel in the file has a spread rate to draw.', SP_SCHEMA);
  let ci = Math.max(0, usable.findIndex(c => c.id === (opts.case || 'pmma_slab_1mm_opposed')));
  const want = Number(opts.o2);
  let o2 = O2[pick(O2, opts.o2 != null && opts.o2 !== '' && isF(want) ? want : 21)];
  const selId = uid('m6c-fuel');
  const sel = h('select', { id: selId }, usable.map((c, i) => h('option', { value: i }, `${c.fuel} · ${c.flow_direction} flow`)));
  sel.value = String(ci);
  const oF = numField({ label: 'Oxygen', unit: '%', min: O2[0], max: O2[O2.length - 1], step: stepOf(O2), value: o2, onInput: v => { o2 = v; draw(); } });
  const box = h('div'), sum = h('p', { class: 'sp-sum' });
  const MID = SERIES[0], RAW = SERIES[1], IN = SERIES[2], OUT = SERIES[3];
  function draw() {
    const c = usable[ci], q = run(c, o2), hasRaw = q.some(x => isF(x.raw));
    const series = [
      { name: 'M6b middle (band: slow to fast)', color: MID, dash: '', points: q.map(x => [x.u, x.mid]), band: q.filter(x => isF(x.lo) && isF(x.hi)).map(x => [x.u, x.lo, x.hi]) },
      hasRaw ? { name: 'de Ris, raw formula', color: RAW, dash: '6 4', points: q.map(x => [x.u, x.raw]) } : null,
      { name: 'M6b, inside the calibration box', color: IN, dots: true, points: q.map(x => [x.u, x.inD && isF(x.mid) ? x.mid : null]) },
      { name: 'M6b, outside the box (extrapolation)', color: OUT, dots: true, points: q.map(x => [x.u, !x.inD && isF(x.mid) ? x.mid : null]) },
    ].filter(Boolean);
    const chart = lineChart({ title: `Spread rate against airflow at ${o2}% oxygen: ${c.fuel}, ${c.flow_direction} flow`, series, xLabel: 'Airflow, cm/s', yLabel: 'Spread rate, mm/s', unit: ' mm/s' });
    // hollow marks for points outside the box (chart and legend), so in/out is told by shape as well as colour
    chart.querySelectorAll(`[fill="${OUT}"]`).forEach(e => { if (e.tagName === 'path' && e.getAttribute('opacity')) return; e.setAttribute('fill', 'none'); e.setAttribute('stroke', OUT); e.setAttribute('stroke-width', '1.8'); e.classList.remove('ch-surf'); });
    box.replaceChildren(chart);
    const mids = q.filter(x => isF(x.mid)), ins = q.filter(x => x.inD && isF(x.mid));
    const ratio = q.filter(x => isF(x.raw) && x.mid > 0).map(x => x.raw / x.mid);
    sum.textContent = [
      `${c.fuel}, ${c.flow_direction} flow, ${o2}% oxygen, ${P} atm:`,
      mids.length ? `the M6b middle rate runs from ${f2(Math.min(...mids.map(x => x.mid)))} to ${f2(Math.max(...mids.map(x => x.mid)))} mm/s over ${FL[0]}–${FL[FL.length - 1]} cm/s.` : 'no M6b rate on this line.',
      ins.length ? `It is inside the calibration box from ${Math.min(...ins.map(x => x.u))} to ${Math.max(...ins.map(x => x.u))} cm/s; everywhere else it is an extrapolation.` : 'No point on this line is inside the calibration box, so every value is an extrapolation.',
      ratio.length ? `The raw de Ris formula is ${sig(Math.min(...ratio), 2)} to ${sig(Math.max(...ratio), 2)} times the M6b middle line.` : (c.flow_direction === 'opposed' ? '' : 'de Ris is an opposed-flow formula, so it has no line here.'),
    ].filter(Boolean).join(' ');
  }
  sel.addEventListener('change', () => { ci = +sel.value; draw(); });
  draw();
  return card(title, sp.status, 'The M6b spread rate swept across airflow at the oxygen and fuel you choose, beside the raw de Ris formula it calibrates. Hollow points are outside NASA\'s calibration box.',
    h('div', { class: 'sp-ctls sp-row' }, h('div', { class: 'sp-ctl' }, h('label', { for: selId }, 'Fuel and flow direction'), sel), oF),
    box, sum, note(`Computed in your browser by js/growth.js (spreadRates) from data/spread_predictor.json → constants, at ${P} atm. ${sp.limits || ''}`.trim()));
}
