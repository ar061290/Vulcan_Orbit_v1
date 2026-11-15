// Assess page figures (site/REBUILD_PLAN.md §3.5, §2.12): the inputs, the camera loader, the verdict, the burning-area
// curve, the calibrated / extrapolated / assumed lists and the risk panel.
//
// Every card is built once with a stable shell (h2 + stamp + sub), so the "Made by" block and the figure anchor the
// post-render passes add stay in place. The live parts sit in a body element that `card.update(result, state)` replaces.
// Nothing here runs the growth model: js/pages/assess.js calls assess_core.computeAssessment and hands the result in.
//
// Numbers on screen come only from the data files (growth_examples, spread_predictor, gaps, saffire_latency, whatif,
// drift_whatif, risk_rules, cv_latest, cv_example) or from the growth port run on the visitor's inputs.
// Slider limits the brief does not give are derived from the data files (deriveBounds) and the page prints where each
// limit came from (plan §3.5, Q10).
import { h, add, card, badge, empty, sig, pct, stat, seg, numField, table, announce, load, isMissing } from './lib.js';
import { lineChart, numbers, SERIES, DASH, C } from './charts.js';

export const TITLES = {
  inputs: 'Flame now, fuel and cabin',
  camera: 'Load from camera',
  verdict: 'Will it spread here?',
  curve: 'Burning area over time',
  lists: 'What is calibrated, extrapolated and assumed',
  risk: 'Risk: the parts and the rule that fired',
};

// source: the standard atmosphere is defined as 101.325 kPa (used to turn gaps.json probe pressures into atm; plan §3.5)
const KPA_PER_ATM = 101.325;
const MATERIALS = [['PMMA', 'PMMA (acrylic)'], ['SIBAL', 'SIBAL fabric'], ['cotton', 'Cotton fabric']];
const OTHER = '__other';
const n4 = v => sig(v, 4);
const plain = v => String(Number(v));
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const examplesOf = d => (Array.isArray(d?.examples) ? d.examples : []);
const share = v => (isNum(v) ? pct(v) : 'n/a');
const shareRange = r => (Array.isArray(r) && r.length === 2 && r.every(isNum) ? `${pct(r[0])}–${pct(r[1])}` : null);

// ---------------------------------------------------------------- slider limits from the data files
const floor4 = v => { if (!v) return v; const f = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 3); return Number((Math.floor(v / f + 1e-6) * f).toPrecision(4)); };
const ceil4 = v => { if (!v) return v; const f = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 3); return Number((Math.ceil(v / f - 1e-6) * f).toPrecision(4)); };

/** Limits for the sliders the brief does not bound (pressure, width, length, thickness), plus airflow and oxygen
 *  read from the spread predictor's own grid. Each limit carries the file and value it came from.
 *  state: the current inputs; a value loaded from a link that falls outside the data range widens that limit. */
export function deriveBounds(data, state) {
  const sp = data?.sp, ex = examplesOf(data?.examples), probes = Array.isArray(data?.gaps?.probes) ? data.gaps.probes : [];
  const cands = { pressure_atm: [], thickness_mm: [], width_cm: [], length_cm: [] };
  const push = (k, v, src) => { if (isNum(v)) cands[k].push({ v, src }); };
  // spread_predictor.json constants.*.domain (every calibration box)
  const walk = (o, path, inDomain) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return;
    for (const [k, v] of Object.entries(o)) {
      const p = `${path}.${k}`;
      if (inDomain && Array.isArray(v) && v.length === 2 && v.every(isNum)) {
        if (k === 'pressure_atm') v.forEach(x => push('pressure_atm', x, `spread_predictor.json ${path}`));
        if (k === 'tau_mm') v.forEach(x => {
          push('thickness_mm', x, `spread_predictor.json ${path} (burning thickness τ ${plain(x)} mm, one side burning)`);
          push('thickness_mm', 2 * x, `spread_predictor.json ${path} (τ ${plain(x)} mm is a ${plain(2 * x)} mm sheet burning on both sides; τ = thickness ÷ 2, GROWTH_API.md)`);
        });
      } else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p, inDomain || k === 'domain');
    }
  };
  walk(sp?.constants, 'constants', false);
  for (const e of ex) {
    const f = e.inputs?.fuel || {}, c = e.inputs?.conditions || {}, src = `growth_examples.json "${e.id}"`;
    push('width_cm', f.width_cm, src); push('length_cm', f.length_cm, src); push('thickness_mm', f.thickness_mm, src);
    push('pressure_atm', c.pressure_atm, src);
  }
  for (const p of probes) if (isNum(p.kpa)) push('pressure_atm', p.kpa / KPA_PER_ATM, `gaps.json probe "${p.atmosphere}" (${plain(p.kpa)} kPa ÷ ${KPA_PER_ATM})`);
  const out = {};
  for (const [k, list] of Object.entries(cands)) {
    if (!list.length) { out[k] = null; continue; }
    const lo = list.reduce((a, b) => (b.v < a.v ? b : a)), hi = list.reduce((a, b) => (b.v > a.v ? b : a));
    out[k] = { min: floor4(lo.v), max: ceil4(hi.v), minSrc: lo.src, maxSrc: hi.src, rounded: floor4(lo.v) !== lo.v || ceil4(hi.v) !== hi.v };
  }
  // airflow and oxygen: the predictor grid (it spans the brief's 0–50 cm/s and 15–35 %)
  const grid = (arr, src) => (Array.isArray(arr) && arr.length && arr.every(isNum) ? { min: Math.min(...arr), max: Math.max(...arr), minSrc: src, maxSrc: src, grid: true } : null);
  // source: spec C2 gives airflow 0–50 cm/s and O2 15–35 %; used only when spread_predictor.json is missing
  out.flow_cm_s = grid(sp?.flow_cm_s, 'spread_predictor.json flow_cm_s grid') || { min: 0, max: 50, minSrc: 'the brief (spec C2)', maxSrc: 'the brief (spec C2)' };
  out.o2_vol_pct = grid(sp?.o2_vol_pct, 'spread_predictor.json o2_vol_pct grid') || { min: 15, max: 35, minSrc: 'the brief (spec C2)', maxSrc: 'the brief (spec C2)' };
  // widen to include a value loaded from a link or a camera file, never clamp it silently
  const cur = { pressure_atm: state?.conditions?.pressure_atm, flow_cm_s: state?.conditions?.flow_cm_s, o2_vol_pct: state?.conditions?.o2_vol_pct,
    thickness_mm: state?.fuel?.thickness_mm, width_cm: state?.fuel?.width_cm, length_cm: state?.fuel?.length_cm };
  for (const [k, v] of Object.entries(cur)) {
    const b = out[k]; if (!b || !isNum(v)) continue;
    if (v < b.min) { b.min = v; b.minSrc = 'the value you loaded (below the data range)'; b.widened = true; }
    if (v > b.max) { b.max = v; b.maxSrc = 'the value you loaded (above the data range)'; b.widened = true; }
  }
  return out;
}
const fromText = b => (b ? `Limits from the data: ${plain(b.min)} (${b.minSrc}) to ${plain(b.max)} (${b.maxSrc})${b.rounded ? ', rounded outward to 4 significant figures' : ''}.` : 'Limits: no data file to derive them from.');

// ---------------------------------------------------------------- helpers
/** Change a numField's limits in place (keeps focus and the visible readout in step). */
function setLimits(nf, min, max, unit) {
  nf.querySelectorAll('input').forEach(i => { i.min = min; i.max = max; });
  const r = nf.querySelector('.nf-range'); if (r) r.textContent = `min ${plain(min)} · max ${plain(max)}${unit ? ' ' + unit : ''}`;
}
const FIELD = {
  flow_cm_s: ['Airflow', 'cm/s'], o2_vol_pct: ['Oxygen', '%'], pressure_atm: ['Pressure', 'atm'],
  tau_mm: ['Burning thickness τ', 'mm'], thickness_mm: ['Thickness', 'mm'], area_density: ['Fabric area density', 'mg/cm²'],
  area_density_mg_cm2: ['Fabric area density', 'mg/cm²'], width_cm: ['Width', 'cm'], length_cm: ['Length', 'cm'],
};
const fieldName = f => (FIELD[f] ? FIELD[f][0] : String(f));
const fieldUnit = f => (FIELD[f] ? FIELD[f][1] : '');
const BOX_TO_CONTROL = { flow_cm_s: 'flow', o2_vol_pct: 'o2', pressure_atm: 'p', tau_mm: 'th', thickness_mm: 'th' };
const boxesOf = r => (Array.isArray(r?.boxes) ? r.boxes : []);
const boxText = b => `${n4(b.lo)}–${n4(b.hi)}${fieldUnit(b.field) ? ' ' + fieldUnit(b.field) : ''}`;

const body = cls => h('div', { class: `as-body ${cls || ''}`.trim(), 'aria-busy': 'true' }, h('p', { class: 'as-wait' }, 'Running the spread predictor for these inputs…'));
// The passes.js a11y pass labels every .scroll once, at render; these bodies are filled later (after each run), so each
// new table wrapper gets the same keyboard scroll stop here (WCAG 2.1.1; site/A11Y.md §2.2).
function scrollStops(el) {
  const t = el.dataset?.title || '';
  el.querySelectorAll('.scroll').forEach((s, i) => {
    s.tabIndex = 0; s.setAttribute('role', 'region');
    if (!s.hasAttribute('aria-label')) s.setAttribute('aria-label', `Table ${i + 1}${t ? ': ' + t : ''}`);
  });
}
function setBody(el, ...kids) { const b = el.querySelector(':scope > .as-body'); b.replaceChildren(); add(b, ...kids); scrollStops(el); b.setAttribute('aria-busy', 'false'); }
export function setBusy(cards, busy) { for (const c of cards) c?.querySelector(':scope > .as-body')?.setAttribute('aria-busy', String(!!busy)); }
/** Replace each card's live body with one plain note (used when the page is rendered detached for the site map). */
export function idle(cards, text) { for (const c of cards) if (c?.querySelector(':scope > .as-body')) setBody(c, h('p', { class: 'as-note' }, text)); }
/** Set a numField without disturbing a field the visitor is typing in or dragging. */
const setNF = (nf, v) => { if (nf && !(typeof document !== 'undefined' && nf.contains(document.activeElement))) nf.set(v); };

/** Full AssessInputs for a worked example, with explicit nulls for the optional keys, so applying a preset over earlier
 *  inputs never keeps a stale optional value (store.set merges each group). */
export function presetState(store, example) {
  const s = store.fromPreset(example);
  s.flame.droplet ??= null; s.flame.bbox_cm ??= null; s.flame.confidence ??= null;
  s.fuel.area_density_mg_cm2 = s.fuel.area_density_mg_cm2 ?? null;
  return s;
}

// ---------------------------------------------------------------- 1. inputs
/** "Flame now, fuel and cabin": preset, flame, fuel and cabin controls. Every slider has a number field, units and its
 *  min and max. Edits are sent to the store at most every 200 ms (each store.set also rewrites the URL).
 *  Returns the card with .sync(state) (refresh the controls) and .update(result) (out-of-box flags). */
export function inputsCard(store, data, ctx = {}) {
  const ex = examplesOf(data?.examples);
  if (isMissing(data?.examples) || isMissing(data?.sp) || !ex.length) {
    const c = card(TITLES.inputs, 'missing', 'The inputs need the worked examples and the spread predictor.',
      isMissing(data?.examples) || !ex.length ? empty('No worked examples yet', 'growth_examples', 'The presets and the starting inputs come from this file.', '{status, examples:[{id, title, inputs:{flame_state, fuel, conditions}, summary, …}]}') : null,
      isMissing(data?.sp) ? empty('No spread predictor yet', 'spread_predictor', 'The calibration boxes and constants come from this file.', '{status, flow_cm_s:[…], o2_vol_pct:[…], constants:{…}}') : null);
    c.sync = () => {}; c.update = () => {};
    return c;
  }
  const defEx = ex.find(e => e.id === store.DEFAULT_PRESET) || ex[0];
  let S = store.initialised?.() ? store.get() : presetState(store, defEx);
  const B = deriveBounds(data, S);

  // ---- local working copy; committed to the store at most every 200 ms
  let timer = null, lastCommit = 0, dirty = false;
  const commit = () => {
    timer = null; if (!dirty || ctx.detached) return;
    dirty = false; lastCommit = Date.now();
    store.set({ preset: null, flame: S.flame, fuel: S.fuel, conditions: S.conditions });
  };
  const schedule = () => {
    dirty = true; if (ctx.detached) return;
    const wait = Math.max(0, 200 - (Date.now() - lastCommit));
    if (!timer) timer = setTimeout(commit, wait);
  };
  ctx.onLeave?.(() => { if (timer) { clearTimeout(timer); timer = null; } });
  const flush = () => { if (timer) { clearTimeout(timer); timer = null; } commit(); };

  // ---- preset
  const presetSel = h('select', { id: 'as-preset' },
    h('option', { value: '' }, 'Your own inputs'),
    ex.map(e => h('option', { value: e.id }, e.title)));
  presetSel.value = S.preset || '';
  presetSel.addEventListener('change', () => {
    const e = ex.find(x => x.id === presetSel.value); if (!e) return;
    if (timer) { clearTimeout(timer); timer = null; } dirty = false;
    store.set(presetState(store, e));
  });
  const presetWhy = h('p', { class: 'as-why' });

  // ---- flame
  const fl = () => S.flame || {};
  const W = () => Number(S.fuel?.width_cm), L = () => Number(S.fuel?.length_cm);
  const areaMax = () => Number((W() * L()).toPrecision(6));
  const typeSeg = seg({ label: 'Flame type', id: 'as-ft', options: [['surface', 'Surface (on a solid)'], ['droplet', 'Droplet']], value: fl().flame_type || 'surface',
    onChange: v => { S.flame = { ...fl(), flame_type: v, source: 'sliders' }; dirty = true; flush(); } });
  const reshape = patch => { S.flame = store.reshapeFlame(fl(), patch); schedule(); };
  const nfArea = numField({ id: 'as-a', label: 'Flame area', unit: 'cm²', min: 0.1, max: areaMax(), step: 0.1, value: fl().area_cm2 ?? 0.1, onInput: v => reshape({ area_cm2: v }) });
  const nfX = numField({ id: 'as-x', label: 'Position along the length, x', unit: 'cm', min: 0, max: L(), step: 0.05, value: fl().centroid_cm?.[0] ?? 0,
    onInput: v => reshape({ centroid_cm: [v, fl().centroid_cm?.[1] ?? W() / 2] }) });
  const nfY = numField({ id: 'as-y', label: 'Position across the width, y', unit: 'cm', min: 0, max: W(), step: 0.05, value: fl().centroid_cm?.[1] ?? 0,
    onInput: v => reshape({ centroid_cm: [fl().centroid_cm?.[0] ?? L() / 2, v] }) });
  const flameFrom = h('small', { class: 'as-from' });
  const dropNote = h('p', { class: 'as-note', hidden: true });
  const flameNote = h('p', { class: 'as-note' });

  // ---- fuel
  const known = m => MATERIALS.some(([v]) => v === m);
  const matSel = h('select', { id: 'as-m' }, MATERIALS.map(([v, t]) => h('option', { value: v }, t)), h('option', { value: OTHER }, 'Another material (not modelled)'));
  const otherIn = h('input', { type: 'text', id: 'as-m-other', autocomplete: 'off', placeholder: 'Name of the material' });
  const otherWrap = h('div', { class: 'as-other', hidden: true }, h('label', { for: 'as-m-other' }, 'Which material?'), otherIn);
  const setMaterial = () => {
    const other = matSel.value === OTHER;
    otherWrap.hidden = !other;
    S.fuel = { ...S.fuel, material: other ? (otherIn.value.trim() || 'another material') : matSel.value };
    dirty = true; flush();
  };
  matSel.addEventListener('change', setMaterial);
  otherIn.addEventListener('change', setMaterial);
  const fuelNF = (id, label, unit, key, step) => numField({ id, label, unit, min: B[key]?.min ?? 0, max: B[key]?.max ?? 1, step, value: S.fuel?.[key] ?? B[key]?.min ?? 0,
    onInput: v => { S.fuel = { ...S.fuel, [key]: v }; if (key === 'width_cm' || key === 'length_cm') flameLimits(); schedule(); } });
  const nfW = fuelNF('as-w', 'Fuel width', 'cm', 'width_cm', 0.1);
  const nfL = fuelNF('as-l', 'Fuel length', 'cm', 'length_cm', 0.1);
  const nfTh = fuelNF('as-th', 'Fuel thickness', 'mm', 'thickness_mm', 0.01);
  const sidesSeg = seg({ label: 'Sides burning', id: 'as-sd', options: [[1, 'One side'], [2, 'Both sides']], value: S.fuel?.sides_burning ?? 2,
    onChange: v => { S.fuel = { ...S.fuel, sides_burning: Number(v) }; dirty = true; flush(); } });

  // ---- cabin
  const condNF = (id, label, unit, key, step) => numField({ id, label, unit, min: B[key].min, max: B[key].max, step, value: S.conditions?.[key] ?? B[key].min,
    onInput: v => { S.conditions = { ...S.conditions, [key]: v }; schedule(); } });
  const nfU = condNF('as-u', 'Airflow speed', 'cm/s', 'flow_cm_s', 0.1);
  const nfDir = numField({ id: 'as-dir', label: 'Airflow direction', unit: 'degrees', min: 0, max: 359, step: 1, value: S.conditions?.flow_direction_deg ?? 0,
    onInput: v => { S.conditions = { ...S.conditions, flow_direction_deg: v }; schedule(); } });
  const nfO2 = condNF('as-o2', 'Oxygen', '%', 'o2_vol_pct', 0.1);
  const nfP = B.pressure_atm ? condNF('as-p', 'Pressure', 'atm', 'pressure_atm', 0.001) : null;

  // ---- one field = slider + where its limits came from + an out-of-box flag
  const flags = {};
  const field = (key, nf, from) => { const flag = h('p', { class: 'as-flag', hidden: true, id: `as-flag-${key}` }); flags[key] = flag; return h('div', { class: 'as-field' }, nf, from, flag); };
  function flameLimits() {
    const am = areaMax();
    if (isNum(am) && am > 0) setLimits(nfArea, 0.1, am, 'cm²');
    if (isNum(L())) setLimits(nfX, 0, L(), 'cm');
    if (isNum(W())) setLimits(nfY, 0, W(), 'cm');
    flameFrom.textContent = `Limits from the fuel you set: area up to its width × length (${plain(W())} × ${plain(L())} = ${plain(am)} cm²), x from 0 to its length, y from 0 to its width. The lowest area is one slider step (0.1 cm²), since an area must be above 0.`;
  }
  flameLimits();

  const fs = (legendText, ...kids) => h('fieldset', { class: 'as-group' }, h('legend', {}, legendText), ...kids);
  const c = card(TITLES.inputs, data.examples.status || 'model', 'Set the flame, the fuel and the cabin air, or start from a worked example. Values outside the calibration box are allowed and flagged.',
    h('div', { class: 'as-preset' }, h('label', { for: 'as-preset' }, 'Start from a worked example'), presetSel, presetWhy),
    h('div', { class: 'as-groups' },
      fs('Flame now', typeSeg, field('a', nfArea), field('x', nfX), field('y', nfY, flameFrom), flameNote, dropNote),
      fs('Fuel', h('div', { class: 'as-field' }, h('label', { for: 'as-m' }, 'Material'), matSel, otherWrap),
        field('w', nfW, h('small', { class: 'as-from' }, fromText(B.width_cm))), field('l', nfL, h('small', { class: 'as-from' }, fromText(B.length_cm))),
        field('th', nfTh, h('small', { class: 'as-from' }, fromText(B.thickness_mm))), sidesSeg),
      fs('Cabin air', field('flow', nfU, h('small', { class: 'as-from' }, fromText(B.flow_cm_s))),
        field('dir', nfDir, h('small', { class: 'as-from' }, '0 degrees: the air moves along +x, the fuel length; 90 degrees: along +y, across it (fuel coordinates, models/m6b-predictor/CONTRACT_PROPOSAL.md).')),
        field('o2', nfO2, h('small', { class: 'as-from' }, fromText(B.o2_vol_pct))),
        nfP ? field('p', nfP, h('small', { class: 'as-from' }, fromText(B.pressure_atm))) : h('p', { class: 'as-note' }, 'Pressure: no data file to derive the slider limits from.'))));

  /** Refresh every control from the store (a preset, a camera reading or a link changed the inputs). */
  c.sync = st => {
    S = { ...st, flame: { ...(st.flame || {}) }, fuel: { ...(st.fuel || {}) }, conditions: { ...(st.conditions || {}) } };
    presetSel.value = S.preset && ex.some(e => e.id === S.preset) ? S.preset : '';
    const e = ex.find(x => x.id === S.preset);
    presetWhy.textContent = e ? e.why || '' : 'Your own inputs: no worked example matches them exactly.';
    typeSeg.set(fl().flame_type || 'surface');
    flameLimits();
    if (isNum(fl().area_cm2)) setNF(nfArea, fl().area_cm2);
    if (Array.isArray(fl().centroid_cm)) { setNF(nfX, fl().centroid_cm[0]); setNF(nfY, fl().centroid_cm[1]); }
    const m = S.fuel.material;
    if (known(m)) { matSel.value = m; otherWrap.hidden = true; }
    else { matSel.value = OTHER; otherWrap.hidden = false; if (document.activeElement !== otherIn) otherIn.value = m && m !== 'another material' ? m : ''; }
    for (const [nf, k] of [[nfW, 'width_cm'], [nfL, 'length_cm'], [nfTh, 'thickness_mm']]) if (isNum(S.fuel[k])) setNF(nf, S.fuel[k]);
    sidesSeg.set(S.fuel.sides_burning ?? 2);
    for (const [nf, k] of [[nfU, 'flow_cm_s'], [nfDir, 'flow_direction_deg'], [nfO2, 'o2_vol_pct'], [nfP, 'pressure_atm']]) if (nf && isNum(S.conditions[k])) setNF(nf, S.conditions[k]);
    const drop = fl().flame_type === 'droplet';
    dropNote.hidden = !drop;
    dropNote.textContent = drop ? `Droplet flame: area and position are not used. ${isNum(fl().droplet?.diameter_mm) ? `Droplet diameter from the reading: ${plain(fl().droplet.diameter_mm)} mm. ` : ''}M6b does not simulate droplets; see "Will it spread here?" for where the droplet answer lives.` : '';
    const src = { sliders: 'the sliders', preset: 'a worked example', camera: 'a camera reading', example: 'the example camera reading (demo data)' }[fl().source] || 'the sliders';
    flameNote.textContent = `${Array.isArray(fl().bbox_cm) ? `Starting flame box [${fl().bbox_cm.map(v => n4(v)).join(', ')}] cm; moving the area or position keeps its shape.` : 'No flame box given: the starting flame is a circle of this area.'} Flame fields from ${src}.`;
  };
  /** Show an out-of-box flag beside each input the result checked. */
  c.update = result => {
    Object.values(flags).forEach(f => { f.hidden = true; f.textContent = ''; });
    for (const b of boxesOf(result)) {
      const key = BOX_TO_CONTROL[b.field]; if (!key || !flags[key] || b.inside) continue;
      flags[key].hidden = false;
      add(flags[key], h('b', {}, 'Outside the calibration box'), ` (${fieldName(b.field)} ${boxText(b)}): this value is extrapolated, not validated.`);
    }
  };
  c.sync(S);
  return c;
}

// ---------------------------------------------------------------- 2. camera
const CV_SHAPE = '{status:"model"|"dome", frame_time_s, flame_type:"surface"|"droplet", area_cm2, centroid_cm:[x, y],\n bbox_cm:[x0, y0, x1, y1] (optional), coordinates:"fuel", confidence:0..1 (optional),\n droplet:{diameter_mm} (droplet flames only)}';

/** "Load from camera": the latest camera file when there is one, a JSON file or paste box, and the demo example button.
 *  Returns the card with .sync(state) and .apply(obj, source, label) (used by the page for the camera file on load). */
export function cameraCard(store, data) {
  const cv = data?.cv, hasCV = !isMissing(cv);
  const msg = h('div', { class: 'as-cam-msg' });
  const now = h('p', { class: 'as-cam-now' });
  const apply = (obj, source, label) => {
    const { ok, errors } = store.applyFlameState(obj, source);
    msg.replaceChildren();
    if (ok) {
      add(msg, h('p', { class: 'as-ok' }, `${label}: used. The flame fields above now come from it.`));
      announce(`${label} loaded.`);
    } else {
      add(msg, h('div', { class: 'as-err', role: 'group', 'aria-label': 'Problems with this reading' },
        h('p', {}, h('b', {}, `${label} was not used.`), ` ${errors.length} problem${errors.length === 1 ? '' : 's'} found; nothing was filled in:`),
        h('ul', {}, errors.map(e => h('li', {}, e)))));
      announce(`${label} rejected: ${errors.length} problem${errors.length === 1 ? '' : 's'}.`);
    }
    return ok;
  };
  const parseAndApply = (text, label) => {
    let obj;
    try { obj = JSON.parse(text); }
    catch (e) {
      msg.replaceChildren(h('div', { class: 'as-err' }, h('p', {}, h('b', {}, `${label} was not used.`), ` It is not valid JSON: ${e.message}`)));
      announce(`${label} rejected: not valid JSON.`);
      return false;
    }
    return apply(obj, 'camera', label);
  };

  const file = h('input', { type: 'file', id: 'as-cam-file', accept: '.json,application/json' });
  file.addEventListener('change', () => {
    const f = file.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => parseAndApply(String(rd.result || ''), `The file ${f.name}`);
    rd.onerror = () => { msg.replaceChildren(h('p', { class: 'as-err' }, `The file ${f.name} could not be read.`)); };
    rd.readAsText(f);
  });
  const paste = h('textarea', { id: 'as-cam-paste', rows: 6, spellcheck: 'false', 'aria-describedby': 'as-cam-shape' });
  const useBtn = h('button', { type: 'button', class: 'chip' }, 'Check and use this reading');
  useBtn.addEventListener('click', () => {
    if (!paste.value.trim()) { msg.replaceChildren(h('p', { class: 'as-err' }, 'The paste box is empty.')); announce('The paste box is empty.'); return; }
    parseAndApply(paste.value, 'The pasted reading');
  });
  const exBtn = h('button', { type: 'button', class: 'chip' }, 'Try an example camera reading');
  exBtn.addEventListener('click', async () => {
    const d = await load('cv_example');
    if (isMissing(d)) { msg.replaceChildren(empty('No example camera reading yet', 'cv_example', 'The example button needs this demo file.', CV_SHAPE)); return; }
    apply(d, 'example', 'The example camera reading (demo data)');
  });
  const latestBtn = hasCV ? h('button', { type: 'button', class: 'chip' }, 'Use the latest camera reading') : null;
  latestBtn?.addEventListener('click', () => apply(cv, 'camera', 'The latest camera reading'));

  const sf = hasCV ? cv.smoke_flow : null;
  const smoke = sf && typeof sf === 'object' ? h('div', { class: 'as-smoke' },
    h('h3', {}, 'Smoke flow at the dome ', badge(sf.status || cv.status)),
    h('p', {}, `Smoke speed ${isNum(sf.speed_mm_s) ? plain(sf.speed_mm_s) + ' mm/s' : 'not in the file'}, direction ${isNum(sf.direction_deg) ? plain(sf.direction_deg) + ' degrees' : 'not in the file'}${isNum(sf.frame_time_s) ? `, frame at ${plain(sf.frame_time_s)} s` : ''}. Information only: it is not a growth input and does not change the cabin airflow above.`)) : null;

  if (hasCV) {
    now.textContent = `Latest camera reading (data/cv_latest.json): ${cv.flame_type || 'unknown'} flame${isNum(cv.area_cm2) ? `, area ${plain(cv.area_cm2)} cm²` : ''}${Array.isArray(cv.centroid_cm) ? ` at (${cv.centroid_cm.map(plain).join(', ')}) cm` : ''}${isNum(cv.frame_time_s) ? `, frame at ${plain(cv.frame_time_s)} s` : ''}${isNum(cv.confidence) ? `, confidence ${plain(cv.confidence)}` : ''}.`;
  }
  const c = card(TITLES.camera, hasCV ? cv.status : 'missing', 'Fill the flame fields from the camera model\'s reading, a JSON file or a paste. A reading is checked field by field and never used in part.',
    hasCV ? h('div', { class: 'as-cam-latest' }, now, latestBtn) : h('div', { class: 'as-cam-latest' },
      h('p', { class: 'as-cam-none' }, h('b', {}, 'Camera model not connected yet: using the sliders.')),
      empty('No camera reading yet', 'cv_latest', 'The camera owner adds this file when the camera model runs on the bench rig.', CV_SHAPE)),
    h('div', { class: 'as-cam-in' },
      h('div', { class: 'as-field' }, h('label', { for: 'as-cam-file' }, 'Load a camera file (JSON)'), file),
      h('div', { class: 'as-field' }, h('label', { for: 'as-cam-paste' }, 'Or paste a camera reading (JSON)'), paste,
        h('small', { id: 'as-cam-shape', class: 'as-from' }, 'Shape: models/m6b-predictor/CONTRACT_PROPOSAL.md (coordinates must be "fuel": x along the length, y across the width, in cm).'), useBtn),
      h('div', { class: 'as-example' }, exBtn, badge('demo'),
        h('small', {}, 'A demo copy of worked example 1\'s flame (data/cv_example.json), not a camera measurement.'))),
    msg, smoke);
  c.apply = apply;
  c.sync = () => {};
  return c;
}

// ---------------------------------------------------------------- 3. verdict
const caseRecord = (sp, m) => {
  const cases = sp?.constants?.verdict?.cases || [];
  return cases.find(c => c.case_id === m.case_id && c.flow_direction === m.flow_direction) || cases.find(c => c.case_id === m.case_id) || null;
};
const DIR = { opposed: 'Upwind (opposed flow)', concurrent: 'Downwind (concurrent flow)' };

/** "Will it spread here?": the verdict, the matched NASA cases and the inputs checked against the calibration box. */
export function verdictCard(result, data) {
  const sp = data?.sp;
  const c = card(TITLES.verdict, isMissing(sp) ? 'missing' : (sp.status || 'model'), 'The spread predictor\'s verdict for this fuel, airflow and oxygen, and the NASA cases it matched.', body());
  c.update = r => {
    if (isMissing(sp)) return setBody(c, empty('No spread predictor yet', 'spread_predictor', 'The verdict boxes and NASA cases come from this file.', '{status, constants:{verdict:{cases:[…]}, …}}'));
    if (!r) return;
    if (r.kind === 'droplet') {
      return setBody(c, h('p', { class: 'as-verdict' }, 'Droplet flame: handled by M7, not by the spread predictor'),
        h('p', {}, r.pointer?.note || 'Droplet flames are not simulated by M6b.'),
        h('p', { class: 'as-note' }, 'No number is shown: M7 publishes scores, not a burning-rate or extinction table for new conditions, so the site cannot compute one here (models/m6b-predictor/GROWTH_API.md).'));
    }
    if (r.kind === 'unsupported') {
      return setBody(c, h('p', { class: 'as-verdict as-unsup' }, 'Not supported'),
        h('p', {}, `${r.error || 'This material is not modelled.'} The spread predictor is calibrated for PMMA, SIBAL fabric and cotton only, so no verdict and no growth are shown.`));
    }
    if (r.kind === 'invalid' || !r.growth) {
      const errs = Array.isArray(r.errors) && r.errors.length ? r.errors : [r.error || 'An input is missing or not a number.'];
      return setBody(c, h('p', { class: 'as-verdict as-unsup' }, 'These inputs cannot be run'), h('ul', {}, errs.map(e => h('li', {}, e))));
    }
    const v = r.growth.verdict || {}, cases = Array.isArray(v.matched_cases) ? v.matched_cases : [];
    const bx = boxesOf(r), out = bx.filter(b => !b.inside);
    setBody(c,
      h('p', { class: 'as-verdict', 'data-code': v.code }, 'Verdict: ', h('b', {}, v.label || 'n/a')),
      h('ul', { class: 'as-dirs' }, Object.entries(v.by_direction || {}).map(([d, l]) => h('li', {}, `${DIR[d] || d}: `, h('b', {}, l)))),
      cases.length
        ? table(['Case', 'Stamp', 'Level', 'NASA outcome', 'Flow', 'Record as written'],
          cases.map(m => { const rec = caseRecord(sp, m); return [m.case_id, badge(m.status), m.level, m.outcome, m.flow_direction, rec?.record_as_written ?? 'n/a']; }),
          { caption: `${cases.length} NASA case${cases.length === 1 ? '' : 's'} near these conditions where a flame went out or did not spread` })
        : h('p', {}, 'No NASA case of a flame going out or failing to spread lies near these conditions.'),
      bx.length ? h('div', { class: 'as-boxes' },
        h('h3', {}, out.length ? `${out.length} input${out.length === 1 ? '' : 's'} outside the calibration box` : 'Every checked input is inside the calibration box'),
        table(['Input', 'Box', 'Your value', 'Calibration box', 'Inside?'],
          bx.map(b => [fieldName(b.field), b.box || '', `${n4(b.value)}${fieldUnit(b.field) ? ' ' + fieldUnit(b.field) : ''}`, boxText(b),
            b.inside ? 'Inside' : h('b', { class: 'as-out' }, 'Outside: extrapolated')]),
          { caption: 'Inputs checked against the calibration box of the active regime' })) : null);
  };
  if (result) c.update(result);
  return c;
}

// ---------------------------------------------------------------- 4. burning area over time
const RUNS = [['lo', 'Slow run (lo)'], ['mid', 'Middle run (mid)'], ['hi', 'Fast run (hi)']];
const sumRange = (sm, k) => { const v = RUNS.map(([r]) => sm?.[r]?.[k]).filter(isNum); return v.length ? [Math.min(...v), Math.max(...v)] : null; };
const rangeTxt = (r, unit) => (r ? (r[0] === r[1] ? '' : `range ${n4(r[0])}–${n4(r[1])}${unit ? ' ' + unit : ''}`) : '');

/** "Burning area over time": lo, mid and hi curves on t_abs_s with the Saffire-III alarm times marked for scale.
 *  The page's full result is passed to .update (the detection times live in result.detection). */
export function outputsCard(result) {
  const c = card(TITLES.curve, 'model', 'The burning area of the fuel face for slow, middle and fast spread, from the flame you set until the fire stops.', body('as-curve'));
  c.update = r => {
    if (!r) return;
    if (r.kind !== 'growth' || !r.growth) {
      return setBody(c, h('p', { class: 'as-note' }, r.kind === 'droplet' ? 'No growth curve: droplet flames are handled by M7, and M6b gives no number for them.'
        : r.kind === 'unsupported' ? 'No growth curve: this material is not supported.' : 'No growth curve for these inputs.'));
    }
    const g = r.growth, t = g.t_abs_s || g.t_s || [], A = g.area_cm2 || {}, sm = g.summary || {}, d = r.detection || {};
    const pts = k => t.map((x, i) => [x, isNum(A[k]?.[i]) ? A[k][i] : null]);
    const band = t.map((x, i) => [x, Math.min(A.lo?.[i], A.hi?.[i]), Math.max(A.lo?.[i], A.hi?.[i])]);
    const markers = [];
    if (isNum(d.radiometer_s)) markers.push({ x: d.radiometer_s, label: `Saffire-III radiometer alarm ${plain(d.radiometer_s)} s*`, color: C.mute });
    const sk = Array.isArray(d.smoke_s) ? d.smoke_s : [];
    if (isNum(sk[0])) markers.push({ x: sk[0], label: `Saffire-III smoke alarm, first ${plain(sk[0])} s*`, color: C.mute, dy: 14 });
    if (isNum(sk[1]) && sk[1] !== sk[0]) markers.push({ x: sk[1], label: `last ${plain(sk[1])} s*`, color: C.mute, dy: 28 });
    const chart = lineChart({
      title: TITLES.curve, xLabel: 'Time after ignition, s', yLabel: 'Burning area, cm²', unit: ' cm²', table: false, markers,
      series: [
        { name: 'Slow run (lo)', points: pts('lo'), color: SERIES[0], dash: DASH[1] },
        { name: 'Middle run (mid)', points: pts('mid'), band, color: SERIES[1], dash: '' },
        { name: 'Fast run (hi)', points: pts('hi'), color: SERIES[3], dash: DASH[3] },
      ],
    });
    const mx = sumRange(sm, 'max_area_cm2'), tm = sumRange(sm, 't_max_s'), te = sumRange(sm, 't_end_s');
    const reasons = [...new Set(RUNS.map(([k]) => sm[k]?.stop_reason).filter(Boolean))];
    const mid = sm.mid || {};
    setBody(c,
      h('div', { class: 'as-stats' },
        stat('Largest burning area (mid)', `${n4(mid.max_area_cm2)} cm²`, rangeTxt(mx, 'cm²')),
        stat('Time to the largest area (mid)', `${n4(mid.t_max_s)} s`, rangeTxt(tm, 's')),
        stat('The fire stops at (mid)', `${n4(mid.t_end_s)} s`, rangeTxt(te, 's')),
        stat('Why it stops', reasons.length === 1 ? reasons[0] : reasons.join('; ') || 'n/a', reasons.length > 1 ? 'differs between runs' : '')),
      chart,
      numbers(`${TITLES.curve}: burning area of each run`, ['Time after ignition, s', 'Slow run (lo), cm²', 'Middle run (mid), cm²', 'Fast run (hi), cm²'],
        t.map((x, i) => [x, A.lo?.[i] ?? 'n/a', A.mid?.[i] ?? 'n/a', A.hi?.[i] ?? 'n/a']),
        markers.length ? `Marked lines: ${markers.map(m => `${m.label.replace(/\*$/, '')} at ${plain(m.x)} s`).join('; ')}.` : null),
      table(['Run', 'Largest area, cm²', 'Time to largest, s', 'Fire stops, s', 'Area burned, cm²', 'Why it stops'],
        RUNS.map(([k, name]) => [name, n4(sm[k]?.max_area_cm2), n4(sm[k]?.t_max_s), n4(sm[k]?.t_end_s), n4(sm[k]?.area_consumed_cm2), sm[k]?.stop_reason ?? 'n/a']),
        { caption: 'The three runs' }),
      h('p', { class: 'as-note' }, `In words: the middle run peaks at ${n4(mid.max_area_cm2)} cm² ${n4(mid.t_max_s)} s after the flame reading and stops ${n4(mid.t_end_s)} s after it (${mid.stop_reason || 'n/a'}). The shaded band runs between the slow and fast runs: an envelope, not a confidence interval. The chart's time axis is seconds after ignition: the reading's frame time plus the simulated time.`),
      markers.length ? h('p', { class: 'as-note' }, '* The marked lines are times after ignition on NASA\'s Saffire-III burns (data/saffire_latency.json), a different fire, shown for scale and not as a prediction for this one.') : null);
  };
  if (result) c.update(result);
  return c;
}

// ---------------------------------------------------------------- 5. lists
/** "What is calibrated, extrapolated and assumed": the growth run's three lists, plus the starting-flame shape. */
export function listsCard(result) {
  const c = card(TITLES.lists, 'model', 'The limits of this run, from the growth simulation itself. They change with your inputs.', body('as-lists'));
  c.update = (r, state) => {
    if (!r) return;
    if (r.kind !== 'growth' || !r.growth) return setBody(c, h('p', { class: 'as-note' }, 'No growth run for these inputs, so there are no lists.'));
    const g = r.growth, f = state?.flame || {};
    const shape = Array.isArray(f.bbox_cm)
      ? 'Starting flame: an ellipse inside the given box, scaled to the given area; moving the area or position on this page keeps the box\'s shape (added by this page).'
      : 'Starting flame: no box given, so it is a circle of the given area, a = b = √(area/π) (added by this page).';
    const list = (head, items, cls, extra) => h('div', { class: `as-list ${cls}` }, h('h3', {}, head),
      (items.length || extra) ? h('ul', {}, items.map(x => h('li', {}, x)), extra ? h('li', {}, extra) : null) : h('p', {}, 'Nothing in this run.'));
    const cal = Array.isArray(g.calibrated) ? g.calibrated : [], ext = Array.isArray(g.extrapolated) ? g.extrapolated : [], ass = Array.isArray(g.assumed) ? g.assumed : [];
    const notes = Array.isArray(g.notes) ? g.notes : [];
    setBody(c,
      list(`Calibrated on NASA data (${cal.length})`, cal, 'cal'),
      list(`Extrapolated, not validated (${ext.length})`, ext, 'ext'),
      list(`Assumed, no data (${ass.length + 1})`, ass, 'ass', shape),
      notes.length ? list('Notes from the run', notes, 'notes') : null,
      g.limits ? h('p', { class: 'as-note' }, g.limits) : null);
  };
  if (result) c.update(result);
  return c;
}

// ---------------------------------------------------------------- 6. risk
const LEVELS = ['Low', 'Elevated', 'High'];
const valuesText = v => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(x => (typeof x === 'object' ? valuesText(x) : String(x))).join('; ');
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k} = ${isNum(x) ? n4(x) : (x == null ? 'n/a' : (typeof x === 'object' ? JSON.stringify(x) : String(x)))}`).join('; ');
  return String(v);
};

/** "Risk: the parts and the rule that fired": the parts first, then the level, the rule that fired and every rule. */
export function riskCard(result, rules) {
  const c = card(TITLES.risk, 'team', 'The parts behind the level are shown first. Written team rules turn them into Low, Elevated or High.', body('as-risk'));
  c.update = (r, state) => {
    if (!r) return;
    const risk = r.risk || null, d = r.detection || {}, g = r.kind === 'growth' ? r.growth : null, sm = g?.summary || {};
    const approved = risk?.approved ?? rules?.approved === true;
    const mx = sumRange(sm, 'max_area_cm2'), tm = sumRange(sm, 't_max_s');
    const fuel = state?.fuel || {};
    const cab = d.cabin || null, lbm = d.lbm || null;
    const sk = Array.isArray(d.smoke_s) ? d.smoke_s : [];
    const parts = [
      ['Largest burning area', g ? `${n4(sm.mid?.max_area_cm2)} cm² (middle run)${mx ? `, range ${n4(mx[0])}–${n4(mx[1])} cm²` : ''}` : 'Not computed for these inputs'],
      ['Time to the largest area', g ? `${n4(sm.mid?.t_max_s)} s (middle run)${tm ? `, range ${n4(tm[0])}–${n4(tm[1])} s` : ''}` : 'Not computed for these inputs'],
      ['Radiometer alarm, Saffire-III burns*', isNum(d.radiometer_s) ? `${plain(d.radiometer_s)} s after ignition` : 'n/a (data/saffire_latency.json)'],
      ['Cabin smoke detector, Saffire-III burns*', sk.length && sk.every(isNum) ? `${plain(sk[0])} to ${plain(sk[1])} s after ignition` : 'n/a (data/saffire_latency.json)'],
      ['Obscuration channel, Saffire-III burns*', d.obscuration === 'never' ? 'never alarmed' : isNum(d.obscuration) ? `${plain(d.obscuration)} s after ignition` : 'n/a'],
      ['Smoke model, cabin what-if runs', cab ? `layout "${cab.layout}": caught within 60 s ${share(cab.caught_60)}, 120 s ${share(cab.caught_120)}${shareRange(cab.range120) ? ` (range ${shareRange(cab.range120)})` : ''}, 300 s ${share(cab.caught_300)}` : 'n/a (data/whatif.json)'],
      ['Smoke model, lattice-Boltzmann runs', lbm ? `layout "${lbm.layout}": caught within 60 s ${share(lbm.caught_60)}${shareRange(lbm.range60) ? ` (range ${shareRange(lbm.range60)})` : ''}, 180 s ${share(lbm.caught_180)}${shareRange(lbm.range180) ? ` (range ${shareRange(lbm.range180)})` : ''}` : 'n/a (data/drift_whatif.json)'],
      ['Fuel', fuel.material ? `${fuel.material}, ${plain(fuel.thickness_mm)} mm thick, ${fuel.sides_burning === 1 ? 'one side' : 'both sides'} burning` : 'n/a'],
      ['Spread verdict', g ? (g.verdict?.label || 'n/a') : r.kind === 'droplet' ? 'droplet: handled by M7' : r.kind === 'unsupported' ? 'not supported' : 'n/a'],
    ];
    const level = risk?.level;
    const evaluated = Array.isArray(risk?.evaluated) ? risk.evaluated : [];
    setBody(c,
      approved ? null : h('p', { class: 'as-banner', role: 'note' }, h('b', {}, 'Rules are a team choice, to be approved.'), ' They are not a NASA rule.'),
      h('div', { class: 'as-parts' }, h('h3', {}, 'The parts'), h('dl', { class: 'kv' }, parts.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
      h('p', { class: 'as-note' }, '* Times after ignition on NASA\'s Saffire-III burns, a different fire, shown for scale and not as a prediction for this one. The detection shares are smoke-drift model runs, not NASA data.'),
      isMissing(rules) ? empty('No risk rules yet', 'risk_rules', 'The level needs the team\'s written rules.', '{status:"team", approved:false, default:{level, reason}, rules:[{id, level, test, reason}]}') : null,
      risk ? h('div', { class: 'as-levelbox', 'data-level': level },
        h('p', { class: 'as-level' }, 'Risk level: ', h('b', {}, level || 'none given'),
          h('span', { class: 'as-scale', 'aria-hidden': 'true' }, LEVELS.map(l => h('i', { class: l === level ? 'on' : null }, l)))),
        h('p', {}, h('b', {}, `Rule that fired: ${risk.fired?.id || 'none'}${risk.fired?.label ? ` (${risk.fired.label})` : ''}. `), risk.fired?.reason || '')) : null,
      evaluated.length ? table(['Rule', 'Level if it matches', 'Result', 'Tests', 'Reason'],
        evaluated.map(e => [`${e.id}${e.label ? ': ' + e.label : ''}`, e.level || 'no level',
          e.fired ? h('b', {}, e.matched ? 'Matched: fired' : 'Fired') : e.matched === true ? 'Matched (an earlier rule fired)' : e.matched === null ? 'Could not be checked' : 'Did not match',
          Array.isArray(e.tests) && e.tests.length ? e.tests.join('; ') : valuesText(e.values), e.reason || '']),
        { caption: 'Every rule, checked in file order (the first match fires)' }) : null);
  };
  if (result) c.update(result);
  return c;
}
