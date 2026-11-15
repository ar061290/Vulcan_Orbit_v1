// #/assess "How bad will it get?" (site/REBUILD_PLAN.md §3.5; spec C2, C3). Package P3-B.
// One screen for the pipeline: the flame now, the fuel and the cabin (or a camera reading) go into the M6b growth port
// (js/growth.js via js/assess_core.js), and the page shows the verdict, the burning area over time, the calibrated /
// extrapolated / assumed lists and the risk parts with the team rule that fired. Every figure is in js/fig_assess.js.
//
// Lifecycle (§0 rule 6): render() builds every card shell with its title before any computation. The growth run, the
// store subscription and the URL mirror start in ctx.onMount and stop in ctx.onLeave. A detached render (the Sources
// site map) runs nothing: it shows the titles and a one-line note.
// Live region (D5.9): one announce() when the verdict or the risk level changes, never per slider step.
import { h, page, announce, isMissing, sig } from '../lib.js';
import { loadAssessData, computeAssessment } from '../assess_core.js';
import { stopGrowth } from '../growth_run.js';
import { setField } from '../field.js';
import { inputsCard, cameraCard, verdictCard, outputsCard, listsCard, riskCard, setBusy, idle } from '../fig_assess.js';

const LEAD = 'Set a flame on a piece of fuel and the cabin air around it. The spread predictor, calibrated on NASA\'s orbital burns, runs in your browser and shows whether the flame spreads, how big it gets, when it stops, and how that compares with when NASA\'s sensors alarmed. Values outside NASA\'s tested range are flagged, never hidden.';
const WAIT = 'Running the growth model for the inputs below…';

// Query keys the store writes (js/store.js QUERY_KEYS); any of them in the link means the visitor arrived with inputs.
const hasInputQuery = (params, keys) => Object.keys(params || {}).some(k => keys.includes(k));

export default async function render(root, ctx = {}) {
  const store = ctx.store;
  const data = await loadAssessData();
  // Both Assess and Put it out start the store from the URL; idempotent (§3.5). Never on a detached render.
  if (!ctx.detached && store?.initFromURL && !isMissing(data.examples)) store.initFromURL(ctx.params || {}, data.examples);

  const cInputs = inputsCard(store, data, ctx);
  const cCamera = cameraCard(store, data);
  const cVerdict = verdictCard(null, data);
  const cCurve = outputsCard(null);
  const cLists = listsCard(null);
  const cRisk = riskCard(null, data.rules);
  const live = [cVerdict, cCurve, cLists, cRisk];

  const toRespond = h('a', { href: '#/respond', class: 'btn' }, 'Take this to Put it out');
  const respondWhy = h('small', {}, 'The response evidence card on Put it out reads the same inputs, so the link carries them.');
  cRisk.append(h('p', { class: 'as-next' }, toRespond, ' ', respondWhy));

  // One app screen (v3 layout, UI-lock instruments). Wide (>= 1100 px): inputs | cabin plate, stat tiles and curve |
  // sticky risk rail. Tablet: inputs | (centre, then the rail). Phones: one column plus a mini bar pinned to the bottom.
  // Left = how the fire starts (camera, then the dials and presets); centre = the cabin plate (UI lock: drag the start
  // point, rings from the growth run) and the burning area over time; right = the risk level, the verdict and the
  // limits of the run. The DOM order is the keyboard order: inputs -> plate and chart -> risk.
  // Figures are found by title (figLink slugs), so their numbers follow this order.
  const col = (cls, label, ...kids) => h('div', { class: `as-col ${cls}`, role: 'region', 'aria-label': label }, ...kids);
  const plateWrap = cInputs.plate ? h('div', { class: 'as-plate-wrap' }, cInputs.plate) : null;
  const miniLevel = h('b', { class: 'as-mini-level' }, '…'), miniArea = h('b', { class: 'as-mini-area' }, '…');
  // phones: a bar pinned to the bottom repeats the two headline values. It is a visual copy of the rail and the curve
  // (both stay in the page for screen readers), so it is hidden from assistive technology and never takes focus.
  const mini = h('div', { class: 'as-mini', 'aria-hidden': 'true' },
    h('span', {}, h('small', {}, 'Risk'), miniLevel), h('span', {}, h('small', {}, 'Largest area (mid)'), miniArea));
  const pg = page('How bad will it get?', LEAD,
    h('div', { class: 'as-app' },
      col('as-col-in', 'Inputs: camera, flame, fuel and cabin', cCamera, cInputs),
      col('as-col-main', 'Result: cabin plate and burning area over time', plateWrap, cCurve),
      col('as-rail', 'Risk level, verdict and limits', cRisk, cVerdict, cLists)),
    ctx.detached || !store ? null : mini);
  root.append(pg);
  const setMini = r => {
    const lvl = r?.risk?.level || null;
    miniLevel.textContent = lvl || 'none'; mini.dataset.level = lvl || '';
    const a = r?.kind === 'growth' ? r.growth?.summary?.mid?.max_area_cm2 : null;
    miniArea.textContent = typeof a === 'number' && Number.isFinite(a) ? `${sig(a, 4)} cm²` : 'n/a';
  };
  // a column gets a tab stop only while it really scrolls on its own (wide screens; WCAG 2.1.1)
  const scrollStops = () => pg.querySelectorAll('.as-col').forEach(c => {
    if (c.scrollHeight > c.clientHeight + 2 && getComputedStyle(c).overflowY !== 'visible') c.tabIndex = 0; else c.removeAttribute('tabindex');
  });

  if (ctx.detached || !store) {
    idle(live, store ? 'Open this page to run the growth model on these inputs.' : 'The Assess store is not available, so nothing was run.');
    return;
  }

  let seq = 0, running = false, queued = false, left = false, first = true, unsub = null, io = null, ro = null;
  let lastVerdict = null, lastLevel = null;

  const shortList = () => pg.querySelector('.short ol');
  const showShort = lines => {
    const ol = shortList(); if (!ol || !Array.isArray(lines) || !lines.length) return;
    ol.replaceChildren(...lines.filter(Boolean).map(t => h('li', {}, t)));
  };
  const setLink = () => { const q = store.toQuery(store.get()); toRespond.setAttribute('href', `#/respond${q ? '?' + q : ''}`); };

  async function run() {
    if (left) return;
    if (running) { queued = true; return; }
    running = true; queued = false;
    const my = ++seq, state = store.get();
    setBusy(live, true);
    let r;
    try { r = await computeAssessment(state, data); }
    catch (e) {
      if (e && e.name === 'AbortError') { running = false; return; }
      console.error(e);
      r = { kind: 'invalid', error: e?.message || String(e), errors: [e?.message || String(e)], boxes: [], detection: {}, risk: null, sentences: [] };
    }
    running = false;
    if (left) return;
    if (queued) { run(); return; }          // the inputs changed while this ran: show only the newest result
    if (my !== seq) return;
    cInputs.update(r);
    cVerdict.update(r);
    cCurve.update(r);
    cLists.update(r, state);
    cRisk.update(r, state);
    setBusy(live, false);
    setMini(r); scrollStops();
    showShort(r.sentences);
    const verdict = r.kind === 'growth' ? (r.growth?.verdict?.label ?? null) : r.kind;
    const level = r.risk?.level ?? null;
    if (!first && (verdict !== lastVerdict || level !== lastLevel)) {
      const vText = r.kind === 'growth' ? `Verdict: ${verdict}.` : r.kind === 'droplet' ? 'Droplet flame: no growth number, see the M7 pointer.'
        : r.kind === 'unsupported' ? 'Material not supported.' : 'These inputs cannot be run.';
      announce(`${vText} Risk level: ${level || 'none'}.`);
    }
    first = false; lastVerdict = verdict; lastLevel = level;
  }

  ctx.onMount?.(() => {
    if (left) return;
    // The field's Assess station already looks down (pitch 1.45); settle it fully top-down over the cabin plate.
    // Illustration only; the router clears this override on the next route change.
    setField({ pitch: 1.53, dist: 5.2 });
    // A fresh visit (no inputs in the link) takes the latest camera reading when the camera owner has published one.
    if (!isMissing(data.cv) && !hasInputQuery(ctx.params, store.QUERY_KEYS || [])) cCamera.apply?.(data.cv, 'camera', 'The latest camera reading');
    cInputs.sync(store.get());
    store.set({});                            // mirror the current inputs to the URL, so the address is a working link
    setLink();
    unsub = store.subscribe(st => { cInputs.sync(st); setLink(); run(); });
    run();
    // the mini bar steps aside while the risk card it copies is on screen (no duplicate in view), and while the
    // phone keyboard is up (css: hidden when a text field inside the page has focus)
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(es => { for (const e of es) mini.classList.toggle('is-off', e.isIntersecting); }, { threshold: 0 });
      io.observe(cRisk);
    }
    // a column starts or stops scrolling when the window resizes (the app surface resizes) or a fold inside it opens
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => scrollStops()); ro.observe(pg.querySelector('.as-app')); }
    pg.addEventListener('toggle', scrollStops, true);
    scrollStops();
  });
  ctx.onLeave?.(() => {
    left = true;
    unsub?.(); unsub = null;
    io?.disconnect(); io = null; ro?.disconnect(); ro = null;
    pg.removeEventListener('toggle', scrollStops, true);
    stopGrowth();                             // a run still waiting rejects with AbortError and is dropped
  });
}

/** "The short answer". It is filled in by render() once the first growth run ends (the run starts in onMount, after the
 *  passes), and refreshed on every new result. A detached render runs no model, so it has no short answer. */
export async function short(ctx = {}) {
  if (ctx.detached) return null;
  return [WAIT];
}

