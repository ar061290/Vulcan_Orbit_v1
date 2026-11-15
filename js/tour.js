// Guided tour ("Judge mode"): five stops through the story. Each stop opens a page, reveals one figure
// (opening any fold it sits in) and says why it matters. Stop text verbatim from main's js/tour.js.
// A target is a figure slug (resolved through revealFigure) or {sel: CSS selector} (stop 1, Home has no figure anchors).
import { h, slug, calm } from './lib.js';
import { revealFigure } from './passes.js';

export const STOPS = [
  ['overview', { sel: '.tick' }, 'The finding', 'On NASA\'s real fire in an empty cargo ship, a flame light sensor would have noticed in seconds; the smoke detector took minutes.'],
  ['detect', slug('Replay an orbital fire'), 'See the raw data', 'Replay the actual sensor readings. Each lane lights up when it crosses our stated alarm rule.'],
  ['detect', slug('The alarm can come after the gas'), 'Why the delay matters', 'In NASA\'s later Saffire fires, carbon monoxide passed crew limits, and the smoke alarm came after much of the gas was out.'],
  ['predict', slug('Will it spread, and how fast?'), 'What the fire does next', 'Our spread model, calibrated on NASA flights. Move oxygen and airflow; it tells you when you leave NASA\'s data.'],
  ['evidence', slug('Can you trust this?'), 'Can you trust it?', 'Every model on one table: score on data it never saw, the simple baseline, and whether it met the rule we wrote before running it.'],
];
let i = -1, panel = null, returnTo = null, seq = 0;
const routeId = () => (location.hash.replace(/^#\//, '').split('?')[0]) || 'overview';
const find = target => (typeof target === 'string' ? document.querySelector(`#view [data-fig="${CSS.escape(target)}"]`) : document.querySelector(`#view ${target.sel}`));
const wait = (target, my) => new Promise(res => {
  const t0 = Date.now();
  const f = () => { if (my !== seq) return res(null); const el = find(target); if (el || Date.now() - t0 > 5000) return res(el); setTimeout(f, 120); };
  f();
});
async function go(k) {
  const my = ++seq;
  i = Math.max(0, Math.min(STOPS.length - 1, k)); const [pageId, target, title, text] = STOPS[i];
  document.querySelectorAll('.tour-on').forEach(e => e.classList.remove('tour-on'));
  render(title, text);
  if (routeId() !== pageId) location.hash = `#/${pageId}`;
  const el = await wait(target, my); if (!el || my !== seq) return;
  const box = el.closest('.card') || el;
  revealFigure(box, { focus: false });
  box.classList.add('tour-on');
  box.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
  panel?.querySelector('.btn')?.focus();           // the router focused #view after the route; give focus back to the tour
}
function render(title, text) {
  if (!panel) { panel = h('div', { class: 'tour', role: 'dialog', 'aria-label': 'Guided tour' }); document.body.append(panel); }
  panel.replaceChildren(h('p', { class: 'tour-n' }, `Stop ${i + 1} of ${STOPS.length}`), h('h2', {}, title), h('p', {}, text),
    h('div', { class: 'tour-btns' }, h('button', { type: 'button', class: 'chip', disabled: i === 0, onclick: () => go(i - 1) }, '← Back'),
      i < STOPS.length - 1 ? h('button', { type: 'button', class: 'btn primary', onclick: () => go(i + 1) }, 'Next →') : h('button', { type: 'button', class: 'btn primary', onclick: end }, 'Finish'),
      h('button', { type: 'button', class: 'chip', onclick: end, 'aria-label': 'Close tour' }, '✕')));
  panel.querySelector('.btn')?.focus();
}
function end() {
  seq++;
  document.querySelectorAll('.tour-on').forEach(e => e.classList.remove('tour-on'));
  panel?.remove(); panel = null; i = -1;
  const back = returnTo?.isConnected ? returnTo : document.getElementById('view');
  returnTo = null; back?.focus({ preventScroll: true });
}
addEventListener('keydown', e => { if (e.key === 'Escape' && panel) end(); });
export function startTour() {
  if (!panel) returnTo = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  return go(0);
}
export const tourButton = (label = 'Take the 1-minute tour') => h('button', { type: 'button', class: 'btn', onclick: startTour }, label);
