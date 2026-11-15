// Figures for the Checks page (#/evidence), site/REBUILD_PLAN.md §2.12 and §3.11.
// Ported from main's js/pages/evidence.js, js/trust.js and js/verify_ui.js (crosscheck, permutation); wording kept
// unless the plan says otherwise. Every card has a stamp; a missing file shows the "No data yet" empty state.
// The display overlays (E4/E5 filled from result files, scrapped rows, the camera rig's pending rows, manifest
// wording) come from js/overlays.js; no data file is changed.
import { h, card, badge, empty, isMissing, STATUS, fmt, sig } from './lib.js';
import { CRED, FACTORS } from './provenance.js';
import { SCRAPPED, manifestRow, simCheckState, scrubIonWind, E4_SOURCE, E5_SOURCE } from './overlays.js';

const TH = labels => h('thead', {}, h('tr', {}, labels.map(x => h('th', { scope: 'col' }, x === '' ? h('span', { class: 'sr' }, 'Item') : x))));
const tbl = (cls, labels, rows) => h('div', { class: 'scroll' }, h('table', { class: cls || null }, TH(labels), h('tbody', {}, rows)));
const missingCard = (title, file, why, schema) => card(title, 'missing', null, empty('No data yet', file, why, schema));
const note = (...kids) => h('p', {}, h('small', {}, ...kids));
const STATE_LABEL = { pending: 'Not run yet', pass: 'Pass', fail: 'Fail (kept on record)', scrapped: STATUS.scrapped.label };
const pill = (state, text) => h('span', { class: `status ${state}` }, text);
const OVERLAY_SRC = { E4: E4_SOURCE, E5: E5_SOURCE };   // the result file each overlaid check is filled from
const PROPOSED = 'Proposed for scrapping with the old bench rig (see plan v2); waiting for the team\'s approval.';

// ---------------------------------------------------------------------------------------------------------------------
// "Can you trust this?" [NIS]: every model on one table (data/trust.json). Ported from main's js/trust.js.
// Trust column: CRED from provenance.js; m6b's ratings are main's values, shown as draft (Q2).
const CK = { 'm7-extinction': 'ext', 'm7-burning-rate': 'rate', 'm7-cool-flame': 'cool', 'smoke-miss': 'miss', m6: 'm6', m6b: 'm6b', drift: 'drift', rate: 'latency' };
const f = v => v == null ? '—' : typeof v === 'number' ? (Math.abs(v) < 1 ? v.toFixed(3) : String(v)) : String(v);   // main's trust.js format

function trustDots(c) {
  if (!c) return '—';
  const rated = FACTORS.every(([k]) => c[k] != null);
  if (!rated) return h('small', {}, 'Not rated');
  const draft = c.draft ? ' (draft, team to check)' : '';
  return h('span', {},
    h('span', { class: 'trust-dots', title: FACTORS.map(([k, n]) => `${n} ${c[k]}/4`).join(', ') + draft, 'aria-label': FACTORS.map(([k, n]) => `${n} ${c[k]} of 4`).join(', ') + draft },
      FACTORS.map(([k]) => c[k]).join(' · ')),
    c.draft ? h('small', { class: 'ck-draft' }, 'draft') : null);
}

export function trustCard(t) {
  const title = 'Can you trust this?';
  if (isMissing(t) || !Array.isArray(t.rows)) return missingCard(title, 'trust', 'The one-table summary of every model is built by scripts/build_trust.py.',
    '{"status": "model", "what": "…", "note": "…", "rows": [{"id", "name", "kind", "metric", "score", "range": [lo, hi] | "text", "baseline", "baseline_score", "passed": true|false, "rule", "page", "perm_p"?, "perm_n"?}]}');
  const passed = t.rows.filter(r => r.passed).length;
  return card(title, t.status, `${t.what} ${passed} of ${t.rows.length} met their own rule; the rest are shown as misses.`,
    tbl('trust', ['Question', 'Kind', 'Score on unseen data', 'Range', 'Could it be luck?', 'Simple baseline', 'Own rule', 'Trust (0-4)'],
      t.rows.map(r => h('tr', { 'data-id': r.id },
        h('td', {}, r.page ? h('a', { href: `#/${r.page}` }, r.name) : r.name, h('br'), h('small', {}, r.metric || '')),
        h('td', {}, r.kind),
        h('td', { class: 'num' }, f(r.score)),
        h('td', {}, h('small', {}, Array.isArray(r.range) ? `${f(r.range[0])} to ${f(r.range[1])}` : f(r.range))),
        h('td', {}, r.perm_p != null ? h('small', {}, `p = ${r.perm_p}`, h('br'), `${r.perm_n} label shuffles`) : h('small', {}, '—')),
        h('td', {}, h('small', {}, r.baseline ? `${r.baseline}${r.baseline_score != null ? ': ' + f(r.baseline_score) : ''}` : '—', r.caveat ? h('br') : null, r.caveat ? h('b', {}, r.caveat) : null)),
        h('td', {}, h('span', { class: `lvl ${r.passed ? 'real' : 'demo'}` }, r.passed ? 'Met' : 'Missed'), h('br'), h('small', {}, r.rule)),
        h('td', {}, trustDots(CRED[CK[r.id]]))))),
    h('p', {}, h('a', { href: '#/models' }, 'Open the full model cards →')),
    note(`Trust column: Verification · Validation · Input pedigree · Uncertainty · Robustness, each 0-4 after NASA-STD-7009A, self-assessed. ${t.note || ''}`.trim(),
      Object.values(CRED).some(c => c.draft) ? ' Ratings marked “draft” are kept from the earlier site and are still to be checked by the team.' : null));
}

// ---------------------------------------------------------------------------------------------------------------------
// "NASA says / we get" [NIS] (data/crosscheck.json). Ported from main's verify_ui.js crosscheckCard.
// UI lock: drawn as a ledger (NASA's value and ours in two aligned columns, hairlines between rows). Each row is one
// control: the topic button (Enter/Space), or a tap anywhere on the row, reveals its sources; the links stay real links.
// Numbers with their units are picked out of the file's own text (nothing is added): see UNITS.
const UNITS = /\d[\d,.]*(?:\s?(?:-|–|to)\s?\d[\d,.]*)?(?:\s?(?:cm\/s|m\/s|mg\/m³|kPa|µm|nm|mm|cm|atm|bar|SD|s)(?![A-Za-z])|%|-fold)/g;
const withUnits = text => {
  const s = String(text ?? ''), out = []; let at = 0;
  for (const m of s.matchAll(UNITS)) { out.push(s.slice(at, m.index), h('span', { class: 'lg-num' }, m[0])); at = m.index + m[0].length; }
  out.push(s.slice(at));
  return out.filter(x => x !== '');
};
const srcLink = (t, u) => {
  const ext = !String(u).startsWith('#');
  return h('a', { href: u, target: ext ? '_blank' : null, rel: ext ? 'noopener' : null }, t, ext ? h('span', { class: 'sr' }, ' (opens in a new tab)') : null);
};

export function crosscheckCard(c) {
  const title = 'NASA says / we get';
  if (isMissing(c) || !Array.isArray(c.rows)) return missingCard(title, 'crosscheck', 'Built by scripts/build_crosscheck.py from published NASA values and the site\'s own data files.',
    '{"status": "reported", "checked": "YYYY-MM-DD", "what": "…", "rows": [{"topic", "nasa", "ours", "verdict", "sources": [["title", "url"]]}]}');
  const row = (r, i) => {
    const srcs = Array.isArray(r.sources) ? r.sources : [];
    const sid = `lg-src-${i}`;
    const src = srcs.length ? h('div', { class: 'lg-src', id: sid, hidden: true },
      h('span', { class: 'lg-k' }, srcs.length === 1 ? 'Source' : `Sources · ${srcs.length}`),
      h('ul', {}, srcs.map(([t, u]) => h('li', {}, srcLink(t, u))))) : null;
    const topic = src
      ? h('button', { type: 'button', class: 'lg-topic', 'aria-expanded': false, 'aria-controls': sid },
        h('span', { class: 'lg-caret', 'aria-hidden': 'true' }), h('b', {}, r.topic), h('span', { class: 'sr' }, ': show the source'))
      : h('span', { class: 'lg-topic' }, h('b', {}, r.topic));
    const li = h('li', { class: src ? 'lg-row lg-tap' : 'lg-row' },
      h('div', { class: 'lg-head' }, h('h3', { class: 'lg-h' }, topic),
        h('span', { class: `lvl lg-stamp vstamp ${/conflict|not compared/i.test(r.verdict) ? 'demo' : 'real'}` }, r.verdict)),
      h('div', { class: 'lg-cols' },
        h('div', { class: 'lg-col' }, h('span', { class: 'lg-k' }, 'NASA says (summarised)'), h('p', {}, withUnits(scrubIonWind(r.nasa)))),
        h('div', { class: 'lg-col' }, h('span', { class: 'lg-k' }, 'We get / use'), h('p', {}, withUnits(scrubIonWind(r.ours))))),
      src);
    if (src) {
      topic.addEventListener('click', () => { const o = topic.getAttribute('aria-expanded') !== 'true'; topic.setAttribute('aria-expanded', String(o)); src.hidden = !o; });
      // the whole row is the tap target; links, buttons, the sources and a text selection keep their own behaviour
      li.addEventListener('click', e => { if (e.target.closest('a, button, .lg-src, .gloss, [data-term]') || String(getSelection?.() || '').trim()) return; topic.click(); });
    }
    return li;
  };
  return card(title, c.status, `${c.what} Checked ${c.checked}. Where NASA's own sources disagree, both are shown.`,
    h('ol', { class: 'ledger' }, c.rows.map(row)));
}

// Verdict stamps: a short state word beside each check's result. The word is aria-hidden; the result text says the same.
const STAMP = { pass: 'Pass', fail: 'Fail', pending: 'Pending', scrapped: 'Scrapped' };
const stamp = state => h('span', { class: `ck-stamp vstamp ${state}`, 'aria-hidden': 'true' }, STAMP[state] || state);

/** Pop each verdict stamp (scale 1.15 to 1 over 180 ms) the first time it scrolls into view. Nothing under Calm motion. Returns a stop function. */
export function armStamps(root) {
  const calmNow = document.documentElement.dataset.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calmNow || typeof IntersectionObserver !== 'function' || !root) return () => {};
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('pop'); io.unobserve(e.target); } }), { threshold: 0.6 });
  root.querySelectorAll('.vstamp').forEach(el => { el.classList.add('armed'); io.observe(el); });
  return () => { io.disconnect(); root.querySelectorAll('.vstamp.armed').forEach(el => el.classList.remove('armed')); };
}

// ---------------------------------------------------------------------------------------------------------------------
// "Could the scores be luck?" [NIS] (data/permutation.json). Ported from main's verify_ui.js permutationCard.
// main typed "p ≈ 0.04", "0.44" and "16 tests" into the reading paragraph; here every number is read from the files:
// p and the shuffle count from permutation.json, the score range from models.json, the test count from the row's split.
const AUC_CHANCE = 0.5;   // an AUC of 0.5 is what random guessing scores (definition of the ROC AUC)
const MODEL_NAME = { 'smoke-miss': 'The smoke-miss model' };

export function luckReading(p, models) {
  const rows = Array.isArray(p?.rows) ? p.rows : [];
  if (!rows.length) return null;
  const out = [];
  // p = (C+1)/(n+1) (the file's method): with no shuffle matching the real score, p is 1/(n+1), shown rounded
  const floor = rows.filter(r => Number.isFinite(r.p) && Number.isFinite(r.n_perm) && Math.abs(r.p - 1 / (r.n_perm + 1)) < 5e-4);
  const byN = [...new Map(floor.map(r => [r.n_perm, r])).values()];
  if (byN.length) out.push(byN.map(r => `p = ${r.p} is the smallest value ${Number(r.n_perm).toLocaleString('en')} shuffles can give.`).join(' '));
  const entry = id => (Array.isArray(models?.models) ? models.models.find(m => m.id === id) : null);
  for (const r of rows.filter(x => Number.isFinite(x.p) && x.p >= 0.01)) {
    const name = MODEL_NAME[r.id] || `The ${r.name} model`;
    const beats = r.p < 0.05;
    let s = `${name} ${beats ? 'beats shuffled labels' : 'is not clearly better than shuffled labels'} (p ≈ ${sig(r.p, 1)})`;
    const lo = entry(r.id)?.score_range?.[0];
    if (Number.isFinite(lo) && lo <= AUC_CHANCE) {
      const n = /(\d+)\s+(?:flight\s+)?tests?\b/i.exec(r.split || '')?.[1];
      s += `${beats ? ' but' : ' and'} its score range still reaches ${fmt(lo, 2)}, so ${n ? `${n} tests are` : 'its tests are'} too few to rely on it`;
    }
    out.push(`${s}.`);
  }
  return out.length ? `Reading it: ${out.join(' ')}` : null;
}

export function permutationCard(p, models) {
  const title = 'Could the scores be luck?';
  if (isMissing(p) || !Array.isArray(p.rows)) return missingCard(title, 'permutation', 'Built by scripts/permutation_tests.py.',
    '{"status": "model", "what": "…", "method": "…", "rows": [{"id", "name", "real_auc", "n_perm", "null_mean", "null_95", "p", "split"}]}');
  const reading = luckReading(p, isMissing(models) ? null : models);
  return card(title, p.status, 'We shuffled the yes/no answers and reran the exact same validation, many times. If the real score is rarely matched by shuffled data, it is not luck.',
    tbl(null, ['Model', 'Real score (AUC)', 'Shuffled: average', 'Shuffled: top 5%', 'p-value', 'Validation'],
      p.rows.map(r => h('tr', { 'data-id': r.id }, h('td', {}, r.name), h('td', {}, h('b', {}, r.real_auc)), h('td', {}, r.null_mean), h('td', {}, r.null_95),
        h('td', {}, h('span', { class: `lvl ${r.p < 0.01 ? 'real' : 'demo'}` }, `p = ${r.p}`), h('br'), h('small', {}, `${r.n_perm} shuffles`)),
        h('td', {}, h('small', {}, r.split))))),
    reading ? h('p', { class: 'ck-reading' }, reading) : null,
    isMissing(models) ? h('p', { class: 'ck-reading' }, 'The score ranges behind this reading are not available yet (data/models.json missing).') : null,
    note(`${p.method || ''} M7 scores here use a fixed reference model on one grouped split, so they differ slightly from M7's headline scores. Script: scripts/permutation_tests.py.`.trim()));
}

// ---------------------------------------------------------------------------------------------------------------------
// "Checks" (data/evidence.json through overlays.evidenceRows). Spec D3 item 1 and C7.
// rows: the output of evidenceRows(); ev: the evidence.json object (for its status and note).
export function checksCard(rows, ev = {}) {
  const title = 'Checks';
  const list = Array.isArray(rows) ? rows : [];
  const fileIds = new Set((ev?.checks || []).map(c => c.id));
  const added = list.filter(r => !fileIds.has(r.id));
  const body = r => {
    const state = r.state || 'pending';
    const text = state === 'scrapped' ? STATE_LABEL.scrapped : (r.result || STATE_LABEL[state] || state);
    return h('tr', { 'data-id': r.id, class: state === 'scrapped' ? 'ck-scrapped' : (added.includes(r) ? 'ck-added' : null) },
      h('td', {}, h('code', {}, r.id)), h('td', {}, h('b', {}, r.what)), h('td', {}, r.ref), h('td', {}, r.limit),
      h('td', { class: 'ck-result' }, stamp(state), pill(state, text),
        state === 'scrapped' && r.result ? [h('br'), h('small', {}, `Before scrapping: ${r.result}`)] : null,
        r.proposedScrap ? [h('br'), h('small', { class: 'ck-proposed' }, PROPOSED)] : null,
        r.overlay ? [h('br'), h('small', { class: 'ck-source' }, 'Filled at display time from ', h('code', {}, r.overlay))]
          : OVERLAY_SRC[r.id] ? [h('br'), h('small', { class: 'ck-source' }, 'Filled at display time from ', h('code', {}, OVERLAY_SRC[r.id]), ', which is not available yet, so the row shows data/evidence.json as it stands.')] : null),
      h('td', {}, r.owner));
  };
  const table = tbl('checks', ['', 'Check', 'Compared against', 'Pass limit', 'Result', 'Owner'], list.map(body));
  const overlaid = list.filter(r => r.overlay).map(r => r.id);
  const notes = [
    overlaid.length ? note(`${overlaid.join(' and ')} ${overlaid.length > 1 ? 'are' : 'is'} filled from the models' own result files when the page loads (the source is shown in each row); `, h('code', {}, 'data/evidence.json'), ' itself is not changed. The overlay lives in ', h('code', {}, 'js/overlays.js'), '.') : null,
    added.length ? note(`${added.map(r => r.id).join(', ')} ${added.length > 1 ? 'are the camera rig\'s checks' : 'is a camera rig check'}, added by the site. No result is shown until the camera owner runs ${added.length > 1 ? 'them' : 'it'}; the pass limits are written in RULES.md before testing.`) : null,
  ];
  if (isMissing(ev)) {
    return card(title, 'missing', null, empty('No data yet', 'evidence', 'The list of checks and their pass limits comes from engine/evidence.py.',
      '{"status": "plan", "note": "…", "checks": [{"id", "what", "ref", "limit", "owner", "result": "Pass: …" | "Fail: …" (left empty until run), "state": "pass" | "fail" | "pending"}]}'),
      added.length ? h('h3', {}, 'Checks the site adds while the file is missing') : null, added.length ? table : null, notes);
  }
  return card(title, ev.status, ev.note, table, notes);
}

/** Counts for the short answer and the card: {n, pass, fail, todo, scrapped, proposed}. */
export function checkCounts(rows) {
  const r = Array.isArray(rows) ? rows : [];
  const c = s => r.filter(x => (x.state || 'pending') === s).length;
  const pass = c('pass'), fail = c('fail'), scrapped = c('scrapped');
  return { n: r.length, pass, fail, scrapped, todo: r.length - pass - fail - scrapped, proposed: r.filter(x => x.proposedScrap).length };
}

// ---------------------------------------------------------------------------------------------------------------------
// "Simulation checks": every `checks` entry in flame_static, flame_spread and drift_whatif (spec D3 item 2).
const SIM_SOURCES = [['Flame model', 'flame_static'], ['Flame spread', 'flame_spread'], ['Cabin air model (LBM)', 'drift_whatif']];
const SIM_LABEL = { pass: 'Pass', fail: 'Fail (kept on record)', pending: 'Not run: no data', scrapped: STATUS.scrapped.label };

export function simCounts(fs, sp, dw) {
  const files = [fs, sp, dw];
  const rows = SIM_SOURCES.flatMap(([n, file], i) => (isMissing(files[i]) ? [] : (files[i].checks || []).map(c => ({ n, file, ...c, shown: simCheckState(c) }))));
  const k = s => rows.filter(r => r.shown === s).length;
  return { rows, pass: k('pass'), fail: k('fail'), pending: k('pending'), scrapped: k('scrapped'),
    missing: SIM_SOURCES.filter((_, i) => isMissing(files[i])).map(([, file]) => file) };
}

export function simChecksCard(fs, sp, dw) {
  const title = 'Simulation checks';
  const { rows, pass, fail, pending, scrapped, missing } = simCounts(fs, sp, dw);
  if (!rows.length) return card(title, 'missing', null, empty('No data yet', missing[0] || 'flame_static',
    `The checks are read from data/flame_static.json, data/flame_spread.json and data/drift_whatif.json${missing.length ? `; missing now: ${missing.map(m => `data/${m}.json`).join(', ')}` : ''}.`,
    '{"status": "model", "checks": [{"id", "ok": true | false (left empty when not run), "result": "…"}]}'));
  const statuses = [...new Set([fs, sp, dw].filter(x => !isMissing(x)).map(x => x.status))];
  const status = statuses.length === 1 ? statuses[0] : 'model';
  const per = SIM_SOURCES.map(([n]) => {
    const rs = rows.filter(r => r.n === n); if (!rs.length) return null;
    const c = s => rs.filter(r => r.shown === s).length;
    return `${n}: ${c('pass')} of ${rs.length} pass`;
  }).filter(Boolean).join(' · ');
  const proposed = !SCRAPPED.approved;
  return card(title, status,
    `${pass} pass, ${fail} fail, ${pending} not run${scrapped ? `, ${scrapped} scrapped (see plan v2)` : ''}. Pass rules in models/*/RULES.md were committed before any check ran.`,
    h('p', { class: 'ck-per' }, per),
    missing.length ? h('p', { class: 'ck-per' }, `Not included yet (file missing): ${missing.map(m => `data/${m}.json`).join(', ')}.`) : null,
    tbl('simchecks', ['Model', 'Check', 'Result', 'Status'],
      rows.map(c => h('tr', { 'data-id': c.id, class: c.shown === 'scrapped' ? 'ck-scrapped' : null },
        h('td', {}, c.n), h('td', {}, h('code', {}, c.id)), h('td', {}, c.result),
        h('td', { class: 'ck-result' }, h('span', { class: `status ${c.shown} ck-stamp vstamp` }, SIM_LABEL[c.shown] || c.shown),
          proposed && SCRAPPED.simChecks.includes(c.id) ? [h('br'), h('small', { class: 'ck-proposed' }, PROPOSED)] : null)))));
}

// ---------------------------------------------------------------------------------------------------------------------
// "Where each number comes from" (data/manifest.json), with overlays.manifestRow: ion-wind wording replaced, and the
// thermopile locator files stamped "Scrapped" once the scrapped list is approved (Q1).
export function manifestCard(m) {
  const title = 'Where each number comes from';
  if (isMissing(m) || !Array.isArray(m.files)) return missingCard(title, 'manifest', 'The manifest lists every data file with its status and owner.',
    '{"status": "real", "files": [{"name", "status", "owner", "what"}]}');
  const rows = m.files.map(x => manifestRow(x));
  return card(title, m.status, 'One row per data file. A panel is only as good as the file behind it.',
    tbl('manifest', ['File', 'Feeds', 'Status', 'Owner'],
      rows.map(r => h('tr', { 'data-id': r.name },
        h('td', {}, h('code', {}, `data/${r.name}.json`)),
        h('td', {}, r.what),
        h('td', {}, badge(r.status), !SCRAPPED.approved && SCRAPPED.files.includes(r.name) ? [h('br'), h('small', { class: 'ck-proposed' }, PROPOSED)] : null),
        h('td', {}, r.owner)))),
    note(`${rows.length} files. The status is the one each file declares in the manifest; “No data yet” means the file is not in the repository yet.`));
}

// ---------------------------------------------------------------------------------------------------------------------
// "Known limits" (text only, so stamped Team choice). Bullet 1 reworded for the camera rig (C5); bullet 4's
// "line of sight to a sensor" (the thermopile locator) reworded for the camera (plan §3.11).
export const KNOWN_LIMITS = [
  'The bench rig is a camera with a fire-detection model, plus an optical-flow smoke sensor, and it runs at Earth gravity. It tests sensing ideas; it does not reproduce a microgravity flame.',
  'NASA tables for each model are small (tens to a few hundred rows). Scores are reported as ranges from sessions the model never saw.',
  'No prediction is made for lunar or Martian gravity; the archive has no such data.',
  'A camera seeing a flame is not a guarantee of detection, and a model output is not a safety rating.',
];
export function knownLimitsCard() {
  return card('Known limits', 'team', null, h('ul', { class: 'ck-limits' }, KNOWN_LIMITS.map(t => h('li', {}, t))));
}
