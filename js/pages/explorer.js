// NASA experiments (#/explorer): "Find and rank". Plan v2 items B1 to B5 (site/REBUILD_PLAN.md §3.9).
// Reads data/investigations.json (the NASA catalogue), data/ranking_weights.json (the team's topic weights) and
// data/gaps.json (the O2 and pressure each investigation actually tested, matched by PSI id because the names differ).
//   B1 search over name, measured, fuel and facility, plus focus buttons
//   B2 mission ranking: score = sum of the team's topic weights (disclosed under the table; relevance, not a prediction)
//   B3 an expand button per row with every attribute we hold, and "Not in our table yet" for the rest
//   B4 side by side: a Compare button per row (aria-pressed), at most 2, the oldest pick drops out
//   B5 "Group by hardware": a prefix rule on the facility string, shown on the page
import { h, load, card, badge, empty, seg, announce, isMissing } from '../lib.js';

// B5: hardware family = the first prefix the facility string starts with. Order matters only for display.
// The rule is a team choice (the facility strings come from data/investigations.json); it is printed on the page.
const FAMILIES = [
  { prefix: 'Combustion Integrated Rack', label: 'Combustion Integrated Rack', note: 'MDCA and ACME inserts' },
  { prefix: 'Microgravity Science Glovebox', label: 'Microgravity Science Glovebox', note: 'including the SPICE flow duct' },
  { prefix: 'Cygnus', label: 'Cygnus', note: 'cargo vehicle' },
  { prefix: 'ISS cabin', label: 'ISS cabin', note: 'station cabin air' },
];
const UNMAPPED = 'Not mapped to a family';
const familyOf = facility => FAMILIES.find(f => String(facility || '').startsWith(f.prefix))?.label || UNMAPPED;

const FOCUS = [['all', 'All'], ['flammability', 'Flammability'], ['detection', 'Detection'], ['suppression', 'Suppression']];
const NOT_YET = 'Not in our table yet';
const PSI_URL = psi => `https://psi.nasa.gov/physci/repo/data/investigations/${psi}`;
const psiOf = s => (String(s || '').match(/PSI-\d+/) || [null])[0];
const BAR_PX = 70; // display only: width of the longest relevance bar (main used 70 px)

// Kept for the session, so a theme or motion change (vo:rerender) does not wipe the visitor's picks.
const state = { q: '', focus: 'all', mission: null, pick: [], open: new Set(), group: false };

const ext = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text, h('span', { class: 'sr' }, ' (opens in a new tab)'));
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "Tested O2" and "Tested pressure" text for one investigation, from its gaps.json `tested` entry (or why there is none). */
function testedText(t, gaps) {
  if (isMissing(gaps)) { const why = 'Not available yet (data/gaps.json missing)'; return { o2: why, kpa: why, n: null }; }
  if (!t) return { o2: NOT_YET, kpa: NOT_YET, n: null };
  const u = gaps.units || {};
  const r = (a, unit) => (a[0] === a[1] ? `${a[0]}${unit ? ' ' + unit : ''}` : `${a[0]}–${a[1]}${unit ? ' ' + unit : ''}`);
  return {
    o2: r(t.o2, u.o2),
    kpa: t.pressure_assumed
      ? `${r(t.kpa, u.kpa)}, assumed by us: NASA's table records no pressure, so these tests are placed at cabin pressure`
      : r(t.kpa, u.kpa),
    n: t.pressure_assumed
      ? `${t.n} tests in NASA's summary table with a usable O₂ value (${t.kind})`
      : `${t.n} tests in NASA's summary table with usable O₂ and pressure values (${t.kind})`,
  };
}

/** One-line answer for "The short answer" (main's summaries.js text). */
export async function short() {
  const inv = await load('investigations');
  if (isMissing(inv)) return ['The list of NASA experiments is not available yet (data/investigations.json missing).'];
  return ['These are the NASA space-station fire experiments we used, with links to the original data.'];
}

export default async function render(root, ctx = {}) {
  const live = !ctx.detached;
  const [inv, rw, gaps] = await Promise.all([load('investigations'), load('ranking_weights'), load('gaps')]);
  const pg = h('div', { class: 'page' },
    h('h1', {}, 'NASA combustion investigations'),
    h('p', { class: 'lead' }, 'Every experiment we draw on, ranked by how much it tells you about fire safety for the mission you pick.'));
  root.append(pg);

  if (isMissing(inv) || !Array.isArray(inv.items)) {
    pg.append(card('Find and rank', 'missing', null,
      empty('NASA experiments list', 'investigations', 'The list of NASA investigations has not been added yet, so there is nothing to search or rank.',
        '{ "status": "real", "source": "…", "items": [ { "id", "name", "psi", "doi", "facility", "focus", "fuel", "measured", "rows", "tags": [] } ] }')));
    return;
  }
  const items = inv.items;
  const haveW = !isMissing(rw) && rw.weights && rw.missions;
  const missions = haveW ? Object.keys(rw.missions) : [];
  if (!missions.includes(state.mission)) state.mission = missions.includes('station') ? 'station' : (missions[0] || null);

  // gaps.json `tested`, keyed by PSI id ("ACME CFI-G (PSI-159)" → PSI-159)
  const testedBy = new Map();
  if (!isMissing(gaps)) for (const t of gaps.tested || []) { const p = psiOf(t.inv); if (p) testedBy.set(p, t); }

  const weights = () => (haveW ? rw.weights[state.mission] || {} : {});
  const score = it => (it.tags || []).reduce((a, t) => a + (weights()[t] || 0), 0);
  const matches = it => (state.focus === 'all' || it.focus === state.focus) &&
    [it.name, it.measured, it.fuel, it.facility].join(' ').toLowerCase().includes(state.q.trim().toLowerCase());

  // ---------- controls (B1, B2, B5) ----------
  const searchId = 'xp-search', missionId = 'xp-mission';
  const search = h('input', { type: 'search', id: searchId, value: state.q, autocomplete: 'off',
    placeholder: 'Search fuels, sensors, facilities', 'aria-describedby': 'xp-search-hint' });
  let sayTimer = 0;
  const sayCount = (delay = 0) => {
    if (!live) return;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { const n = items.filter(matches).length; announce(`${n} of ${items.length} experiments shown.`); }, delay);
  };
  ctx.onLeave?.(() => clearTimeout(sayTimer));
  search.addEventListener('input', () => { state.q = search.value; drawTable(); sayCount(600); });

  const missionSel = haveW ? h('select', { id: missionId, onchange: e => { state.mission = e.target.value; drawTable(); drawRule(); sayCount(); } },
    missions.map(k => h('option', { value: k, selected: k === state.mission }, rw.missions[k]))) : null;
  const focusSeg = seg({ label: 'Focus', options: FOCUS, value: state.focus, onChange: v => { state.focus = v; drawTable(); sayCount(); } });
  const groupBtn = h('button', { type: 'button', class: 'chip', 'aria-pressed': state.group, 'aria-controls': 'xp-table',
    onclick: () => { state.group = !state.group; groupBtn.setAttribute('aria-pressed', String(state.group)); drawTable(); if (state.group) ruleBox.open = true;
      if (live) announce(state.group ? 'Grouped by hardware family.' : 'Ranked as one list.'); } }, 'Group by hardware');

  const controls = h('div', { class: 'xp-controls' },
    h('div', { class: 'xp-field' }, h('label', { for: searchId }, 'Search'), search,
      h('small', { id: 'xp-search-hint' }, 'Matches the name, what it measured, the fuel and the facility.')),
    haveW ? h('div', { class: 'xp-field' }, h('label', { for: missionId }, 'Mission'), missionSel) : null,
    focusSeg,
    h('div', { class: 'xp-field' }, h('span', { class: 'seg-label', id: 'xp-layout' }, 'Layout'),
      h('div', { role: 'group', 'aria-labelledby': 'xp-layout' }, groupBtn)));

  // ---------- B5 mapping rule: always on the page as a fold, opened when grouping is switched on ----------
  const famCounts = new Map();
  for (const it of items) famCounts.set(familyOf(it.facility), (famCounts.get(familyOf(it.facility)) || 0) + 1);
  const mapped = items.filter(it => familyOf(it.facility) !== UNMAPPED).length;
  const nExp = n => `${n} experiment${n === 1 ? '' : 's'}`;
  const ruleBox = h('details', { class: 'fold xp-rule', open: state.group },
    h('summary', {}, 'How the hardware families are made'),
    h('p', {}, badge('team'), ' ',
      'Each experiment goes into the first family whose name its facility starts with (facility text from data/investigations.json). ',
      `${mapped} of ${items.length} experiments map to a family.`),
    h('ul', {}, FAMILIES.map(f => h('li', {}, h('b', {}, f.label), ` (${f.note}): facility starts with “${f.prefix}”. `,
      `${nExp(famCounts.get(f.label) || 0)}.`)),
      famCounts.get(UNMAPPED) ? h('li', {}, h('b', {}, UNMAPPED), `: ${nExp(famCounts.get(UNMAPPED))}.`) : null));

  // ---------- the table (B1, B2, B3, B4) ----------
  const COLS = ['Relevance', 'Investigation', 'Focus', 'Fuel', 'What it measured', 'Rows', 'PSI', 'Compare'];
  const tableBox = h('div', { class: 'scroll xp-scroll' });
  const cmpBox = h('div', { class: 'xp-cmp' });
  const ruleLine = h('p', { class: 'xp-score-rule' });

  const detailRow = (r, id) => {
    const t = testedText(testedBy.get(r.psi), gaps);
    const dl = h('dl', { class: 'kv xp-kv' },
      [['Focus', cap(r.focus)], ['Fuel', r.fuel], ['Facility', r.facility], ['Hardware family', familyOf(r.facility)],
        ['What it measured', r.measured], ['Rows', r.rows || 'unverified'],
        ['Topic tags', (r.tags || []).length ? h('span', {}, r.tags.map(x => h('span', { class: 'tag' }, x))) : 'unverified'],
        ['PSI record', r.psi ? ext(PSI_URL(r.psi), r.psi) : 'unverified'],
        ['DOI', r.doi ? ext(`https://doi.org/${r.doi}`, r.doi) : 'unverified'],
        ['O₂ tested', t.o2], ['Pressure tested', t.kpa], t.n ? ['Range from', `${t.n}, data/gaps.json`] : null,
        ['Goals', NOT_YET], ['Sample shape', NOT_YET], ['Variables', NOT_YET],
      ].filter(Boolean).map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
    return h('tr', { class: 'xp-detail', id, hidden: !state.open.has(r.id) },
      h('td', { colspan: COLS.length }, dl,
        h('p', { class: 'xp-note' }, h('small', {}, 'Airflow, sample size and sensors are named inside "What it measured" where our table has them. Goals, sample shape and variables are not separate fields in data/investigations.json yet.'))));
  };

  const row = r => {
    const did = `xp-d-${r.id}`, picked = state.pick.includes(r.id);
    const xbtn = h('button', { type: 'button', class: 'xp-x', 'aria-expanded': state.open.has(r.id), 'aria-controls': did },
      h('span', { class: 'xp-caret', 'aria-hidden': 'true' }), h('b', {}, r.name), h('span', { class: 'sr' }, ': show all attributes'));
    const cbtn = h('button', { type: 'button', class: 'chip xp-pick', 'aria-pressed': picked, 'data-id': r.id },
      'Compare', h('span', { class: 'sr' }, ` ${r.name}`));
    // v3: data-label lets the phone layout stack each row with its column names (css/p-explorer.css)
    const tr = h('tr', { class: picked ? 'sel' : null, 'data-id': r.id },
      h('td', { class: 'xp-rel', 'data-label': COLS[0] }, haveW
        ? [h('span', { class: 'xp-bar', 'aria-hidden': 'true', style: `width:${Math.max(4, (r.score / r.max) * BAR_PX)}px` }), h('small', {}, String(r.score))]
        : h('small', {}, 'n/a')),
      h('td', { class: 'xp-inv', 'data-label': COLS[1] }, xbtn, h('br'), h('small', {}, r.facility)),
      h('td', { class: 'xp-focus', 'data-label': COLS[2] }, r.focus), h('td', { class: 'xp-fuel', 'data-label': COLS[3] }, r.fuel),
      h('td', { class: 'xp-meas', 'data-label': COLS[4] }, r.measured),
      h('td', { class: 'xp-rows', 'data-label': COLS[5] }, r.rows || 'unverified'),
      h('td', { class: 'xp-psi', 'data-label': COLS[6] }, r.psi ? ext(PSI_URL(r.psi), r.psi) : 'unverified'),
      h('td', { class: 'xp-cmpcell', 'data-label': COLS[7] }, cbtn));
    const det = detailRow(r, did);
    xbtn.addEventListener('click', () => {
      const open = !state.open.has(r.id);
      if (open) state.open.add(r.id); else state.open.delete(r.id);
      xbtn.setAttribute('aria-expanded', String(open)); det.hidden = !open;
    });
    cbtn.addEventListener('click', () => togglePick(r.id));
    return [tr, det];
  };

  function drawTable() {
    const rows = items.filter(matches).map(i => ({ ...i, score: score(i) })).sort((a, b) => b.score - a.score);
    const max = Math.max(1, ...rows.map(r => r.score));
    rows.forEach(r => { r.max = max; });
    const head = h('thead', {}, h('tr', {}, COLS.map((c, i) => h('th', { scope: 'col', class: i === 5 ? 'xp-rows' : null }, c))));
    let bodies;
    if (!rows.length) {
      bodies = [h('tbody', {}, h('tr', {}, h('td', { colspan: COLS.length }, `No experiments match "${state.q.trim()}"${state.focus !== 'all' ? ` with focus ${state.focus}` : ''}.`)))];
    } else if (state.group) {
      const order = [...FAMILIES.map(f => f.label), UNMAPPED];
      bodies = order.map(fam => {
        const rs = rows.filter(r => familyOf(r.facility) === fam);
        if (!rs.length) return null;
        return h('tbody', { class: 'xp-group' },
          h('tr', { class: 'xp-ghead' }, h('th', { colspan: COLS.length, scope: 'colgroup' }, `${fam} · ${rs.length} experiment${rs.length === 1 ? '' : 's'}`)),
          rs.map(row));
      });
    } else bodies = [h('tbody', {}, rows.map(row))];
    tableBox.replaceChildren(h('table', { class: 'xp-table', id: 'xp-table' },
      h('caption', {}, haveW ? `NASA investigations, ranked for "${rw.missions[state.mission]}"${state.group ? ', grouped by hardware family' : ''}. ${rows.length} of ${items.length} shown.`
        : `NASA investigations. ${rows.length} of ${items.length} shown. Ranking weights are not available yet.`),
      head, bodies));
  }

  function togglePick(id) {
    if (id != null) state.pick = state.pick.includes(id) ? state.pick.filter(x => x !== id) : [...state.pick, id].slice(-2);
    tableBox.querySelectorAll('tr[data-id]').forEach(tr => tr.classList.toggle('sel', state.pick.includes(tr.dataset.id)));
    tableBox.querySelectorAll('button.xp-pick').forEach(b => b.setAttribute('aria-pressed', String(state.pick.includes(b.dataset.id))));
    drawCmp();
    if (live) {
      const names = state.pick.map(p => items.find(i => i.id === p)?.name).filter(Boolean);
      announce(names.length === 2 ? `Comparing ${names[0]} and ${names[1]}.` : `${names.length} selected for comparison.`);
    }
  }

  function drawCmp() {
    const picked = state.pick.map(id => items.find(i => i.id === id)).filter(Boolean);
    if (picked.length !== 2) {
      cmpBox.replaceChildren(h('p', {}, h('small', {}, `Press Compare on two experiments to see them side by side. ${picked.length} selected.`)));
      return;
    }
    const tt = picked.map(p => testedText(testedBy.get(p.psi), gaps));
    const shared = (picked[0].tags || []).filter(t => (picked[1].tags || []).includes(t));
    const rowsSpec = [['Focus', p => p.focus], ['Fuel', p => p.fuel], ['Facility', p => p.facility], ['Hardware family', p => familyOf(p.facility)],
      ['Measured', p => p.measured], ['Rows', p => p.rows], ['O₂ tested', (p, i) => tt[i].o2], ['Pressure tested', (p, i) => tt[i].kpa]];
    cmpBox.replaceChildren(card('Side by side', inv.status, 'What the two share and where they differ',
      h('div', { class: 'scroll', tabindex: '0', role: 'region', 'aria-label': `Table: ${picked[0].name} and ${picked[1].name} side by side` }, h('table', { class: 'xp-cmp-table' },
        h('caption', { class: 'sr' }, `${picked[0].name} and ${picked[1].name}, side by side`),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Attribute')), picked.map(p => h('th', { scope: 'col' }, p.name)))),
        h('tbody', {},
          rowsSpec.map(([l, f]) => h('tr', {}, h('th', { scope: 'row' }, l), picked.map((p, i) => h('td', {}, f(p, i) || 'unverified')))),
          h('tr', {}, h('th', { scope: 'row' }, 'Shared topics'),
            h('td', { colspan: 2 }, shared.length ? shared.map(t => h('span', { class: 'tag' }, t)) : 'None in common'))))),
      h('p', {}, h('button', { type: 'button', class: 'chip', onclick: () => { state.pick = []; togglePick(null); tableBox.querySelector('button.xp-pick')?.focus(); } }, 'Clear the comparison'))));
  }

  function drawRule() {
    if (!haveW) { ruleLine.replaceChildren(); return; }
    const w = weights();
    ruleLine.replaceChildren(badge(rw.status), ' ', h('small', {},
      `How relevance is scored for "${rw.missions[state.mission]}": each investigation gets the sum of these topic weights: ` +
      Object.entries(w).map(([k, v]) => `${k} ${v}`).join(', ') + '. Weights are set by the team and are not a NASA rating. ' +
      'This is relevance weighting, not a prediction: a high score says an experiment is on topic for that mission, not what a fire there would do.'));
  }

  drawTable(); drawCmp(); drawRule();
  pg.append(card('Find and rank', inv.status, inv.source,
    controls, ruleBox, tableBox, cmpBox, ruleLine,
    haveW ? null : empty('Mission ranking', 'ranking_weights', 'Without the team\'s topic weights the experiments are listed in file order and not ranked.',
      '{ "status": "team", "missions": { "station": "Space station" }, "weights": { "station": { "detection": 3 } } }'),
    haveW && rw.note ? h('p', {}, h('small', {}, rw.note)) : null));
}
