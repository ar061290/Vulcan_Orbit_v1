// #/about "Sources and credits" (REBUILD_PLAN §3.14, spec B10 and D5.4).
// "NASA data used" is generated from data/investigations.json (every PSI id and DOI the site uses) plus the M6b
// calibration sources in data/spread_predictor.json `sources`. The papers list is main's, plus Meyer et al. 2018.
// The site map renders every page off-screen (ctx.detached) at idle, after the page is shown, and lists each figure.
import { h, load, page, card, empty, isMissing, announce } from '../lib.js';
import { PAGES } from '../site.js';
import { figureCards } from '../passes.js';

const doiUrl = d => `https://doi.org/${d}`;

// ---------- UI lock: numbered references; DOI on hover or focus; click, tap or Enter on Copy copies the citation ----------
let flip = false;
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* no async clipboard: fall back */ }
  try {
    const ta = h('textarea', { readonly: '', 'aria-hidden': 'true', tabindex: '-1', style: { position: 'fixed', left: '-9999px', top: '0', opacity: '0' } }, t);
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
/** One reference: mono index, the link (opens the source, as before), its DOI (always read by screen readers, shown on
 *  hover or focus), any trailing text, and a Copy button. Clicking the row outside the link copies too. */
function ref(label, { doi = null, url = null, after = null } = {}) {
  const href = doi ? doiUrl(doi) : url;
  const cite = `${label}.${doi ? ` doi:${doi}. ${doiUrl(doi)}` : url ? ` ${url}` : ''}`;
  const btn = h('button', { type: 'button', class: 'ref-copy', 'aria-label': `Copy citation: ${label}` }, 'Copy');
  let t = 0;
  const copy = async () => {
    const ok = await copyText(cite);
    flip = !flip;      // announce() skips a message identical to the last one, so repeat copies differ by a no-break space
    announce((ok ? 'Citation copied' : 'Could not copy the citation') + (flip ? '' : '\u00a0'));
    btn.textContent = ok ? 'Copied' : 'Copy failed'; li.classList.add('on');
    clearTimeout(t); t = setTimeout(() => { btn.textContent = 'Copy'; li.classList.remove('on'); }, 1600);
  };
  btn.addEventListener('click', e => { e.stopPropagation(); copy(); });
  const li = h('li', { class: 'ref' },
    h('span', { class: 'ref-n', 'aria-hidden': 'true' }),
    h('span', { class: 'ref-body' },
      href ? h('a', { href, target: '_blank', rel: 'noopener' }, label, h('span', { class: 'sr' }, ' (opens in a new tab)')) : h('span', {}, label),
      doi ? h('span', { class: 'ref-doi' }, ' doi ', h('code', {}, doi)) : null,
      after),
    btn);
  li.addEventListener('click', e => { if (!e.target.closest('a, button')) copy(); });
  return li;
}

function nasaDataCard(inv, sp) {
  const items = !isMissing(inv) && Array.isArray(inv.items) ? inv.items : [];
  const spSrc = !isMissing(sp) && Array.isArray(sp.sources) ? sp.sources : [];
  return card('NASA data used', isMissing(inv) ? 'missing' : inv.status, null,
    h('ul', { class: 'src-list' },
      ref('NASA Physical Sciences Informatics (psi.nasa.gov), CC0', { url: 'https://psi.nasa.gov',
        after: h('span', { class: 'ref-after' }, '. Every dataset id and DOI is also on ', h('a', { href: '#/explorer' }, 'the NASA experiments page'), '.') })),
    items.length
      ? h('ul', { class: 'src-list' }, items.map(x => ref(`${x.name}, ${x.psi}`, { doi: x.doi || null })))
      : empty('Waiting for the investigation list', 'investigations', 'The NASA investigations the site draws on, each with its PSI id and DOI.',
        '{ "status":"real", "source":"...", "items":[ { "id":"saffire3", "name":"Saffire-III", "psi":"PSI-100", "doi":"10.60555/..." } ] }'),
    h('h3', {}, 'Calibration sources for the spread predictor (M6b)'),
    spSrc.length
      ? h('ul', { class: 'src-list' }, spSrc.map(s => ref(s.label, { doi: s.doi || null, url: s.url || null })))
      : h('p', {}, h('small', {}, 'The spread predictor\'s source list is not available yet (data/spread_predictor.json missing).')),
    !isMissing(inv) && inv.source ? h('p', {}, h('small', {}, inv.source)) : null);
}

function papersCard() {
  return card('NASA papers we checked numbers against', 'team', null,
    h('ul', { class: 'src-list' },
      ref('SAME-2 particle sizes: Urban et al. 2012, AIAA 2012-3536 (NTRS 20130000422)', { url: 'https://ntrs.nasa.gov/api/citations/20130000422/downloads/20130000422.pdf' }),
      ref('ISS cabin airflow 4.6–12.2 m/min: Link and Balistreri, ICES 2015 (NTRS 20150009509)', { url: 'https://ntrs.nasa.gov/api/citations/20150009509/downloads/20150009509.pdf' }),
      ref('1 mg/m³ alarm threshold: Saffire VI, ICES-2024-365 (NTRS 20240002981)', { url: 'https://ntrs.nasa.gov/api/citations/20240002981/downloads/Saffire-ICES-2024-ICES-365-accepted%20final.pdf' }),
      ref('ISS detection threshold about 10 mg/m³ (NTRS 20170002629)', { url: 'https://ntrs.nasa.gov/api/citations/20170002629/downloads/20170002629.pdf' }),
      ref('ISS detector calibrated to 1%/ft obscuration (NTRS 20170000248)', { url: 'https://ntrs.nasa.gov/api/citations/20170000248/downloads/20170000248.pdf' }),
      ref('BASS-II summary report, NASA/TM-20210011385', { url: 'https://ntrs.nasa.gov/citations/20210011385' }),
      ref('ISS detector misses for Kapton and Teflon smoke: Meyer et al., Fire Safety Journal 98:74-81 (2018)', { doi: '10.1016/j.firesaf.2018.04.004' }),
      ref('Space Apps 2026', { url: 'https://www.spaceappschallenge.org/2026/' })),
    h('p', {}, h('small', {}, 'The full list (every dataset, paper, property value and library) is REFERENCES.md in the repository. Ideas from other public Space Apps projects are credited there too.')));
}

function aiCard(cfg) {
  const endpoint = !isMissing(cfg) ? cfg.endpoint : null;
  const model = !isMissing(cfg) && typeof cfg.model === 'string' ? ` (${cfg.model})` : '';
  const live = endpoint
    ? `The Ask page's optional live mode is on: typed questions also get an answer written by a language model${model} from the site's own passages, and any number not found in those passages blocks the answer.`
    : `The Ask page has an optional live mode, in which a language model${model} would write answers from the site's own passages only. It is switched off, so every answer on the site is a saved one.`;
  return card('Use of AI tools', isMissing(cfg) ? 'team' : cfg.status, null,
    h('p', {}, 'The idea, the choice of features and all review decisions are the team\'s. AI coding assistants (Claude) helped write code, tidy data and draft text. Every number shown comes from a dataset or a model the team ran and checked; none is generated by a language model.'),
    h('p', {}, live),
    h('p', {}, h('small', {}, 'Team to edit before submission so it matches what actually happened.')));
}

const notNasaCard = () => card('Not NASA', 'team', null,
  h('p', {}, 'This is a student hackathon project. It is not endorsed by NASA and must not be used for real safety decisions.'));

// ---------- site map ----------
const titleOf = c => c.dataset.title || c.querySelector(':scope > h2')?.childNodes[0]?.textContent?.trim() || '';
// One build per page load (the list does not change while the site is open). The build pauses for idle time between
// pages and stops early when no Sources page is showing; the next visit starts it again.
let built = null, running = null, active = 0, onProgress = null;
function ensureMap() {
  if (built) return Promise.resolve(built);
  running ||= collect((i, p) => onProgress?.(i, p), () => active === 0)
    .then(r => { running = null; if (r) built = r; return r; }, e => { running = null; throw e; });
  return running;
}

async function collect(onProgress, isCancelled) {
  const { renderPage } = await import('../router.js');
  const out = [];
  for (const [i, p] of PAGES.entries()) {
    if (isCancelled()) return null;
    onProgress(i, p);
    await new Promise(r => (typeof requestIdleCallback === 'function' ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 30)));
    let figs = [], failed = false;
    try {
      const res = await renderPage(p.id, { detached: true });
      const cards = figureCards(res.root);
      const counts = {};
      cards.forEach(c => { const s = c.dataset.fig; if (s) counts[s] = (counts[s] || 0) + 1; });
      figs = cards.map(c => ({ title: titleOf(c), slug: c.dataset.fig, num: c.dataset.fignum, dup: c.dataset.fig && counts[c.dataset.fig] > 1 }))
        .filter(f => f.title && (f.slug || f.num));
      res.dispose();
    } catch (e) { console.warn('site map: page failed to render', p.id, e); failed = true; }
    out.push({ page: p, figs, failed });
  }
  return out;
}

function mapList(entries) {
  return h('ul', { class: 'sitemap' }, entries.map(({ page: p, figs, failed }) => h('li', {},
    h('a', { href: `#/${p.id}`, class: 'sm-page' }, p.label), p.title ? h('span', { class: 'sm-q' }, ` · ${p.title}`) : null,
    failed ? h('p', {}, h('small', {}, 'This page could not be drawn for the site map; the page link still works.'))
      : figs.length ? h('ol', {}, figs.map(f => h('li', {}, h('a', { href: f.dup || !f.slug ? `#/${p.id}?fig=${f.num}` : `#/${p.id}?fig=${f.slug}` }, f.title))))
        : h('p', {}, h('small', {}, 'One continuous page, no numbered figures.')))));
}

function siteMapCard(ctx) {
  const body = h('div', { class: 'sm-body' });
  const c = card('Site map', 'team', 'Every page and every figure on it. Each link opens the figure, including figures inside a "Show more" fold.', body);
  if (ctx.detached) { body.append(h('p', {}, 'The site map is built when this page is open.')); return c; }
  const status = h('p', { class: 'sm-status' }, 'Building site map…');
  body.append(status);
  let left = false;
  ctx.onLeave(() => { if (!left) { left = true; active--; } });
  ctx.onMount(() => {
    active++;
    onProgress = (i, pg) => { if (!left) status.textContent = `Building site map… page ${i + 1} of ${PAGES.length} (${pg.label})`; };
    const show = entries => {
      if (left) return;
      if (!entries) { ensureMap().then(show, fail); return; }              // an earlier build stopped early: start again
      const n = entries.reduce((a, e) => a + e.figs.length, 0);
      body.replaceChildren(h('p', { class: 'sm-status' }, `${PAGES.length} pages, ${n} figures.`), mapList(entries));
    };
    const fail = e => { console.error(e); if (!left) status.textContent = 'The site map could not be built. Every page is in the menu and the footer.'; };
    ensureMap().then(show, fail);
  });
  return c;
}

export default async function render(root, ctx) {
  // card titles first, so the detached site map sees them before any data arrives
  const grid = h('div', { class: 'grid g2' });
  const pg = page('About', 'Vulcan Orbit is a team from Hyderabad, India, taking part in the NASA Space Apps Challenge 2026, challenge "Flame in Freefall".',
    grid, siteMapCard(ctx));
  root.append(pg);
  const [inv, sp, cfg] = await Promise.all([load('investigations'), load('spread_predictor'), load('assistant_config')]);
  grid.append(nasaDataCard(inv, sp), papersCard(), aiCard(cfg), notNasaCard());
  // mono index numbers, in reading order across the reference lists
  pg.querySelectorAll('.ref-n').forEach((el, i) => { el.textContent = String(i + 1).padStart(2, '0'); });
}
