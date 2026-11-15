// Hash router and the navigation (site/REBUILD_PLAN.md §2.4).
// Each page is js/pages/<id>.js exporting `default async function render(root, ctx)` and optionally `short(ctx)`.
// ctx = { id, page, params, detached, store, onMount(fn), onLeave(fn) }.
import { h, untip } from './lib.js';
import { TOP, MORE, pageById, docTitle } from './site.js';
import { runPasses, revealFigure } from './passes.js';
import { stopReading } from './prefs.js';
import { startTour } from './tour.js';
import * as store from './store.js';

const $ = id => document.getElementById(id);
let cur = { id: null, params: {} }, leaving = [], token = 0;

const parse = () => {
  const [path, q] = location.hash.replace(/^#\/?/, '').split('?');
  const id = pageById(path) ? path : 'overview';
  return { id, params: Object.fromEntries(new URLSearchParams(q || '')) };
};
const calmNow = () => document.documentElement.dataset.motion === 'calm';

function makeCtx(id, params, detached) {
  const mounts = [], leaves = [];
  return {
    ctx: { id, page: pageById(id), params, detached, store, onMount: fn => { if (typeof fn === 'function') mounts.push(fn); }, onLeave: fn => { if (typeof fn === 'function') leaves.push(fn); } },
    mounts, leaves,
  };
}
const runAll = (fns, what) => fns.splice(0).forEach(fn => { try { fn(); } catch (e) { console.error(`${what} callback failed`, e); } });

/** Render a page into a new div and run every pass. Used by the router and, detached, by the Sources site map. */
export async function renderPage(id, { detached = true, params = {} } = {}) {
  const page = pageById(id); if (!page) throw new Error(`Unknown page: ${id}`);
  const { ctx, mounts, leaves } = makeCtx(id, params, detached);
  const mod = await import(`./pages/${id}.js`);
  const root = h('div');
  await mod.default(root, ctx);
  await runPasses(root, page, ctx, mod);
  return { root, page, ctx, mounts, leaves, dispose: () => runAll(leaves, 'onLeave') };
}

function errorCard(e) {
  return h('div', {}, h('div', { class: 'page' }, h('div', { class: 'empty' }, h('h3', {}, 'This page failed to load'), h('pre', {}, String(e?.stack || e)))));
}

function closeMenus() {
  const nav = $('nav'), menu = document.querySelector('.menu');
  nav?.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false');
  setMore(false);
}
function markCurrent(id) {
  document.querySelectorAll('#nav a[data-id]').forEach(a => (a.dataset.id === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.querySelector('.more-btn')?.classList.toggle('has-current', MORE.some(p => p.id === id));
}

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';
let firstRoute = true;
async function route({ rerender = false } = {}) {
  const my = ++token, { id, params } = parse(), view = $('view'), y = scrollY;
  // on a re-render (theme or motion change) keep open folds and the focused control
  const keep = rerender && view.dataset.page === id ? {
    open: [...view.querySelectorAll('details')].map(d => d.open),
    focus: view.contains(document.activeElement) ? [...view.querySelectorAll(FOCUSABLE)].indexOf(document.activeElement) : -1,
  } : null;
  // 2 leave the old page
  runAll(leaving, 'onLeave'); untip(); stopReading(); closeMenus(); markCurrent(id);
  const page = pageById(id);
  let out, failed = null;
  try { out = await renderPage(id, { detached: false, params }); }
  catch (e) { console.error(e); failed = e; }
  if (my !== token) { out?.dispose(); return false; }          // a newer route started meanwhile
  // 5 title
  document.title = docTitle(page);
  // 6 swap (view transition unless Calm)
  const root = failed ? errorCard(failed) : out.root;
  let swapped = false;
  const swap = () => { if (swapped) return; swapped = true; view.dataset.page = id; view.replaceChildren(...root.childNodes); };
  if (document.startViewTransition && !calmNow() && !rerender) { try { await document.startViewTransition(swap).updateCallbackDone; } catch { /* transition skipped */ } }
  swap();
  cur = { id, params };
  if (out) { leaving = out.leaves; runAll(out.mounts, 'onMount'); }
  // 8 focus or reveal
  const initial = firstRoute; firstRoute = false;
  if (rerender) {
    if (keep) {
      const ds = [...view.querySelectorAll('details')];
      if (ds.length === keep.open.length) ds.forEach((d, i) => { if (keep.open[i] && !d.open) d.open = true; });
      if (keep.focus >= 0) view.querySelectorAll(FOCUSABLE)[keep.focus]?.focus({ preventScroll: true });
    }
    scrollTo(0, y);
  }
  else if (params.fig && revealFigure(params.fig)) { /* revealed */ }
  else { if (!initial) view.focus({ preventScroll: true }); scrollTo(0, 0); }   // first load: leave focus at the top so Tab reaches the skip link
  return true;
}

export const go = (id, p = {}) => {
  const q = new URLSearchParams(p).toString();
  location.hash = `#/${id}${q ? '?' + q : ''}`;
};
export const currentRoute = () => ({ ...cur, params: { ...cur.params } });
export { currentRoute as current };

// ---------- navigation ----------
let moreBtn = null, moreList = null;
function setMore(open) {
  if (!moreBtn) return;
  moreBtn.setAttribute('aria-expanded', String(open)); moreList.hidden = !open;
}
function buildNav() {
  const nav = $('nav'), menu = document.querySelector('.menu');
  const link = p => h('a', { href: `#/${p.id}`, 'data-id': p.id }, p.label);
  moreList = h('ul', { id: 'more-list', class: 'more-list', hidden: true }, MORE.map(p => h('li', {}, link(p))));
  moreBtn = h('button', { type: 'button', class: 'more-btn', 'aria-expanded': 'false', 'aria-controls': 'more-list' }, 'More');
  moreBtn.addEventListener('click', () => { const open = moreList.hidden; setMore(open); if (open) moreList.querySelector('a')?.focus(); });
  const more = h('div', { class: 'more-menu' }, moreBtn, moreList);
  more.addEventListener('keydown', e => { if (e.key === 'Escape' && !moreList.hidden) { e.stopPropagation(); setMore(false); moreBtn.focus(); } });
  more.addEventListener('focusout', e => { if (!more.contains(e.relatedTarget) && e.relatedTarget) setMore(false); });
  document.addEventListener('click', e => { if (!more.contains(e.target)) setMore(false); });
  nav.replaceChildren(...TOP.map(link), more,
    h('button', { type: 'button', class: 'judge', onclick: () => { closeMenus(); startTour(); }, title: 'A 1-minute guided tour of the key results' }, 'Judge mode'));
  const top = document.querySelector('.top');      // the sticky header's height, so revealed figures are not hidden under it
  if (top && 'ResizeObserver' in window) new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', `${Math.round(top.getBoundingClientRect().height)}px`)).observe(top);
  menu?.addEventListener('click', () => { const o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(o)); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false'); menu?.focus(); } });
}

let startedRouter = false;
export function start() {
  if (startedRouter) return; startedRouter = true;
  buildNav();
  addEventListener('hashchange', () => route());
  addEventListener('vo:rerender', () => route({ rerender: true }));
  return route();
}
