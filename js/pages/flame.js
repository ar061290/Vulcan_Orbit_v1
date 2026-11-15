// Flame lab (#/flame): "A flame without gravity" (site/REBUILD_PLAN.md §3.8, package P5-A).
// Order (keep 1): 1 Flame simulator, then folded: 2 Droplet burning rate vs NASA FLEX, 3 How fast flame crosses a solid,
// 4 Where a flame can survive (with the hidden-risk band), 5 A fire growing across a sample, 6 Every check on the flame
// model, 7 Limits.
// "Show Moon and Mars (model only)" is off by default. Figures 1, 3 and 4 each carry a copy of the switch (so it can be
// reached inside the fold), and every copy and the Limits line are kept in step here. This page is the only place on
// the site where Moon or Mars values appear.
import { h, load, page, card, empty, isMissing, announce } from '../lib.js';
import { flameSimCard } from '../flame_sim.js';
import { flexKCard, spreadCurvesCard, survivalMapCard, frontsCard, flameChecksCard, flameLimitsCard } from '../fig_flame.js';

// The switch survives a theme or motion re-render (the module stays loaded); a fresh page load starts with it off.
let showMM = false;

const LEAD = 'On Earth a flame is a flickering teardrop because hot gas rises. In orbit nothing rises, so the same flame becomes a sphere fed only by slow diffusion. This page runs our reduced-order flame model and shows every check against NASA data.';

function simMissing() {
  return card('Flame simulator', 'missing', null,
    empty('Waiting for the flame model', 'flame_static', 'Run python models/flame-sim/build.py',
      '{ "status": "model", "gravity_note", "flames": [{ "fuel", "gravity", "gravity_label", "X_O2", "P_kPa", "flow_m_s", "source", "T_flame_K", "grid": { "x_mm", "z_mm", "T_K" }, "contour_mm" }] }'));
}

export default async function render(root, ctx = {}) {
  const [fs, sp, gaps] = await Promise.all([load('flame_static'), load('flame_spread'), load('gaps')]);
  const linked = [];
  const setAll = v => {
    showMM = !!v;
    for (const c of linked) c.setShowMM?.(showMM);
    if (!ctx.detached) announce(showMM
      ? 'Moon and Mars shown, model only, in the simulator, the spread curves and the survival map.'
      : 'Moon and Mars hidden. Only orbit and Earth gravity are shown.');
  };
  const o = { showMM, onShowMM: setAll };
  const keep = el => { if (typeof el?.setShowMM === 'function') linked.push(el); return el; };

  const sim = isMissing(fs) || !Array.isArray(fs.flames) || !fs.flames.length ? simMissing() : keep(flameSimCard(fs, gaps, ctx, o));
  root.append(page('A flame without gravity', LEAD,
    sim,
    h('div', { class: 'grid g2' }, flexKCard(fs), keep(spreadCurvesCard(sp, o))),
    h('div', { class: 'grid g2' }, keep(survivalMapCard(sp, o)), frontsCard(sp)),
    flameChecksCard(fs, sp),
    keep(flameLimitsCard(fs, sp, o))));
}

/** "The short answer": main's summaries.js lines; line 3 reworded for the Moon and Mars switch (§3.8). */
export async function short() {
  const [fs, sp] = await Promise.all([load('flame_static'), load('flame_spread')]);
  const out = [];
  out.push(isMissing(fs)
    ? 'The flame simulator is not available yet (data/flame_static.json missing).'
    : 'Pick a fuel and switch gravity off: the tall yellow flame becomes a small, dim, blue sphere.');
  out.push(isMissing(fs) && isMissing(sp)
    ? 'The flame model checks are not available yet (data/flame_static.json and data/flame_spread.json missing).'
    : 'This is a simplified physics model. It matches some NASA measurements and misses others; every check is listed below the simulator.');
  out.push('NASA has no fire data at Moon or Mars gravity, so those settings stay hidden unless you switch on "Show Moon and Mars (model only)", and then they come from the model alone.');
  return out;
}
