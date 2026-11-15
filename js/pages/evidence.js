// Checks (#/evidence): every check with its pass limit, the trust table, NASA cross-checks, luck tests, simulation
// checks, the data-file index and the known limits (site/REBUILD_PLAN.md §3.11). Ported from main's js/pages/evidence.js.
// Order: "Checks" first (visible; keep 1), the rest under "Show N more figures". The tour's stop 5 ("Can you trust
// this?", table.trust) is reached through revealFigure, which opens the fold.
import { load, loadPath, page, isMissing } from '../lib.js';
import { evidenceRows, E4_SOURCE } from '../overlays.js';
import { trustCard, crosscheckCard, permutationCard, checksCard, checkCounts, simChecksCard, manifestCard, knownLimitsCard, armStamps } from '../fig_checks.js';

const LEAD = 'Every claim on this site has a check, a reference and a pass limit written before the check was run. Failures stay on the page.';

async function checkRows() {
  const [ev, models, m6b] = await Promise.all([load('evidence'), load('models'), loadPath(E4_SOURCE)]);
  return { ev, models, rows: evidenceRows(isMissing(ev) ? null : ev, { m6bResults: isMissing(m6b) ? null : m6b, models: isMissing(models) ? null : models }) };
}

export default async function render(root, ctx) {
  const [{ ev, models, rows }, man, fs, sp, dw, tr, xc, pm] = await Promise.all([
    checkRows(), load('manifest'), load('flame_static'), load('flame_spread'), load('drift_whatif'),
    load('trust'), load('crosscheck'), load('permutation')]);
  root.append(page('Checks', LEAD,
    checksCard(rows, ev),
    trustCard(tr),
    crosscheckCard(xc),
    permutationCard(pm, models),
    simChecksCard(fs, sp, dw),
    manifestCard(man),
    knownLimitsCard()));
  // UI lock: verdict stamps pop in once as they scroll into view (none under Calm motion; nothing when detached).
  if (ctx && !ctx.detached) ctx.onMount?.(() => { const stop = armStamps(root); ctx.onLeave?.(stop); });
}

// "The short answer" (main's summaries.js evidence lines). Scrapped rows are counted apart from "still to run" (§3.1).
export async function short() {
  const { ev, rows } = await checkRows();
  if (isMissing(ev)) return ['The list of checks is not available yet (data/evidence.json missing).', 'Failures stay on the page. That is the point.'];
  const { n, pass, fail, todo, scrapped, proposed } = checkCounts(rows);
  const run = `${todo} ${todo === 1 ? 'is' : 'are'} still to run`;
  const line2 = scrapped
    ? `${pass} passed, ${fail} failed, ${run}, and ${scrapped} ${scrapped === 1 ? 'was' : 'were'} scrapped with the old bench rig (see plan v2).`
    : `${pass} passed, ${fail} failed, and ${run}${proposed ? ` (${proposed} of them ${proposed === 1 ? 'is' : 'are'} proposed for scrapping with the old bench rig; see plan v2)` : ''}.`;
  return [
    `We wrote down ${n} checks, each with its pass limit set before running it.`,
    line2,
    'Failures stay on the page. That is the point.',
  ];
}
