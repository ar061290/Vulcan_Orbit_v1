// "Response evidence for this fire" (spec C4, plan item #18, FlameAtlas-style evidence lines): the card on Put it out
// that reads the shared Assess store and lists, for that one fire,
//   1. what NASA's FLEX droplet tests show about added gases (flex_suppression),
//   2. the M7 model's oxygen at a 50% chance of the flame going out, per added gas (m7_explorer),
//   3. whether NASA saw the flame go out at low airflow near these conditions (M6b verdict and its matched cases),
//   4. what is untested (the nearest gaps.json atmosphere, with a gap flag when NASA ran no test there),
//   5. the urgency from the risk rules (C3).
// Every line carries its own status stamp and a gap flag. Nothing here is a flight procedure, and the card says so.
// Frozen interface (site/REBUILD_PLAN.md §2.12): responseEvidenceCard(data, store, ctx) → section.card.
//   data  = assess_core.loadAssessData() result {sp, examples, rules, gaps, m7, flex, …} (loaded here if not given)
//   store = js/store.js (ctx.store if not given)
//   ctx   = the page context; growth runs and the store subscription start in ctx.onMount and stop in ctx.onLeave.
// Every number on the card is read from a data file or computed by js/growth.js through assess_core.computeAssessment.
import { h, add, card, badge, empty, fmt, isMissing, seg, announce, slug } from './lib.js';
import { computeAssessment, loadAssessData, nearestProbe } from './assess_core.js';
import { sentences } from './overlays.js';

export const TITLE = 'Response evidence for this fire';
const SUB = 'What NASA data supports, what is untested and how urgent it is, for the fire set on Assess.';
export const DISCLAIMER = 'A summary of evidence, not a flight procedure.';

// source: 1 atm = 101.325 kPa (the standard atmosphere, exact by definition). gaps.json gives pressure in kPa and the
// Assess store in atm; the plan's Assess slider bounds (REBUILD_PLAN §3.5) use the same factor.
const KPA_PER_ATM = 101.325;
// gaps.json counts tests by fuel kind; these are its own keys (gaps.probes[i].counts).
const KIND = { surface: 'solids', droplet: 'liquid droplets' };
const KIND_TXT = { solids: 'solid-fuel', 'liquid droplets': 'droplet', 'gas flames': 'gas-flame' };
// Figure titles this card links to (each one is a MADE key; links go by slug so they open the fold that holds them).
const FIG = {
  risk: ['assess', 'Risk: the parts and the rule that fired'],
  verdict: ['assess', 'Will it spread here?'],
  flex: ['respond', 'NASA: which gas puts a droplet flame out'],
  m7: ['respond', 'When does a droplet flame go out?'],
  gaps: ['predict', 'What NASA has not tested'],
};
const FABRICS = new Set(['SIBAL', 'cotton']);   // cotton reuses the SIBAL cases, as js/growth.js does (predictor.py)

const num = v => (v == null || v === '' ? NaN : Number(v));
const isF = v => Number.isFinite(num(v));
const p1 = x => (100 * x).toFixed(1) + '%';                 // m7_explorer fractions → "19.5%" (main's respond_ui format)
const share = (k, n) => `${Math.round((100 * k) / n)}%`;    // main's FLEX bar value: Math.round(extinguished/tests*100)

/** One evidence line: heading with its own stamp, then its gap flag, then the body. */
const line = (key, title, status, flagEl, ...body) =>
  h('div', { class: 'resp-line', 'data-line': key },
    h('h3', { class: 'resp-line-h' }, h('span', {}, title), badge(status || 'missing')),
    flagEl, ...body);

/** Gap flag: a word and a shape as well as a colour (D5.12). gap=null means "not applicable". */
function flag(gap, text) {
  const cls = gap ? 'gap' : 'ok';
  return h('p', { class: `resp-flag ${cls}`, 'data-gap': gap ? 'true' : 'false' },
    h('span', { class: 'resp-flag-mark', 'aria-hidden': 'true' }, gap ? '▲' : '●'),
    h('b', {}, gap ? 'Gap: ' : 'Covered: '), text);
}

function link(store, inputs, [pageId, title], text) {
  let q = '';
  try { q = (pageId === 'assess' || pageId === 'respond') ? store.toQuery(inputs) : ''; } catch { q = ''; }
  return h('a', { href: `#/${pageId}?${q ? q + '&' : ''}fig=${slug(title)}` }, text);
}

const inRange = (v, [lo, hi] = []) => isF(v) && isF(lo) && isF(hi) && v >= lo && v <= hi;
const flexTested = gaps => (gaps?.tested || []).find(t => /\bFLEX\b/.test(t.inv || '') && t.kind === KIND.droplet) || null;

// ---------------------------------------------------------------------------------------------------------------------
// The fire as set on Assess, in one sentence, plus the link back.
function fireLine(inputs, store, examples) {
  const f = inputs.flame || {}, fu = inputs.fuel || {}, c = inputs.conditions || {};
  const kpa = isF(c.pressure_atm) ? c.pressure_atm * KPA_PER_ATM : null;
  const what = f.flame_type === 'droplet'
    ? `A fuel droplet flame${f.droplet && isF(f.droplet.diameter_mm) ? ` (${fmt(f.droplet.diameter_mm, 2)} mm droplet)` : ''}`
    : `A surface fire on ${fu.material || 'an unknown material'}${isF(f.area_cm2) ? `, ${fmt(f.area_cm2, 2)} cm² burning now` : ''}`;
  const air = [
    isF(c.flow_cm_s) ? `airflow ${fmt(c.flow_cm_s, 2)} cm/s` : null,
    isF(c.o2_vol_pct) ? `${fmt(c.o2_vol_pct, 2)}% O₂` : null,
    isF(c.pressure_atm) ? `${fmt(c.pressure_atm, 3)} atm (${fmt(kpa, 1)} kPa)` : null,
  ].filter(Boolean).join(', ');
  return h('p', { class: 'resp-fire' },
    h('b', {}, 'This fire: '), `${what}${air ? `; cabin ${air}` : ''}. `,
    inputs.preset ? h('span', { class: 'resp-preset' }, `Starts from the worked example "${presetTitle(examples, inputs.preset)}". `) : null,
    link(store, inputs, FIG.verdict, 'Change it on Assess'));
}

const presetTitle = (ex, id) => ((Array.isArray(ex?.examples) ? ex.examples : []).find(e => e.id === id)?.title || id);

// 1. FLEX: which added gas put NASA's droplet flames out ------------------------------------------------------------
function flexLine(flex, gaps, inputs, store) {
  const title = 'NASA droplet tests: which added gas put the flame out (FLEX)';
  if (isMissing(flex) || !Array.isArray(flex.groups)) {
    return line('flex', title, 'missing', flag(true, 'No FLEX table, so nothing to compare.'),
      empty('No FLEX table yet', 'flex_suppression', 'Counts per added gas from the FLEX summary table.'));
  }
  const c = inputs.conditions || {}, droplet = inputs.flame?.flame_type === 'droplet';
  const t = flexTested(gaps), kpa = isF(c.pressure_atm) ? c.pressure_atm * KPA_PER_ATM : null;
  let fl;
  if (!droplet) fl = flag(true, `FLEX burned fuel droplets, not ${inputs.fuel?.material || 'this material'}. Context only for this fire.`);
  else if (!t) fl = flag(true, 'The FLEX tested range is not in data/gaps.json, so this cabin cannot be checked against it.');
  else {
    const inside = inRange(c.o2_vol_pct, t.o2) && inRange(kpa, t.kpa);
    fl = flag(!inside, `${inside ? 'This cabin is inside' : 'This cabin is outside'} the range FLEX tested: O₂ ${fmt(t.o2[0])}–${fmt(t.o2[1])}%, ${fmt(t.kpa[0])}–${fmt(t.kpa[1])} kPa (${t.inv}).`);
  }
  const label = g => (String(g.gas).split(' ')[0] === 'None' ? 'Nitrogen only, no added suppressant' : `Added ${g.gas}`);
  const caveat = sentences(flex.source || '').find(s => /controlled comparison/i.test(s));
  return line('flex', title, flex.status, fl,
    h('ul', { class: 'resp-list' }, flex.groups.map(g => h('li', {},
      h('b', {}, label(g)), ': ', `${g.extinguished} of ${g.tests} tests ended in extinction`,
      isF(g.tests) && g.tests > 0 ? ` (${share(g.extinguished, g.tests)})` : null))),
    caveat ? h('p', { class: 'resp-quote' }, h('q', {}, caveat.trim()), ' (', h('cite', {}, 'flex_suppression.json'), ')') : null,
    h('p', { class: 'resp-more' }, link(store, inputs, FIG.flex, 'See the FLEX chart on this page')));
}

// 2. M7: oxygen at a 50% chance the droplet flame goes out --------------------------------------------------------
function m7Line(m7, gaps, inputs, store) {
  const title = 'Model: oxygen at which a droplet flame has a 50% chance of going out (M7)';
  const tab = m7?.extinction?.table;
  if (isMissing(m7) || !Array.isArray(tab) || !tab.length) {
    return line('m7', title, 'missing', flag(true, 'No extinction model output, so nothing to compare.'),
      empty('No extinction model output yet', 'm7_explorer', 'Run the M7 explorer build to write the 50% oxygen points.'));
  }
  const c = inputs.conditions || {}, o2 = num(c.o2_vol_pct), p = num(c.pressure_atm);
  const droplet = inputs.flame?.flame_type === 'droplet';
  const ps = [...new Set(tab.map(r => r.p_atm).filter(isF))].sort((a, b) => a - b);
  const pNear = isF(p) ? ps.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a), ps[0]) : ps[ps.length - 1];
  const rows = tab.filter(r => r.p_atm === pNear);
  const insideP = isF(p) && p >= ps[0] && p <= ps[ps.length - 1];
  const t = flexTested(gaps);
  const insideO2 = t ? inRange(o2, t.o2) : false;
  let fl;
  if (!droplet) fl = flag(true, `A droplet model. Context only for a ${inputs.fuel?.material ? inputs.fuel.material + ' ' : ''}surface fire.`);
  else if (!insideP) fl = flag(true, `The model table holds ${ps.map(x => fmt(x, 2) + ' atm').join(' and ')}; this cabin's ${fmt(p, 3)} atm is outside that span, so the ${fmt(pNear, 2)} atm rows are the nearest, not a match.`);
  else if (t && !insideO2) fl = flag(true, `This cabin's ${fmt(o2, 2)}% O₂ is outside the O₂ range of the FLEX burns the model learned from (${fmt(t.o2[0])}–${fmt(t.o2[1])}%).`);
  else fl = flag(false, `This cabin's pressure is inside the span of the model table (${ps.map(x => fmt(x, 2)).join(' to ')} atm); the rows shown are for ${fmt(pNear, 2)} atm, the nearest.`);
  const versus = r => {
    const [lo, hi] = r.o2_half_range || [];
    if (!isF(o2) || !isF(lo) || !isF(hi)) return 'n/a';
    const x = o2 / 100;
    if (x < lo) return 'below the range: the model gives more than a 50% chance of going out';
    if (x > hi) return 'above the range: the model gives less than a 50% chance of going out';
    return 'inside the range: too close to call';
  };
  const gasName = g => (g === 'no added gas' ? 'No added gas' : `${g} for N₂`);   // main's row label
  const ex = m7.extinction;
  return line('m7', title, m7.status, fl,
    h('div', { class: 'scroll resp-table', tabindex: '0', role: 'region', 'aria-label': 'M7 model table' }, h('table', {},
      h('caption', {}, `M7 model, ${fmt(pNear, 2)} atm: oxygen at a 50% chance the flame goes out, with its 95% range`),
      h('thead', {}, h('tr', {}, ['Fuel', 'Added gas', 'O₂ at 50% chance [95% range]', `This cabin's ${isF(o2) ? fmt(o2, 2) + '%' : ''} O₂ is`].map(x => h('th', { scope: 'col' }, x)))),
      h('tbody', {}, rows.map(r => h('tr', {},
        h('td', {}, r.fuel), h('td', {}, gasName(r.added_gas)),
        h('td', { class: 'num' }, isF(r.o2_half) ? `${p1(r.o2_half)}${Array.isArray(r.o2_half_range) && r.o2_half_range.every(isF) ? ` [${p1(r.o2_half_range[0])}–${p1(r.o2_half_range[1])}]` : ''}` : 'n/a'),
        h('td', {}, versus(r))))))),
    ex?.note ? h('p', { class: 'resp-note' }, ex.note,
      ex.headline && isF(ex.headline.auc_median) ? ` Score on held-out test days: AUC ${ex.headline.auc_median.toFixed(2)}${Array.isArray(ex.headline.auc_session_bootstrap_95) ? ` (${ex.headline.auc_session_bootstrap_95[0].toFixed(2)}–${ex.headline.auc_session_bootstrap_95[1].toFixed(2)})` : ''}.` : null) : null,
    h('p', { class: 'resp-more' }, link(store, inputs, FIG.m7, 'See the extinction chart on this page')));
}

// 3. Flames going out at low airflow: the M6b verdict and the NASA cases it matched --------------------------------
function verdictLine(sp, res, inputs, store) {
  const title = 'Did NASA see the flame go out near these conditions? (M6b verdict)';
  if (isMissing(sp) || !sp.constants?.verdict) {
    return line('verdict', title, 'missing', flag(true, 'No spread predictor, so no verdict.'),
      empty('No spread predictor yet', 'spread_predictor', 'Run python models/m6b-predictor/build.py to write the verdict boxes and constants.'));
  }
  if (res.kind === 'droplet') {
    return line('verdict', title, sp.status, flag(true, 'The M6b verdict covers solid fuels only; a droplet fire has none. The M7 lines above are the evidence for droplets.'),
      res.pointer?.note ? h('p', { class: 'resp-note' }, res.pointer.note) : null);
  }
  if (res.kind !== 'growth' || !res.growth?.verdict) {
    return line('verdict', title, sp.status, flag(true, 'No verdict for this input.'),
      h('p', {}, res.error || 'The growth model could not run on these inputs.'));
  }
  const v = res.growth.verdict;
  const out = (res.boxes || []).filter(b => b && b.inside === false);
  const fl = out.length
    ? flag(true, `Outside the calibration box: ${out.map(b => `${b.label || b.field} ${fmt(b.value, 3)} (box ${fmt(b.lo, 3)}–${fmt(b.hi, 3)})`).join('; ')}. The verdict boxes still apply, but the spread rates are extrapolated.`)
    : (res.boxes || []).length ? flag(false, 'Every input checked is inside the calibration box of the spread model.')
      : flag(true, 'No calibration-box check was returned for these inputs.');
  const cases = sp.constants.verdict.cases || [];
  const byId = new Map(cases.map(c => [c.case_id, c]));
  const dir = Object.entries(v.by_direction || {}).map(([d, l]) => `${d === 'opposed' ? 'upwind (opposed)' : d === 'concurrent' ? 'downwind (concurrent)' : d}: ${l}`).join('; ');
  const caseRow = (m, c) => [m.case_id, badge(m.status || c?.status || 'missing'), m.level || '', m.outcome || c?.outcome || '',
    m.flow_direction || c?.flow_direction || '', c ? rangeTxt(c.flow_lo_cm_s, c.flow_hi_cm_s) : 'n/a', c ? rangeTxt(c.o2_lo_vol_pct, c.o2_hi_vol_pct) : 'n/a',
    c?.record_as_written || ''];
  const HEAD = ['Case', 'Stamp', 'Match', 'Outcome', 'Flow direction', 'Airflow, cm/s', 'O₂, %', 'Record as written'];
  const matched = v.matched_cases || [];
  const mat = inputs.fuel?.material, matKey = FABRICS.has(mat) ? 'SIBAL' : mat;
  const own = cases.filter(c => c.material === matKey).sort((a, b) => num(a.flow_lo_cm_s) - num(b.flow_lo_cm_s));
  return line('verdict', title, sp.status, fl,
    h('p', { class: 'resp-verdict' }, h('b', {}, 'Verdict: '), h('span', { class: 'resp-vlabel', 'data-code': String(v.code) }, v.label), dir ? ` (${dir})` : null),
    matched.length
      ? [h('p', {}, `${matched.length} recorded NASA ${matched.length === 1 ? 'case is' : 'cases are'} near these conditions. Each keeps its own stamp.`),
        tbl(HEAD, matched.map(m => caseRow(m, byId.get(m.case_id))), 'NASA cases the verdict matched')]
      : h('p', {}, '"spreads" only means that no recorded NASA case where the flame went out or would not spread is near these conditions. It is not a measurement of this fire.'),
    own.length ? h('details', { class: 'fold' },
      h('summary', {}, `Every recorded case for ${matKey}${mat !== matKey ? ` (used for ${mat})` : ''} where the flame went out or would not spread (${own.length}), lowest airflow first`),
      tbl(HEAD, own.map(c => caseRow({ case_id: c.case_id, status: c.status, level: matched.find(m => m.case_id === c.case_id)?.level || 'not near', outcome: c.outcome, flow_direction: c.flow_direction }, c)),
        `Recorded ${matKey} cases, sorted by airflow`)) : null,
    h('p', { class: 'resp-more' }, link(store, inputs, FIG.verdict, 'See the verdict on Assess')));
}
const rangeTxt = (lo, hi) => (isF(lo) && isF(hi) ? (num(lo) === num(hi) ? fmt(lo, 3) : `${fmt(lo, 3)}–${fmt(hi, 3)}`) : 'n/a');
function tbl(headers, rows, caption) {
  // this card re-renders after the page passes ran, so it makes its own scroll region keyboard-reachable (axe, v3)
  return h('div', { class: 'scroll resp-table', tabindex: '0', role: 'region', 'aria-label': caption }, h('table', {},
    h('caption', {}, caption),
    h('thead', {}, h('tr', {}, headers.map(x => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, rows.map(r => h('tr', {}, r.map(c => h('td', {}, c)))))));
}

// 4. What is untested: the nearest atmosphere listed in gaps.json ---------------------------------------------------
function gapsLine(gaps, inputs, store) {
  const title = 'What NASA has not tested near this cabin';
  if (isMissing(gaps) || !Array.isArray(gaps.probes) || !gaps.probes.length) {
    return line('gaps', title, 'missing', flag(true, 'No coverage table, so the gap cannot be checked.'),
      empty('No coverage table yet', 'gaps', 'Run python scripts/build_gaps.py to count the NASA tests near each atmosphere.'));
  }
  const c = inputs.conditions || {}, o2 = num(c.o2_vol_pct), kpa = isF(c.pressure_atm) ? c.pressure_atm * KPA_PER_ATM : NaN;
  const kind = KIND[inputs.flame?.flame_type] || KIND.surface;
  let pr = null;
  try { pr = nearestProbe(gaps, o2, kpa); } catch (e) { console.error(e); }
  if (!pr) {
    return line('gaps', title, gaps.status, flag(true, 'No listed atmosphere could be matched to this cabin.'),
      h('p', {}, 'The cabin needs an O₂ and a pressure to compare with the atmospheres in data/gaps.json.'));
  }
  const n = pr.counts?.[kind];
  const same = Math.abs(pr.o2 - o2) < 1e-9 && Math.abs(pr.kpa - kpa) < 1e-6;   // float round trip through atm only
  const kt = KIND_TXT[kind] || kind, where = same ? pr.atmosphere : `${pr.atmosphere}, the nearest listed atmosphere`;
  const win = pr.window && isF(pr.window.o2) && isF(pr.window.kpa) ? ` (${fmt(pr.window.o2)} O₂ points and ${fmt(pr.window.kpa)} kPa)` : '';
  const fl = !isF(n) ? flag(true, `The file has no ${kind} count for this atmosphere.`)
    : pr.within === false ? flag(true, `This cabin is outside the window${win} of every listed atmosphere, so no NASA test count covers it. The nearest, ${pr.atmosphere}, has ${n} ${kt} tests.`)
    : n === 0 ? flag(true, `NASA ran no ${kt} test near ${where}. Anything said about this fire there is an extrapolation.`)
      : flag(false, `${n} NASA ${kt} tests near ${where}.`);
  const say = (gaps.verdicts || []).filter(v => typeof v.text === 'string' &&
    (v.text.startsWith(pr.atmosphere) || (kind === KIND.surface && v.text.startsWith('Solid fuels'))));
  return line('gaps', title, gaps.status, fl,
    h('div', { class: 'resp-probe' },
      h('div', { class: 'statbox' }, h('span', { class: 'stat-label' }, `NASA ${kt} tests near ${pr.atmosphere}`),
        h('div', { class: 'stat' }, isF(n) ? String(n) : 'n/a', h('small', {}, n > 0 ? `tests within ${win ? `${fmt(pr.window.o2)} O₂ points, ${fmt(pr.window.kpa)} kPa` : 'the build_gaps.py window'}` : 'none: untested'))),
      h('p', {}, same
        ? `This cabin is the listed atmosphere "${pr.atmosphere}" (${fmt(pr.o2)}% O₂, ${fmt(pr.kpa)} kPa).`
        : `This cabin (${fmt(o2, 2)}% O₂, ${fmt(kpa, 1)} kPa) is not one of the listed atmospheres. The nearest is "${pr.atmosphere}" (${fmt(pr.o2)}% O₂, ${fmt(pr.kpa)} kPa); the count is for that atmosphere, not for this exact cabin.`)),
    say.length ? h('ul', { class: 'resp-list' }, say.map(v => h('li', {}, v.text, v.source ? h('small', {}, ` (${v.source})`) : null))) : null,
    h('p', { class: 'resp-more' }, link(store, inputs, FIG.gaps, 'See the map of what NASA has tested')));
}

// 5. Urgency: the level from the risk rules (C3) ------------------------------------------------------------------
function urgencyLine(rules, res, inputs, store) {
  const title = 'How urgent: the risk level from the rules';
  if (isMissing(rules)) {
    return line('risk', title, 'missing', flag(true, 'No risk rules, so no level.'),
      empty('No risk rules yet', 'risk_rules', 'The team\'s rules that turn size, timing, detection and verdict into Low, Elevated or High.'));
  }
  const r = res.risk;
  const ext = res.growth?.extrapolated || [];
  const lvl = r && r.level ? r.level : null;
  const fl = !lvl ? flag(true, 'No level for this input: the rules need a growth run of a solid fuel.')
    : ext.length ? flag(true, `The growth run behind the level used values outside the calibration box: ${ext.join('; ')}.`)
      : flag(false, res.kind === 'growth' ? 'The growth run behind the level has no extrapolated rates.' : 'The level does not rest on a growth run.');
  const approved = r ? r.approved === true : rules.approved === true;
  return line('risk', title, rules.status || 'team', fl,
    approved ? null : h('p', { class: 'resp-team' }, 'Rules are a team choice, to be approved.'),
    r ? [
      h('p', { class: 'resp-level-row' }, h('span', {}, 'Level: '), h('b', { class: 'resp-level', 'data-level': lvl || 'none' }, lvl || 'none given')),
      r.fired ? h('p', {}, h('b', {}, `Rule that fired (${[r.fired.id, r.fired.label].filter(Boolean).join(', ')}): `), r.fired.reason || '') : null,
      Array.isArray(r.evaluated) ? h('p', { class: 'resp-note' }, `${r.evaluated.length} ${r.evaluated.length === 1 ? 'rule was' : 'rules were'} checked in file order; the first match fires.`) : null,
    ] : h('p', {}, res.error || 'The risk rules need a growth run; this input has none.'),
    h('p', { class: 'resp-more' }, link(store, inputs, FIG.risk, 'See every rule and the parts behind the level on Assess')));
}

// ---------------------------------------------------------------------------------------------------------------------
/** Atmosphere chips (B6): the cabin as set on Assess, or one of the atmospheres listed in gaps.json. A chip changes the
 *  shared Assess inputs (O₂ and pressure only), so Assess shows the same cabin afterwards. */
function atmosphereChips(gaps, store, origin, onPick) {
  const probes = (gaps?.probes || []).filter(p => isF(p.o2) && isF(p.kpa));
  const o = origin.conditions || {};
  const opts = [['assess', `As set on Assess (${fmt(o.o2_vol_pct, 2)}% O₂, ${fmt(num(o.pressure_atm) * KPA_PER_ATM, 1)} kPa)`],
    ...probes.map((p, i) => [String(i), p.atmosphere])];
  const row = seg({ label: 'Cabin atmosphere', options: opts, value: 'assess', onChange: v => {
    const c = v === 'assess' ? { o2_vol_pct: o.o2_vol_pct, pressure_atm: o.pressure_atm }
      : { o2_vol_pct: probes[+v].o2, pressure_atm: probes[+v].kpa / KPA_PER_ATM };
    onPick(c);
  } });
  row.classList.add('resp-chips');
  row.pick = cond => {
    const kpa = num(cond?.pressure_atm) * KPA_PER_ATM;
    const i = probes.findIndex(p => Math.abs(p.o2 - num(cond?.o2_vol_pct)) < 1e-9 && Math.abs(p.kpa - kpa) < 1e-6);
    row.set(i >= 0 ? String(i) : 'assess');
  };
  return row;
}

/**
 * The response evidence card (C4). Returns the card at once with its title, sub and disclaimer (so a detached render,
 * such as the Sources site map, sees the title); the lines fill in after the assessment runs. Detached, nothing runs.
 */
export function responseEvidenceCard(data, store, ctx = {}) {
  store = store || ctx.store;
  const body = h('div', { class: 'resp-body', 'aria-busy': 'true' },
    h('p', { class: 'resp-wait' }, ctx.detached ? 'This card fills in for the fire set on Assess when the page is open.' : 'Working out the evidence for the fire set on Assess…'));
  const chipSlot = h('div', { class: 'resp-chipslot' });
  const el = card(TITLE, 'model', SUB,
    h('p', { class: 'resp-disclaimer' }, h('b', {}, DISCLAIMER)),
    chipSlot, body);
  el.classList.add('resp-card');
  if (ctx.detached || !store) {
    if (!store && !ctx.detached) add(body, h('p', {}, 'The shared Assess inputs are not available on this page.'));
    body.setAttribute('aria-busy', 'false');
    return el;
  }

  let d = data, seq = 0, origin = null, chips = null, last = null, unsub = null, alive = true;

  async function compute(fromUser) {
    const my = ++seq;
    if (!d) { try { d = await loadAssessData(); } catch (e) { console.error(e); d = {}; } }
    if (!alive || my !== seq) return;
    if (!store.initialised?.()) { try { store.initFromURL(ctx.params || {}, d.examples); } catch (e) { console.error(e); } }
    const inputs = store.get();
    if (!inputs.flame || !inputs.fuel || !inputs.conditions) {
      body.replaceChildren(empty('No fire set yet', 'growth_examples', 'The card starts from a worked example in growth_examples.json, or from the fire you set on Assess.'));
      body.setAttribute('aria-busy', 'false');
      return;
    }
    if (!origin) {
      origin = inputs;
      if (!isMissing(d.gaps) && Array.isArray(d.gaps?.probes)) {
        chips = atmosphereChips(d.gaps, store, origin, cond => store.set({ conditions: cond }));
        chipSlot.replaceChildren(chips, h('p', { class: 'resp-note' }, 'Picking an atmosphere here also changes the cabin on Assess.'));
      }
    }
    chips?.pick(inputs.conditions);
    body.setAttribute('aria-busy', 'true');
    let res;
    try { res = await computeAssessment(inputs, d); }
    catch (e) { console.error(e); res = { kind: 'invalid', error: String(e?.message || e), boxes: [] }; }
    if (!alive || my !== seq) return;
    res = res || { kind: 'invalid', boxes: [] };
    body.replaceChildren(
      fireLine(inputs, store, d.examples),
      h('h3', { class: 'resp-group' }, 'What NASA data supports'),
      flexLine(d.flex, d.gaps, inputs, store),
      m7Line(d.m7, d.gaps, inputs, store),
      verdictLine(d.sp, res, inputs, store),
      h('h3', { class: 'resp-group' }, 'What is untested'),
      gapsLine(d.gaps, inputs, store),
      h('h3', { class: 'resp-group' }, 'How urgent'),
      urgencyLine(d.rules, res, inputs, store));
    body.setAttribute('aria-busy', 'false');
    const now = `${res.risk?.level || 'none'}|${res.growth?.verdict?.label || res.kind}`;   // announce only when one changes
    if (fromUser && last !== null && now !== last) {
      announce(`Response evidence updated: ${res.risk?.level ? `urgency ${res.risk.level}` : 'no urgency level'}; ${res.growth?.verdict ? `verdict ${res.growth.verdict.label}` : 'no spread verdict'}.`);
    }
    last = now;
  }

  const start = () => {
    compute(false);
    unsub = store.subscribe(() => compute(true));
  };
  const stop = () => { alive = false; seq++; unsub?.(); unsub = null; };
  if (typeof ctx.onMount === 'function') ctx.onMount(start); else start();
  if (typeof ctx.onLeave === 'function') ctx.onLeave(stop);
  return el;
}
