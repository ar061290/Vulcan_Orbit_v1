// The ONE display-overlay module (REBUILD_PLAN §2.6). Everything that changes how data looks without changing the data
// lives here, so site/DECISIONS.md can point at one file:
//   - the scrapped list (thermopile locator, ion wind) and how the banner, Checks and the manifest table treat it;
//   - display text for manifest rows whose `what` mentions ion wind;
//   - the ion-wind text filter (E-FIELD finding, Ask answers, live-mode passages);
//   - the E4 and E5 check results, filled from the models' own result files, plus the pending camera checks.
// No data file is edited. Pure functions, no DOM: importable in Node.

export const SCRAPPED = {
  approved: false,                 // HUMAN CHECKPOINT (Q1): status.js/evidence use the lists only when true
  files: ['dome_locator', 'dome_sensor_count'],      // thermopile locator
  optional: ['response_trials'],   // ion-wind part scrapped, mist optional: banner says "optional", not "still to come"
  checks: ['E1', 'E2', 'E8'],      // shown as STATUS.scrapped, rows kept
  simChecks: ['D-dome'],           // drift_whatif dome heat check (thermopile/thermistor rig)
};

export const MANIFEST_WHAT = {     // display text for manifest rows whose `what` mentions ion wind
  response_trials: 'Bench mist trial, before and after (optional)',
  efield: 'NASA ACME E-FIELD Flames test days (PSI-22), shown as NASA context',
};
// "Where each number comes from": rows for SCRAPPED.files keep their manifest `what` but show badge('scrapped') instead of
// 'No data yet' (when approved; before that, 'missing'), so nothing scrapped reads as "still to come".

/** Display form of one manifest row: {name, what, status, owner, scrapped, optional}. The manifest itself is not changed. */
export function manifestRow(f, { approved = SCRAPPED.approved } = {}) {
  const scrapped = approved && SCRAPPED.files.includes(f.name);
  return {
    ...f,
    what: MANIFEST_WHAT[f.name] ?? scrubIonWind(f.what || ''),
    status: scrapped ? 'scrapped' : f.status,
    scrapped,
    optional: SCRAPPED.optional.includes(f.name),
  };
}

// ---- Ion-wind text filter --------------------------------------------------------------------------------------------
const ION_WIND = /\bion[- ]wind\b/i;
// Words ending in "." that do not end a sentence (the same list passes.js uses for the abbreviation-safe sub split).
const ABBR = /(?:\bet al|\be\.g|\bi\.e|\bvs|\bcf|\bapprox|\bca|\bFig|\bNo|\bEq|\bRef|\bDr|\bSt|\bp|\bpp)\.$/i;

/** Split text into sentences, keeping each sentence's own trailing whitespace. Decimals, DOIs and abbreviations stay whole. */
export function sentences(text) {
  const s = String(text ?? ''), out = [];
  let start = 0;
  const rx = /[.!?]["'”’)\]]*(\s+)(?=["'“‘(\[]?[A-Z0-9])/g;
  let m;
  while ((m = rx.exec(s))) {
    const end = m.index + m[0].length - m[1].length;
    if (ABBR.test(s.slice(start, end))) continue;
    out.push(s.slice(start, m.index + m[0].length));
    start = m.index + m[0].length;
  }
  if (start < s.length) out.push(s.slice(start));
  return out;
}

/** Drop every sentence that mentions ion wind ("ion wind", "ion-wind", any case). Other text is returned unchanged. */
export function scrubIonWind(text) {
  if (text == null) return text;
  const s = String(text);
  if (!ION_WIND.test(s)) return s;
  return sentences(s).filter(x => !ION_WIND.test(x)).join('').trim();
}

/** The E-FIELD panel's finding, shown as NASA context only (C6). */
export function efieldText(ef) {
  return scrubIonWind(ef?.finding ?? '');
}

// ---- Checks: E4/E5 overlay, scrapped rows, pending camera checks ------------------------------------------------------
// Three significant figures with trailing zeros kept (0.0200, not 0.02). lib.sig() drops them; this module stays DOM-free
// and Node-importable, so it does not import lib.js.
const s3 = v => (typeof v === 'number' && Number.isFinite(v)) ? v.toPrecision(3) : null;

export const CV_PENDING = [
  {id:'CV1', what:'Fire detection rate on held-out frames',              owner:'Mukund', state:'pending'},
  {id:'CV2', what:'Flame size and position error on held-out frames',    owner:'Mukund', state:'pending'},
  {id:'OF1', what:'Optical-flow smoke track checked against the camera', owner:'Mukund', state:'pending'},
  {id:'CV3', what:'Distance from the sensor (depth model) error on held-out frames', owner:'Mukund', state:'pending'},
].map(r => ({ ...r, ref: 'Dome camera, held-out frames', limit: 'To be written in RULES.md before testing', result: null }));
// CV3: plan v2 §2.1 lists the depth model and "distance from the sensor" as dome outputs, and §10 forbids any accuracy we
// have not measured. No numbers in any of these rows.

export const E4_SOURCE = 'models/m6b-predictor/results.json';
export const E5_SOURCE = 'data/models.json';

function e4(row, res) {
  const o = res?.opposed, mae = o?.mae_mm_s, r = o?.mae_range_95;
  const k = s3(mae?.kept), b = s3(mae?.B1_raw_de_ris);
  const [klo, khi] = (r?.kept || []).map(s3), [blo, bhi] = (r?.B1_raw_de_ris || []).map(s3);
  if ([k, b, klo, khi, blo, bhi].some(v => v == null)) return row;   // file missing or reshaped: leave the row as evidence.json has it
  const beats = mae.kept < mae.B1_raw_de_ris;                        // limit: "Report both; no claim if it does not beat it"
  return {
    ...row,
    state: beats ? 'pass' : 'fail',
    result: `${beats ? 'Pass' : 'Fail'}: M6b held-out MAE ${k} mm/s [${klo}–${khi}] vs de Ris ${b} mm/s [${blo}–${bhi}]`,
    overlay: E4_SOURCE,
  };
}
function e5(row, models) {
  const m = (models?.models || []).find(x => x.id === 'm7-extinction');
  const sc = m?.score, [lo, hi] = m?.score_range || [];
  if (![sc, lo, hi].every(v => typeof v === 'number' && Number.isFinite(v))) return row;
  return {                                                             // limit: "Report AUC with a range"
    ...row,
    state: 'pass',
    result: `Pass: AUC ${sc} [${lo}–${hi}]`,
    overlay: `${E5_SOURCE} (id m7-extinction, score and score_range)`,
  };
}

/**
 * The rows for the "Checks" table: evidence.json's checks with the display overlay applied, then CV_PENDING.
 * - E4 from models/m6b-predictor/results.json (opposed.mae_mm_s, mae_range_95); E5 from data/models.json m7-extinction.
 *   Each overlaid row carries `overlay` = its source path. A missing source leaves the row exactly as the file has it.
 * - E1, E2, E8 get state 'scrapped' once SCRAPPED.approved is true; until then they keep the file's state and carry
 *   `proposedScrap: true`, so the page can say they are proposed for scrapping (not hidden either way).
 */
export function evidenceRows(evidence, { m6bResults, models, approved = SCRAPPED.approved } = {}) {
  const rows = (evidence?.checks || []).map(c => {
    if (c.id === 'E4') return e4(c, m6bResults);
    if (c.id === 'E5') return e5(c, models);
    if (SCRAPPED.checks.includes(c.id)) return approved ? { ...c, state: 'scrapped', scrapped: true } : { ...c, proposedScrap: true };
    return c;
  });
  return [...rows, ...CV_PENDING.map(r => ({ ...r }))];
}

/** A simulation check (drift_whatif / flame files) as shown: D-dome becomes 'scrapped' once approved. */
export function simCheckState(c, { approved = SCRAPPED.approved } = {}) {
  if (SCRAPPED.simChecks.includes(c?.id)) return approved ? 'scrapped' : (c.ok === true ? 'pass' : c.ok === false ? 'fail' : 'pending');
  return c?.ok === true ? 'pass' : c?.ok === false ? 'fail' : 'pending';
}

// ---- Ask ------------------------------------------------------------------------------------------------------------
/**
 * What the Ask page shows for a matched assistant_cache item (Q4): every answer goes through scrubIonWind (only the
 * efield answer changes); the `ionwind` refusal shows its refusal text with no "Matched to" line.
 */
export function askAnswer(item) {
  return { a: scrubIonWind(item?.a ?? ''), showMatched: item?.id !== 'ionwind' };
}
export const hideGoldRow = g => /\bion[- ]wind\b/i.test(g.q)   // scored, not listed (Q4)
/** A kb.json passage as llm.js sends it: ion-wind sentences removed from its text (the file is unchanged). */
export function kbPassage(p) {
  return p ? { ...p, title: scrubIonWind(p.title), text: scrubIonWind(p.text) } : p;
}
