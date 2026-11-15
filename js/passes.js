// Post-render passes, run by the router on every page in a fixed order (site/REBUILD_PLAN.md §2.5),
// plus figure anchors: every top-level figure card gets id fig-N, data-fignum=N and data-fig=<slug of its title>.
// The visible "Figure N" label is CSS content: "Figure " attr(data-fignum), so it always agrees with ?fig=N and
// with "On this page", including cards inside closed folds.
import { h, slug, calm, setParams } from './lib.js';
import { groupOf } from './site.js';
import * as prov from './provenance.js';
import * as gloss from './glossary.js';

const titleOf = c => c.dataset.title || c.querySelector(':scope > h2')?.childNodes[0]?.textContent?.trim() || '';
/** Top-level figure cards: a .card with its own h2 that is not inside another card. */
export const figureCards = root => [...root.querySelectorAll('.card')].filter(c => c.querySelector(':scope > h2') && !c.parentElement?.closest('.card'));
export const figLink = (pageId, title) => `#/${pageId}?fig=${slug(title)}`;

// ---------- "Less at once": abbreviation-safe first sentence ----------
const ABBR = /(?:\bet al|\be\.g|\bi\.e|\bvs|\bcf|\bapprox|\bca|\bFig|\bNo|\bDr|\bSt|\bU\.S|\bInc|\bLtd)$/i;
/** Index just after the first sentence end in t, or -1. Skips "et al.", "e.g.", "i.e.", "vs." and decimals. */
export function firstSentenceEnd(t) {
  const re = /[.!?]+["”’)]?(?=\s|$)/g; let m;
  while ((m = re.exec(t))) {
    const before = t.slice(0, m.index);
    if (m[0][0] === '.' && ABBR.test(before)) continue;
    const after = t.slice(m.index + m[0].length).replace(/^\s+/, '');
    if (after && /^[a-z]/.test(after)) continue;          // "… et al. (2019) found …", lower-case continuation
    return m.index + m[0].length;
  }
  return -1;
}
/** Move everything after character offset `at` of el's text into a fragment, keeping links and markup. */
function splitAt(el, at) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, seen = 0;
  while ((n = walk.nextNode())) {
    const len = n.textContent.length;
    if (seen + len >= at) {
      const r = document.createRange(); r.setStart(n, at - seen); r.setEndAfter(el.lastChild);
      return r.extractContents();
    }
    seen += len;
  }
  return null;
}
function simplifyCard(c) {
  const sub = c.querySelector(':scope > .sub');
  if (sub && sub.textContent.length > 150) {
    const t = sub.textContent, end = firstSentenceEnd(t);
    if (end > 0 && end < t.length - 20) {
      const rest = splitAt(sub, end);
      if (rest) {
        const p = h('p', {}); p.append(rest);
        if (p.firstChild?.nodeType === 3) p.firstChild.textContent = p.firstChild.textContent.replace(/^\s+/, '');
        if (sub.lastChild?.nodeType === 3) sub.lastChild.textContent = sub.lastChild.textContent.replace(/\s+$/, '');
        c.append(h('details', { class: 'fold' }, h('summary', {}, 'Read the rest of the note'), p));
      }
    }
  }
  const notes = [...c.querySelectorAll(':scope > p')].filter(p => p.children.length === 1 && p.firstElementChild.tagName === 'SMALL' && p.textContent.trim() === p.firstElementChild.textContent.trim());
  if (notes.length) { const d = h('details', { class: 'fold' }, h('summary', {}, 'Notes and sources')); notes.forEach(n => d.append(n)); c.append(d); }
}
function foldBlocks(pg, keep) {
  const blocks = [...pg.children].filter(e => !e.matches('.phead, .short, h1, .lead, .toc, script'));
  const rest = blocks.slice(keep);
  if (!rest.length) return;
  const n = rest.reduce((a, b) => a + (b.matches('.card') ? 1 : b.querySelectorAll(':scope > .card').length || 1), 0);
  const more = h('details', { class: 'more' }, h('summary', {}, h('span', {}, `Show ${n} more figure${n > 1 ? 's' : ''}`), h('small', {}, 'Methods, checks and extra views for people who want the detail')));
  rest[0].before(more); rest.forEach(r => more.append(r));
  more.addEventListener('toggle', () => { if (more.open) dispatchEvent(new Event('resize')); });
}

// ---------- page header (v3: compact; no illustrated band, site/DECISIONS.md v3) ----------
function pageHead(pg, page, ctx) {
  let h1 = pg.querySelector(':scope > h1') || pg.querySelector('h1');
  if (!h1) { h1 = h('h1', {}, page.title || page.label); pg.prepend(h1); }
  const lead = h1.nextElementSibling?.classList.contains('lead') ? h1.nextElementSibling : null;
  if (page.title) h1.textContent = page.title;
  const grp = groupOf(page.id);
  const head = h('header', { class: 'phead' }, h('p', { class: 'kicker' }, grp ? h('span', {}, grp) : null, h('b', {}, page.kicker || page.label)), h1, lead);
  pg.prepend(head);
  return head;
}

// ---------- reveal a figure (opens its folds) ----------
export function revealFigure(ref, { focus = true } = {}) {
  let el = null;
  if (ref && ref.nodeType === 1) el = ref;
  else {
    const s = String(ref ?? '').trim(); if (!s) return false;
    const scope = document.getElementById('view') || document;
    el = /^\d+$/.test(s) ? scope.querySelector(`[data-fignum="${s}"]`) : (scope.querySelector(`[data-fig="${CSS.escape(slug(s))}"]`) || scope.querySelector(`#${CSS.escape(s)}`));
  }
  if (!el) return false;
  let opened = false;
  for (let d = el.parentElement?.closest('details'); d; d = d.parentElement?.closest('details')) if (!d.open) { d.open = true; opened = true; }
  if (el.tagName === 'DETAILS' && !el.open) { el.open = true; opened = true; }
  if (opened) dispatchEvent(new Event('resize'));
  el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
  if (focus) { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
  return true;
}

function anchorsAndToc(pg, page, head, detached) {
  const cards = figureCards(pg);
  const items = cards.map((c, i) => {
    const n = i + 1, t = titleOf(c);
    c.id ||= `fig-${n}`; c.dataset.fignum = String(n); if (t) c.dataset.fig = slug(t);
    if (!t) return null;
    return h('li', {}, h('a', { href: `#/${page.id}?fig=${n}`, onclick: e => {
      if (detached || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
      e.preventDefault(); revealFigure(c); setParams({ fig: n });
    } }, t));
  }).filter(Boolean);
  if (!items.length) return null;
  // v3: a sticky right rail on wide screens, a dropdown (details) on narrow ones
  const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 1280px)').matches;
  const toc = h('nav', { class: 'toc', 'aria-label': 'On this page' },
    h('details', { class: 'toc-d', open: wide || detached }, h('summary', {}, h('span', {}, 'On this page'), h('small', {}, `${items.length} figure${items.length > 1 ? 's' : ''}`)), h('ol', {}, items)));
  const anchor = head || pg.querySelector(':scope > .lead') || pg.querySelector(':scope > h1');
  if (anchor) anchor.after(toc); else pg.prepend(toc);
  return toc;
}

function a11y(pg) {
  pg.querySelectorAll('svg.chart:not([aria-label])').forEach(svg => {
    const t = svg.closest('.card') ? titleOf(svg.closest('.card')) : '';
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t ? `Chart: ${t}. The numbers are described in the text of this figure.` : 'Chart');
  });
  pg.querySelectorAll('.scroll').forEach((s, i) => {
    const c = s.closest('.card'), t = c ? titleOf(c) : '';
    s.tabIndex = 0; s.setAttribute('role', 'region');
    // the provisional label set by table()/numbers() (data-autolabel) gives way to this unique, figure-titled one
    if (!s.hasAttribute('aria-label') || s.dataset.autolabel) { s.setAttribute('aria-label', `Table ${i + 1}${t ? ': ' + t : ''}`); delete s.dataset.autolabel; }
  });
  pg.querySelectorAll('th').forEach(th => { if (!th.textContent.trim()) th.append(h('span', { class: 'sr' }, 'Item')); });
  pg.querySelectorAll('canvas, svg').forEach(el => {
    if (el.closest('[aria-hidden="true"]') || el.parentElement?.closest('svg')) return;
    if (!el.getAttribute('role') || !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))) console.warn('a11y: graphic without role and label', el);
  });
}

/** Run every pass on a freshly rendered page. root = the div the page rendered into. */
export async function runPasses(root, page, ctx = {}, mod = {}) {
  const pg = root.firstElementChild; if (!pg) return;
  const detached = !!ctx.detached;
  // 1 stagger
  pg.querySelectorAll('.card').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 10)));
  // 2 provenance ("Made by")
  if (page.provenance !== false) { try { prov.provenance?.(pg); } catch (e) { console.error(e); } }
  // 3 page header
  const head = page.head === false ? null : pageHead(pg, page, ctx);
  // 4 the short answer
  let lines = null;
  try { lines = typeof mod.short === 'function' ? await mod.short(ctx) : null; } catch (e) { console.error(e); lines = null; }
  if (Array.isArray(lines) && lines.length) {
    const short = h('section', { class: 'short', 'aria-labelledby': `short-h-${page.id}` }, h('h2', { id: `short-h-${page.id}` }, 'The short answer'), h('ol', {}, lines.filter(Boolean).map(t => h('li', {}, t))));
    if (head) head.after(short); else pg.prepend(short);
  }
  // 5 simplify
  if (page.head !== false) {
    pg.querySelectorAll('.card').forEach(simplifyCard);
    foldBlocks(pg, page.keep ?? 2);
  }
  // 6 anchors and "On this page"
  if (page.head !== false) anchorsAndToc(pg, page, head, detached);
  // 7 glossary
  try { gloss.annotate?.(pg); } catch (e) { console.error(e); }
  // 8 accessibility fixes
  a11y(pg);
  // 9 charted card without a "Made by" entry
  if (page.provenance !== false && typeof prov.madeFor === 'function') {
    // a card marked data-made="none" (the design kit's specimens) is not a data figure and needs no entry
    figureCards(pg).forEach(c => { if (c.dataset.made !== 'none' && c.querySelector('svg.chart, canvas, table') && !prov.madeFor(titleOf(c))) console.warn('No "Made by" entry for figure:', titleOf(c)); });
  }
}
