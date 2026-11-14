// Router and shell. Each page is one module in js/pages/ exporting default async (root) => void.
import { h, load } from './lib.js';
const PAGES = [
  ['overview', 'Overview'], ['explorer', 'Investigations'], ['detect', 'Detect'], ['locate', 'Locate'],
  ['predict', 'Predict'], ['respond', 'Respond'], ['evidence', 'Evidence'], ['ask', 'Ask'], ['about', 'About'],
];
const nav = document.getElementById('nav'), view = document.getElementById('view'), menu = document.querySelector('.menu');
PAGES.forEach(([id, label]) => nav.append(h('a', { href: `#/${id}`, 'data-id': id }, label)));
menu.addEventListener('click', () => { const o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });

async function route() {
  const id = (location.hash.replace(/^#\//, '').split('?')[0]) || 'overview';
  const known = PAGES.some(p => p[0] === id) ? id : 'overview';
  nav.querySelectorAll('a').forEach(a => a.dataset.id === known ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  nav.classList.remove('open'); document.getElementById('tip').hidden = true;
  view.replaceChildren(h('p', {}, 'Loading...'));
  try { const mod = await import(`./pages/${known}.js`); const root = h('div'); await mod.default(root); view.replaceChildren(root); }
  catch (e) { console.error(e); view.replaceChildren(h('div', { class: 'empty' }, h('h3', {}, 'This page failed to load'), h('pre', {}, String(e.stack || e)))); }
  view.focus({ preventScroll: true }); scrollTo(0, 0);
}
addEventListener('hashchange', route);

// Global warning while any panel still runs on placeholder numbers.
(async () => {
  const m = await load('manifest');
  const demo = (m.files || []).filter(f => f.status === 'demo').length, missing = (m.files || []).filter(f => f.status === 'missing').length;
  const b = document.getElementById('demo-banner');
  if (demo + missing) { b.hidden = false; b.textContent = `Work in progress: ${demo} data file(s) hold demo numbers and ${missing} are still missing. Every affected panel is labelled. See Evidence for the full list.`; }
})();
route();
