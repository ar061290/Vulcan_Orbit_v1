// Flame lab figures 2 to 7 and the "Show Moon and Mars (model only)" switch (site/REBUILD_PLAN.md §2.12, §3.8).
// Every number comes from data/flame_static.json or data/flame_spread.json (models/flame-sim/build.py).
// Moon and Mars cases exist in both files but are shown ONLY behind the switch, drawn dashed or hatched, with the
// file's own gravity_note printed beside them. This is the one place on the site where Moon or Mars values appear.
//
// Cards that follow the switch take opts {showMM, onShowMM}: each carries its own copy of the switch, and the card
// element gets setShowMM(v), so the page can keep every copy in step (the switch drives figures 1, 3 and 4, plus the
// Limits line). With no onShowMM a card's switch only changes that card.
import { h, add, card, fmt, sig, seg, table, legend, tip, untip, empty, isMissing } from './lib.js';
import { scatter, lineChart, keyNav, numbers, C, SERIES } from './charts.js';

/** Replace an element's children, dropping null/false/undefined (replaceChildren(null) would print "null"). */
const put = (el, ...kids) => { el.replaceChildren(); add(el, ...kids); };

// ---------- gravity names (verbatim from main's js/pages/flame.js) ----------
export const GNAME = { '0 g': 'Orbit', 'Moon 0.16 g': 'Moon (model only)', 'Mars 0.38 g': 'Mars (model only)', 'Earth 1 g': 'Earth' };
/** Read at draw time: C follows the theme (the series colours are the same in both). */
export const gcol = g => ({ '0 g': C.s1, 'Moon 0.16 g': C.s3, 'Mars 0.38 g': C.s4, 'Earth 1 g': C.s2 }[g] || C.mute);
/** A case is model only when the file does not label it 'validated' (flame_static.label_meaning). */
export const modelOnly = label => label != null && label !== 'validated';
/** The gravities present in a list of cases, ordered by g, each tagged validated or model only. */
export function gravities(rows) {
  const by = new Map();
  for (const r of rows || []) if (!by.has(r.gravity)) by.set(r.gravity, { g: r.gravity, g_m_s2: r.g_m_s2 ?? null, mm: modelOnly(r.gravity_label) });
  return [...by.values()].sort((a, b) => (a.g_m_s2 ?? 0) - (b.g_m_s2 ?? 0));
}
const pctO2 = v => `${Math.round(v * 100)}%`;
const cssVar = (name, fb) => { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch { return fb; } };
/** The "model only" stamp used for Moon and Mars cases. */
export const mmStamp = () => h('span', { class: 'badge mm', title: 'Model output only. NASA has no flame data at this gravity, so nothing checks it.' }, 'Model only');
/** gravity_note from the file, printed beside Moon and Mars cases. */
const mmNote = d => h('p', { class: 'mm-note' }, mmStamp(), ' ', d?.gravity_note || 'Moon and Mars cases are model output only, not validated.');

// ---------- the switch ----------
/** A single aria-pressed toggle, off by default. el.set(v) changes it without calling onChange. */
export function moonMarsSwitch(onChange, { value = false } = {}) {
  let on = !!value;
  const btn = h('button', { type: 'button', class: 'mm-btn', 'aria-pressed': on }, h('span', { class: 'mm-box', 'aria-hidden': 'true' }), 'Show Moon and Mars (model only)');
  const el = h('div', { class: 'mm-switch' }, btn, h('small', {}, 'NASA has no flame data between 0 g and 1 g, so these cases come from the model alone.'));
  btn.addEventListener('click', () => { on = !on; btn.setAttribute('aria-pressed', String(on)); onChange?.(on); });
  el.set = v => { on = !!v; btn.setAttribute('aria-pressed', String(on)); };
  el.get = () => on;
  return el;
}
function mmControl(opts, apply) {
  return moonMarsSwitch(v => (opts.onShowMM ? opts.onShowMM(v) : apply(v)), { value: !!opts.showMM });
}

const missingCard = (title, file, why, schema) => card(title, 'missing', null, empty('Waiting for the flame model', file, why || 'Run python models/flame-sim/build.py', schema));

// ---------- 2. Droplet burning rate vs NASA FLEX ----------
export function flexKCard(fs) {
  const T = 'Droplet burning rate vs NASA FLEX';
  if (isMissing(fs) || !Array.isArray(fs.flex_comparison)) return missingCard(T, 'flame_static', null, '{ "status": "model", "flex_comparison": [{ "id", "fuel", "X": {"O2"}, "P_kPa", "d0_mm", "K_meas_mm2_s", "K_model_mm2_s", "half": "tune" | "test" }], "flex_K_stats": { "<fuel>": {...} } }');
  const FUELS = [['n-heptane', C.s1], ['methanol', C.s2]];
  const fuelCol = f => (FUELS.find(x => x[0] === f) || [0, C.s3])[1];
  const fuelIdx = f => { const k = FUELS.findIndex(x => x[0] === f); return k < 0 ? 9 : k; };
  const halfName = r => (r.half === 'tune' ? 'used to tune' : 'held out');
  const rows = fs.flex_comparison.filter(r => r.K_model_mm2_s != null && r.K_meas_mm2_s != null)
    .sort((a, b) => fuelIdx(a.fuel) - fuelIdx(b.fuel) || (a.half === 'tune' ? 0 : 1) - (b.half === 'tune' ? 0 : 1));
  const pts = rows.map(r => ({
    r, x: r.K_meas_mm2_s, y: r.K_model_mm2_s, color: fuelCol(r.fuel),
    shape: r.half === 'tune' ? 'circle' : 'diamond', group: `${r.fuel}, ${halfName(r)}`,
    label: `<b>FLEX test ${r.id}</b><br>${r.fuel}, ${Math.round(r.X.O2 * 100)}% O2, ${fmt(r.P_kPa, 0)} kPa, ${r.d0_mm} mm droplet<br>measured ${fmt(r.K_meas_mm2_s, 3)} mm²/s, model ${fmt(r.K_model_mm2_s, 3)}<br><span>${halfName(r)}</span>`,
  }));
  const S = fs.flex_K_stats || {};
  const better = s => (s.held_out_median_abs_err_pct == null || s.baseline_held_out_median_abs_err_pct == null ? null
    : s.held_out_median_abs_err_pct < s.baseline_held_out_median_abs_err_pct ? 'model' : 'constant K');
  const entries = Object.entries(S);
  const statRows = entries.map(([f, s]) => [h('b', {}, f), s.held_out_n != null ? `${s.n} (${s.held_out_n} held out)` : String(s.n ?? 'n/a'),
    `${fmt(s.held_out_median_abs_err_pct, 0)}%`, `${fmt(s.baseline_held_out_median_abs_err_pct, 0)}%`, better(s) || 'n/a']);
  // "which wins", computed from flex_K_stats (main typed this sentence in)
  const wins = entries.filter(([, s]) => better(s)).map(([f, s]) => (better(s) === 'model' ? `for ${f} the model wins` : `for ${f} a single constant burning rate does better than the model`));
  const nF = new Set(fs.flex_comparison.map(r => r.fuel)).size, word = { 1: 'this one fuel', 2: 'these two fuels', 3: 'these three fuels' }[nF] || `these ${nF} fuels`;
  const sentence = wins.length ? `${wins.join('; ').replace(/^f/, 'F')}. ` : '';
  return card(T, fs.status, 'Each dot is one droplet burned on the space station. The d-squared law predicts how fast it shrinks (K); the dashed line is a perfect match.',
    scatter({ title: T, points: pts, diagonal: true, xLabel: 'Measured K, mm²/s', yLabel: 'Model K, mm²/s',
      columns: [['FLEX test', p => p.r.id], ['Fuel', p => p.r.fuel], ['Tune or held out', p => halfName(p.r)], ['Measured K, mm²/s', p => p.x], ['Model K, mm²/s', p => p.y]] }),
    h('p', { class: 'fl-key' }, 'Colour is the fuel; a round dot was used to tune the model, a diamond was held out.'),
    table(['Fuel', 'Tests', 'Error on held-out tests', 'Baseline: one constant K', 'Better'], statRows, { caption: 'Median error on held-out FLEX tests, model against one constant burning rate' }),
    h('p', {}, h('small', {}, `Held-out tests were never used to tune the model. ${sentence}FLEX burned only ${word}. Source: NASA PSI-69 (FLEX).`)));
}

// ---------- 3. How fast flame crosses a solid ----------
export function spreadCurvesCard(sp, opts = {}) {
  const T = 'How fast flame crosses a solid';
  if (isMissing(sp) || !Array.isArray(sp.rates)) return missingCard(T, 'flame_spread', null, '{ "status": "model", "rates": [{ "fuel", "X_O2", "P_kPa", "gravity", "gravity_label", "flow_m_s": [], "rate_mm_s": [] }], "bass_ii_groups": {...} }');
  let showMM = !!opts.showMM;
  const fuels = [...new Set(sp.rates.map(r => r.fuel))];
  const o2s = [...new Set(sp.rates.map(r => r.X_O2))].sort((a, b) => a - b);
  const ps = [...new Set(sp.rates.map(r => r.P_kPa))].sort((a, b) => b - a);
  const G = gravities(sp.rates);
  const st = { fuel: fuels[0], o2: o2s.includes(0.21) ? 0.21 : o2s[0], p: ps.includes(101.3) ? 101.3 : ps[0] };
  const holder = h('div', { class: 'fl-chart' });
  function draw() {
    const rs = sp.rates.filter(r => r.fuel === st.fuel && r.X_O2 === st.o2 && r.P_kPa === st.p);
    let v = 0, m = 0;
    // validated gravities solid / dash-dot; Moon and Mars (model only) dashed and dotted, and only behind the switch
    const series = G.filter(g => showMM || !g.mm).map(g => rs.find(r => r.gravity === g.g)).filter(Boolean).map(r => {
      const mm = modelOnly(r.gravity_label);
      return { name: GNAME[r.gravity] || (mm ? `${r.gravity} (model only)` : r.gravity), color: gcol(r.gravity), dash: mm ? ['6 4', '2 3'][m++ % 2] : ['', '8 3 2 3'][v++ % 2],
        points: r.flow_m_s.map((f, i) => [f, r.rate_mm_s[i] ?? null]), mm };   // a null rate is a gap, never 0
    });
    put(holder, 
      series.length ? lineChart({ title: T, series, xLabel: 'Opposed airflow, m/s', yLabel: 'Spread rate, mm/s', unit: ' mm/s' }) : h('p', {}, 'No case for this combination.'),
      series.some(s => s.mm) ? mmNote(sp) : null);
  }
  const sw = mmControl(opts, v => setShowMM(v));
  function setShowMM(v) { showMM = !!v; sw.set(showMM); draw(); }
  draw();
  const gr = Object.entries(sp.bass_ii_groups || {}).filter(([k]) => k.startsWith('group'));
  const el = card(T, sp.status, 'de Ris spread formulas with a low-flow and blow-off correction, over PMMA (acrylic) sheets.',
    h('div', { class: 'fl-controls' },
      seg({ label: 'Fuel', options: fuels.map(f => [f, f]), value: st.fuel, onChange: v => { st.fuel = v; draw(); } }),
      seg({ label: 'Oxygen', options: o2s.map(o => [o, pctO2(o)]), value: st.o2, onChange: v => { st.o2 = v; draw(); } }),
      seg({ label: 'Pressure', options: ps.map(p => [p, `${p} kPa`]), value: st.p, onChange: v => { st.p = v; draw(); } }),
      sw),
    holder,
    h('h3', {}, 'Checked against NASA BASS-II (spread on the space station)'),
    gr.length ? table(['Sample', 'Burns', 'Model error', 'de Ris alone'], gr.map(([k, s]) => [h('b', {}, k.replace('group: ', '')), String(s.n), `${fmt(s.median_abs_err_pct, 0)}%`, `${fmt(s.baseline_median_abs_err_pct, 0)}%`]),
      { caption: 'Median error against BASS-II burns, model and plain de Ris' }) : h('p', {}, 'No BASS-II comparison in data/flame_spread.json yet.'),
    h('p', {}, h('small', {}, 'Thin sheets: within 10% of the two BASS-II burns, but plain de Ris is just as close. Thick slabs: about 3 times too fast, because the formula assumes steady spread and thick slabs in orbit never got there (check S3-spread, failed). BASS-II rates are as reported by NASA, not re-measured by us.')));
  el.setShowMM = setShowMM;
  return el;
}

// ---------- 4. Where a flame can survive (canvas flammability map + hidden-risk band) ----------
// source: ISS aisle airflow 4.6-12.2 m/min, NTRS 20150009509 p.10 (provenance PSI.air); 4.6 m/min = 0.077 m/s, 12.2 m/min = 0.203 m/s
const VENT = [0.077, 0.203];
const AIR_O2 = 0.21, CABIN_O2 = 0.34;   // the two O2 rows the page compares: air, and the exploration-cabin atmosphere in the file's own grid
const runsOf = idx => idx.reduce((out, i) => { const last = out[out.length - 1]; if (last && last[last.length - 1] === i - 1) last.push(i); else out.push([i]); return out; }, []);
const rowOf = (M, o2) => M.O2.findIndex(v => Math.abs(v - o2) < 1e-9);
/** Airflow runs where the model says the flame goes out at 21% O2 but survives at 34% O2 (the C10 hidden-risk band). */
export function hiddenRisk(M) {
  const j21 = rowOf(M, AIR_O2), j34 = rowOf(M, CABIN_O2);
  if (j21 < 0 || j34 < 0) return { runs: [], why: `the map's oxygen grid has no ${j21 < 0 ? '21%' : '34%'} row` };
  const cells = M.flow_m_s.map((_, i) => i).filter(i => !M.burning[j21][i] && M.burning[j34][i]);
  return { runs: runsOf(cells).map(r => ({ i0: r[0], i1: r[r.length - 1], lo: M.flow_m_s[r[0]], hi: M.flow_m_s[r[r.length - 1]], n: r.length })), j21, j34,
    why: cells.length ? null : 'at every airflow where the flame survives at 34% oxygen, it also survives at 21%' };
}
/** Contiguous airflow ranges where row j burns. */
const burnRuns = (M, j) => runsOf(M.flow_m_s.map((_, i) => i).filter(i => M.burning[j][i])).map(r => [M.flow_m_s[r[0]], M.flow_m_s[r[r.length - 1]]]);
const ms = v => sig(v, 4);   // 4 s.f., so a band edge such as 1.347 m/s is printed as the file gives it to that precision
const rangeText = rs => rs.map(([a, b]) => (a === b ? `${ms(a)} m/s` : `${ms(a)}–${ms(b)} m/s`)).join(' and ');

export function survivalMapCard(sp, opts = {}) {
  const T = 'Where a flame can survive';
  if (isMissing(sp) || !Array.isArray(sp.flammability_maps) || !sp.flammability_maps.length) return missingCard(T, 'flame_spread', null, '{ "flammability_maps": [{ "gravity", "P_kPa", "gravity_label", "flow_m_s": [], "O2": [], "burning": [[0|1]], "min_O2", "min_O2_flow_m_s" }] }');
  let showMM = !!opts.showMM;
  const maps = sp.flammability_maps, G = gravities(maps);
  const ps = [...new Set(maps.map(m => m.P_kPa))].sort((a, b) => b - a);
  const st = { g: '0 g', p: ps.includes(101.3) ? 101.3 : ps[0] };
  if (!G.some(x => x.g === st.g)) st.g = G[0].g;
  const W = 640, H = 340, m = { l: 52, r: 14, t: 12, b: 40 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const holder = h('div', { class: 'fl-map' }), gravSlot = h('div'), tableSlot = h('div');
  const cv = h('canvas', { width: W * 2, height: H * 2, class: 'fl-mapcv' });
  const summary = h('p', { class: 'fl-sum', id: `flsum-map-${Math.random().toString(36).slice(2, 8)}` });
  cv.setAttribute('aria-describedby', summary.id);
  const lineP = h('p', { class: 'fl-min' }), bandP = h('p', { class: 'fl-band' }), mmSlot = h('div'), legSlot = h('div');
  let M = null, risk = null, focus = -1;
  const items = [];
  let geo = null;
  const nav = keyNav(cv, items, { label: 'Where a flame can survive: model map of airflow against oxygen', cols: maps[0].flow_m_s.length, onMove: i => { focus = i; paint(); }, onClear: () => { focus = -1; paint(); } });

  const inBand = (i, j) => risk && risk.runs.some(r => i >= r.i0 && i <= r.i1) && M.O2[j] >= AIR_O2 - 1e-9 && M.O2[j] <= CABIN_O2 + 1e-9;
  const cellHtml = (i, j) => `<b>${M.burning[j][i] ? 'Burns' : 'Goes out'}</b><br>airflow ${fmt(M.flow_m_s[i] * 100, 1)} cm/s, oxygen ${Math.round(M.O2[j] * 100)}%`
    + (inBand(i, j) ? '<br><span>hidden-risk band (model): goes out at 21%, survives at 34%</span>' : '') + (modelOnly(M.gravity_label) ? '<br><span>model only, not validated</span>' : '');

  function paint() {
    if (!M) return;
    const fl = M.flow_m_s, o2 = M.O2, lx = v => Math.log10(v);
    const X = v => m.l + (lx(v) - lx(fl[0])) / (lx(fl[fl.length - 1]) - lx(fl[0])) * iw, Y = v => m.t + ih - (v - o2[0]) / (o2[o2.length - 1] - o2[0]) * ih;
    const hx = (X(fl[1]) - X(fl[0])) / 2, hy = (Y(o2[0]) - Y(o2[1])) / 2;            // flows are log-spaced, O2 linear: cells are uniform on screen
    geo = { X, Y, hx, hy };
    const ink = cssVar('--ink', '#eef1f7'), ink2 = cssVar('--ink2', '#bcc3d1'), mute = cssVar('--mute', '#8d96a8'), axis = cssVar('--axis', '#2c3550'), oxy = cssVar('--oxy', '#7aa2ff'), warn = cssVar('--warn', '#fab219');
    const c = cv.getContext('2d'); if (!c) return;
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(57,135,229,.12)'; c.fillRect(X(VENT[0]), m.t, X(VENT[1]) - X(VENT[0]), ih);                 // station ventilation band
    const mm = modelOnly(M.gravity_label);
    // burning cells: solid for validated gravities, hatched for Moon and Mars (model only)
    const g = document.createElement('canvas'); g.width = fl.length; g.height = o2.length; const gc = g.getContext('2d'), im = gc.createImageData(fl.length, o2.length);
    for (let j = 0; j < o2.length; j++) for (let i = 0; i < fl.length; i++) if (M.burning[j][i]) { const p = ((o2.length - 1 - j) * fl.length + i) * 4; im.data[p] = 217; im.data[p + 1] = 89; im.data[p + 2] = 38; im.data[p + 3] = mm ? 255 : 150; }
    gc.putImageData(im, 0, 0);
    const x0 = X(fl[0]) - hx, y0 = Y(o2[o2.length - 1]) - hy, ww = X(fl[fl.length - 1]) - X(fl[0]) + 2 * hx, hh = Y(o2[0]) - Y(o2[o2.length - 1]) + 2 * hy;
    if (!mm) { c.imageSmoothingEnabled = false; c.drawImage(g, x0, y0, ww, hh); }
    else {
      // hatch: stripes masked by the burning cells
      const off = document.createElement('canvas'); off.width = W * 2; off.height = H * 2; const o = off.getContext('2d'); o.setTransform(2, 0, 0, 2, 0, 0);
      o.imageSmoothingEnabled = false; o.drawImage(g, x0, y0, ww, hh); o.globalCompositeOperation = 'source-in';
      o.strokeStyle = 'rgba(217,89,38,.85)'; o.lineWidth = 2.2; o.beginPath();
      for (let k = -H; k < W + H; k += 7) { o.moveTo(k, H); o.lineTo(k + H, 0); } o.stroke();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(off, 0, 0); c.restore();
      c.save(); c.setTransform(2, 0, 0, 2, 0, 0); c.globalAlpha = 0.18; c.imageSmoothingEnabled = false; c.drawImage(g, x0, y0, ww, hh); c.restore();
    }
    // hidden-risk band: each contiguous airflow run between the 21% and 34% lines, labelled "model"
    if (risk && risk.runs.length) {
      c.save(); c.strokeStyle = warn; c.lineWidth = 2; c.setLineDash([5, 3]);
      for (const r of risk.runs) { const bx = X(fl[r.i0]) - hx, bw = X(fl[r.i1]) + hx - bx, by = Y(CABIN_O2) - hy, bh = Y(AIR_O2) + hy - by; c.strokeRect(bx, by, bw, bh); }
      c.restore();
      const wide = risk.runs.reduce((a, b) => (b.n > a.n ? b : a));
      c.fillStyle = warn; c.font = '600 12px system-ui'; c.textAlign = 'right';
      c.fillText('hidden risk (model)', Math.min(m.l + iw - 2, X(fl[wide.i1]) + hx), Y(CABIN_O2) - hy - 5);
    }
    c.strokeStyle = axis; c.lineWidth = 1; c.beginPath(); c.moveTo(m.l, m.t + ih); c.lineTo(m.l + iw, m.t + ih); c.moveTo(m.l, m.t); c.lineTo(m.l, m.t + ih); c.stroke();
    c.fillStyle = mute; c.font = '12px system-ui'; c.textAlign = 'center';
    for (const v of [0.001, 0.01, 0.1, 1]) if (v >= fl[0] && v <= fl[fl.length - 1]) c.fillText(v < 0.01 ? '1 mm/s' : v < 0.1 ? '1 cm/s' : v < 1 ? '10 cm/s' : '1 m/s', X(v), m.t + ih + 16);
    c.fillText('Airflow along the sample (log scale)', m.l + iw / 2, H - 4); c.textAlign = 'right';
    for (const v of [0.1, 0.2, 0.3, 0.4]) if (v >= o2[0] && v <= o2[o2.length - 1] + 1e-9) c.fillText(`${Math.round(v * 100)}%`, m.l - 8, Y(v) + 4);
    c.save(); c.translate(14, m.t + ih / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText('Oxygen', 0, 0); c.restore();
    c.setLineDash([4, 4]); c.strokeStyle = ink2; for (const v of [AIR_O2, CABIN_O2]) { c.beginPath(); c.moveTo(m.l, Y(v)); c.lineTo(m.l + iw, Y(v)); c.stroke(); } c.setLineDash([]);
    c.fillStyle = ink; c.textAlign = 'left'; c.fillText('air, 21%', m.l + 6, Y(AIR_O2) - 5); c.fillText('exploration cabin, 34%', m.l + 6, Y(CABIN_O2) - 5);
    c.fillStyle = oxy; c.fillText('station airflow', X(VENT[0]) + 4, m.t + 14);
    if (mm) { c.fillStyle = warn; c.font = '700 11px system-ui'; c.textAlign = 'right'; c.fillText('MODEL ONLY · NOT VALIDATED', m.l + iw - 4, m.t + 14); }
    // keyboard focus ring
    if (focus >= 0) {
      const nx = fl.length, jj = o2.length - 1 - Math.floor(focus / nx), ii = focus % nx;
      c.strokeStyle = ink; c.lineWidth = 2; c.strokeRect(X(fl[ii]) - hx - 1, Y(o2[jj]) - hy - 1, 2 * hx + 2, 2 * hy + 2);
    }
  }

  function draw() {
    M = maps.find(x => x.gravity === st.g && x.P_kPa === st.p);
    if (!M) { put(holder, h('p', {}, 'No map.')); items.length = 0; return; }
    risk = hiddenRisk(M);
    if (!risk.runs.length) console.info(`Flame lab, hidden-risk band not drawn for ${st.g}, ${st.p} kPa: ${risk.why}.`);
    // keyboard: one stop, arrows move cell by cell (↑/↓ change oxygen), top row = highest oxygen
    items.length = 0;
    for (let j = M.O2.length - 1; j >= 0; j--) for (let i = 0; i < M.flow_m_s.length; i++) {
      const ii = i, jj = j;
      items.push({ html: cellHtml(ii, jj), anchor: () => { const r = cv.getBoundingClientRect(); if (!geo) return { x: r.left, y: r.top }; return { x: r.left + geo.X(M.flow_m_s[ii]) / W * r.width, y: r.top + geo.Y(M.O2[jj]) / H * r.height }; } });
    }
    nav.clear(); nav.index = -1; focus = -1;
    paint();
    const mm = modelOnly(M.gravity_label), name = GNAME[M.gravity] || M.gravity;
    put(lineP, 'Lowest oxygen that burns: ', h('b', {}, `${Math.round(M.min_O2 * 100)}%`), ` at about ${fmt(M.min_O2_flow_m_s * 100, 1)} cm/s.`, mm ? ' Model only, not validated.' : '');
    put(bandP, ...(risk.runs.length
      ? [h('b', {}, 'Hidden-risk band (model): '), `at ${rangeText(risk.runs.map(r => [r.lo, r.hi]))} airflow, the model says this sheet goes out at 21% oxygen but keeps burning at 34%. Outlined on the map.`]
      : [h('b', {}, 'Hidden-risk band (model): '), `none on this map, because ${risk.why}.`]));
    const b21 = rowOf(M, AIR_O2) >= 0 ? burnRuns(M, rowOf(M, AIR_O2)) : [], b34 = rowOf(M, CABIN_O2) >= 0 ? burnRuns(M, rowOf(M, CABIN_O2)) : [];
    summary.textContent = `Model map for a thin acrylic sheet, ${name.replace(' (model only)', '')}, ${M.P_kPa} kPa${mm ? ' (model only, not validated)' : ''}. `
      + `The lowest oxygen that burns is ${Math.round(M.min_O2 * 100)}%, at about ${fmt(M.min_O2_flow_m_s * 100, 1)} cm/s airflow. `
      + `At 21% oxygen the sheet burns ${b21.length ? `at ${rangeText(b21)}` : 'at no airflow on the grid'}; at 34% it burns ${b34.length ? `at ${rangeText(b34)}` : 'at no airflow on the grid'}. `
      + `The station ventilation band is ${VENT[0]}–${VENT[1]} m/s.`;
    cv.setAttribute('aria-label', `Where a flame can survive: ${summary.textContent} Use the arrow keys to read each cell, or open "Show the numbers".`);
    put(mmSlot, mm ? mmNote(sp) : null);
    put(legSlot, legend([
      { label: mm ? 'Flame survives (model only, hatched)' : 'Flame survives', color: 'rgba(217,89,38,.75)', mark: mm ? 'hatch' : 'square' },
      { label: 'Station ventilation range', color: 'rgba(57,135,229,.45)', mark: 'square' },
      { label: 'Hidden-risk band (model): out at 21%, burns at 34%', color: cssVar('--warn', '#fab219'), mark: 'dash' },
      { label: 'Air (21%) and exploration-cabin (34%) oxygen', color: cssVar('--ink2', '#bcc3d1'), mark: 'dash' }]));
    put(holder, cv, legSlot, lineP, bandP, mmSlot, summary);
    // min-O2 table over every map on offer (Moon and Mars only behind the switch)
    const was = tableSlot.querySelector('details')?.open;
    const rows = G.filter(x => showMM || !x.mm).flatMap(x => ps.map(p => maps.find(q => q.gravity === x.g && q.P_kPa === p)).filter(Boolean)).map(q => {
      const r = hiddenRisk(q);
      return [`${GNAME[q.gravity] || q.gravity}${modelOnly(q.gravity_label) && !/model only/.test(GNAME[q.gravity] || '') ? ' (model only)' : ''}`, q.P_kPa, pctO2(q.min_O2), q.min_O2_flow_m_s, r.runs.length ? rangeText(r.runs.map(z => [z.lo, z.hi])) : 'none'];
    });
    const nb = numbers('Lowest oxygen that burns, by gravity and pressure (model)', ['Gravity', 'Pressure, kPa', 'Lowest O2 that burns', 'At airflow, m/s', 'Hidden-risk band airflow'], rows,
      'Every map is the same thin acrylic sheet model. The hidden-risk band lists the airflow runs where the map shows no flame at 21% oxygen but a flame at 34%.');
    if (was) nb.open = true;
    put(tableSlot, nb);
  }

  cv.addEventListener('pointermove', e => {
    if (!M || !geo) return;
    const fl = M.flow_m_s, o2 = M.O2, lx = v => Math.log10(v);
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H;
    if (px < m.l || px > m.l + iw || py < m.t || py > m.t + ih) return untip();
    const f = 10 ** (lx(fl[0]) + (px - m.l) / iw * (lx(fl[fl.length - 1]) - lx(fl[0]))), o = o2[0] + (m.t + ih - py) / ih * (o2[o2.length - 1] - o2[0]);
    const i = fl.reduce((b, v, k) => (Math.abs(lx(v) - lx(f)) < Math.abs(lx(fl[b]) - lx(f)) ? k : b), 0), j = o2.reduce((b, v, k) => (Math.abs(v - o) < Math.abs(o2[b] - o) ? k : b), 0);
    tip(e, cellHtml(i, j));
  });
  cv.addEventListener('pointerleave', untip);

  const gravRow = () => {
    const opts2 = G.filter(x => showMM || !x.mm).map(x => [x.g, GNAME[x.g] || x.g]);
    const row = seg({ label: 'Gravity', options: opts2, value: st.g, onChange: v => { st.g = v; draw(); } });
    row.querySelectorAll('button').forEach(b => { if (G.find(x => x.g === b.dataset.v)?.mm) b.classList.add('mm'); });
    put(gravSlot, row);
  };
  const sw = mmControl(opts, v => setShowMM(v));
  function setShowMM(v) {
    showMM = !!v; sw.set(showMM);
    if (!showMM && G.find(x => x.g === st.g)?.mm) st.g = G.find(x => !x.mm)?.g || st.g;
    gravRow(); draw();
  }
  gravRow(); draw();
  // the "11%" caveat: min_O2 read from the orbit map at the chosen pressure (main typed 11% in)
  const caveat = h('small', {});
  const setCaveat = () => {
    const orbit = maps.find(x => x.gravity === '0 g' && x.P_kPa === st.p) || maps.find(x => x.gravity === '0 g');
    caveat.textContent = 'Limits are set by a Damköhler-number criterion tuned on one BASS-II blow-off and one quench point, so treat the edges as approximate. '
      + (orbit ? `BASS-II saw spread down to about 16–17% O2; the model's ${Math.round(orbit.min_O2 * 100)}% minimum in orbit${ps.length > 1 ? ` at ${orbit.P_kPa} kPa` : ''} is probably too low.` : 'BASS-II saw spread down to about 16–17% O2.');
  };
  setCaveat();
  const presRow = seg({ label: 'Pressure', options: ps.map(p => [p, `${p} kPa`]), value: st.p, onChange: v => { st.p = v; draw(); setCaveat(); } });
  const el = card(T, sp.status || 'model', 'Thin acrylic sheet, both sides burning. Too little airflow starves the flame of oxygen; too much blows it off.',
    h('div', { class: 'fl-controls' }, gravSlot, presRow, sw),
    holder, tableSlot,
    h('p', {}, caveat));
  el.setShowMM = setShowMM;
  return el;
}

// ---------- 5. A fire growing across a sample ----------
export function frontsCard(sp) {
  const T = 'A fire growing across a sample';
  if (isMissing(sp) || !Array.isArray(sp.fronts) || !sp.fronts.length) return missingCard(T, 'flame_spread', null, '{ "fronts": [{ "case", "t_s": [], "front_cm": [], "spread_mm_s", "t_burn_s" }] }');
  const name = f => f.case.split(',')[0];
  const len = f => { const mt = /sample\s+([\d.]+)\s*x/i.exec(f.case); return mt ? `${mt[1]} cm` : 'the sample'; };   // sample length read from the case text
  const series = sp.fronts.map((f, i) => ({ name: name(f), color: SERIES[i % SERIES.length], points: f.t_s.map((t, k) => [t / 60, f.front_cm[k]]).filter((_, k, a) => k % Math.ceil(a.length / 150) === 0), near: 2 }));
  return card(T, sp.status, 'Flame front marching across a 20 cm sheet in orbit, 21% oxygen, 0.10 m/s opposed airflow. This burning area feeds the growing smoke source in the cabin model.',
    lineChart({ title: T, series, xLabel: 'Minutes after ignition', yLabel: 'Front position, cm', unit: ' cm' }),
    h('div', { class: 'grid g3 fl-fronts' }, sp.fronts.map(f => h('div', { class: 'statbox' },
      h('span', { class: 'stat-label' }, name(f)), h('div', { class: 'stat' }, fmt(f.spread_mm_s, 2), h('small', {}, 'mm/s')),
      h('small', {}, `crosses ${len(f)} in ${fmt(f.t_burn_s / 60, 1)} min`)))));
}

// ---------- 6. Every check on the flame model ----------
export function flameChecksCard(fs, sp) {
  const T = 'Every check on the flame model';
  const list = [...(isMissing(fs) ? [] : fs.checks || []), ...(isMissing(sp) ? [] : sp.checks || [])];
  if (!list.length) return missingCard(T, isMissing(fs) ? 'flame_static' : 'flame_spread', null, '{ "checks": [{ "id", "ok": true | false | null, "result" }] }');
  const lab = v => (v === true ? ['pass', 'Pass'] : v === false ? ['fail', 'Fail (kept on record)'] : ['pending', 'Not run: no data']);
  const n = k => list.filter(c => c.ok === k).length;
  return card(T, (!isMissing(fs) && fs.status) || sp.status || 'model', 'Pass limits were committed before any check ran and were not changed after. Failures stay here.',
    h('p', { class: 'fl-count' }, `${list.length} checks: ${n(true)} pass, ${n(false)} fail and stay on record, ${n(null)} not run.`),
    table(['', 'Result', 'Status'], list.map(c => { const [s, t] = lab(c.ok); return [h('code', {}, c.id), c.result, h('span', { class: `status ${s}` }, t)]; }),
      { caption: 'Flame model checks from data/flame_static.json and data/flame_spread.json' }));
}

// ---------- 7. Limits ----------
export function flameLimitsCard(fs, sp, opts = {}) {
  const T = 'Limits';
  let showMM = !!opts.showMM;
  const fileLimits = [...(isMissing(fs) ? [] : fs.limits || []), ...(isMissing(sp) ? [] : sp.limits || [])];
  const mmLine = h('li', {});
  const setMM = () => put(mmLine, showMM
    ? 'Moon and Mars cases are shown because "Show Moon and Mars (model only)" is on. They are model output only: NASA has no flame data between 0 g and 1 g, so nothing could check them.'
    : 'Moon and Mars are hidden unless you switch on "Show Moon and Mars (model only)": NASA has no flame data between 0 g and 1 g, so nothing could check them.');
  setMM();
  const el = card(T, (!isMissing(fs) && fs.status) || (!isMissing(sp) && sp.status) || 'missing', null,
    fileLimits.length ? null : empty('Waiting for the flame model', 'flame_static', 'Run python models/flame-sim/build.py', null),
    h('ul', { class: 'fl-limits' }, fileLimits.map(t => h('li', {}, t)), mmLine, h('li', {}, 'Nothing here is a safety rating for any material or atmosphere.')));
  el.setShowMM = v => { showMM = !!v; setMM(); };
  return el;
}
