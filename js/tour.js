// Guided tour: five stops through the story. Each stop opens a page, scrolls to one figure and says why it matters.
import { h } from './lib.js';
const STOPS = [
  ['overview', '.tick', 'The finding', 'On NASA\'s real fire in an empty cargo ship, a flame light sensor would have noticed in seconds; the smoke detector took minutes.'],
  ['detect', '.card:has(canvas.replay)', 'See the raw data', 'Replay the actual sensor readings. Each lane lights up when it crosses our stated alarm rule.'],
  ['detect', '.card:has(.chart[aria-label*="crew limits"])', 'Why the delay matters', 'In NASA\'s later Saffire fires, carbon monoxide passed crew limits, and the smoke alarm came after much of the gas was out.'],
  ['predict', '.sp-grid', 'What the fire does next', 'Our spread model, calibrated on NASA flights. Move oxygen and airflow; it tells you when you leave NASA\'s data.'],
  ['evidence', 'table.trust', 'Can you trust it?', 'Every model on one table: score on data it never saw, the simple baseline, and whether it met the rule we wrote before running it.'],
];
let i = -1, panel = null;
const wait = sel => new Promise(res => { const t0 = Date.now(); const f = () => { const el = document.querySelector(sel); if (el || Date.now() - t0 > 5000) return res(el); setTimeout(f, 120); }; f(); });
async function go(k) {
  i = Math.max(0, Math.min(STOPS.length - 1, k)); const [page, sel, title, text] = STOPS[i];
  document.querySelectorAll('.tour-on').forEach(e => e.classList.remove('tour-on'));
  render(title, text);
  const cur = (location.hash.replace(/^#\//, '').split('?')[0]) || 'overview';
  if (cur !== page) location.hash = `#/${page}`;
  const el = await wait(sel); if (!el) return;
  const box = el.closest('.card') || el; box.classList.add('tour-on');
  box.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'calm' ? 'auto' : 'smooth', block: 'center' });
}
function render(title, text) {
  if (!panel) { panel = h('div', { class: 'tour', role: 'dialog', 'aria-label': 'Guided tour' }); document.body.append(panel); }
  panel.replaceChildren(h('p', { class: 'tour-n' }, `Stop ${i + 1} of ${STOPS.length}`), h('h2', {}, title), h('p', {}, text),
    h('div', { class: 'tour-btns' }, h('button', { type: 'button', class: 'chip', disabled: i === 0, onclick: () => go(i - 1) }, '← Back'),
      i < STOPS.length - 1 ? h('button', { type: 'button', class: 'btn primary', onclick: () => go(i + 1) }, 'Next →') : h('button', { type: 'button', class: 'btn primary', onclick: end }, 'Finish'),
      h('button', { type: 'button', class: 'chip', onclick: end, 'aria-label': 'Close tour' }, '✕')));
  panel.querySelector('.btn')?.focus();
}
function end() { document.querySelectorAll('.tour-on').forEach(e => e.classList.remove('tour-on')); panel?.remove(); panel = null; i = -1; }
addEventListener('keydown', e => { if (e.key === 'Escape' && panel) end(); });
export const startTour = () => go(0);
export const tourButton = (label = 'Take the 1-minute tour') => h('button', { type: 'button', class: 'btn', onclick: startTour }, label);
