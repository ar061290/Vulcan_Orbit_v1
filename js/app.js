// Router and shell. Each page is one module in js/pages/ exporting default async (root) => void.
import './theme.js';
import { h, load } from './lib.js';
import { annotate } from './glossary.js';
import { banner } from './banner.js';
import { summary, KEEP } from './summaries.js';
import { provenance } from './provenance.js';
import { hero } from './hero.js';
const VISUAL = { flame: 'flame', predict: 'flame', respond: 'flame', detect: 'smoke', locate: 'smoke' };   // others: earth
import './bg.js';
const PAGES = [
  ['overview', 'Home'], ['memory', 'History'], ['detect', 'Find it'], ['predict', 'Predict it'], ['respond', 'Put it out'], ['flame', 'Flame lab'],
  ['evidence', 'Checks'], ['ask', 'Ask'], ['explorer', 'NASA experiments'], ['locate', 'Bench rig'], ['about', 'Sources'],
];
const HIDDEN = ['design', 'explorer', 'locate', 'about'];   // reachable by link, not in the top bar
const nav = document.getElementById('nav'), view = document.getElementById('view'), menu = document.querySelector('.menu');
PAGES.filter(([id]) => !HIDDEN.includes(id)).forEach(([id, label]) => nav.append(h('a', { href: `#/${id}`, 'data-id': id }, label)));
menu.addEventListener('click', () => { const o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });

async function route() {
  const id = (location.hash.replace(/^#\//, '').split('?')[0]) || 'overview';
  const known = PAGES.some(p => p[0] === id) || HIDDEN.includes(id) ? id : 'overview';
  nav.querySelectorAll('a').forEach(a => a.dataset.id === known ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  nav.classList.remove('open'); document.getElementById('tip').hidden = true;
  try {
    const mod = await import(`./pages/${known}.js`); const root = h('div'); await mod.default(root);
    root.querySelectorAll('.card').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 10)));   // staggered reveal
    provenance(root);
    if (known !== 'overview' && known !== 'memory') { pageHead(root, known); await simplify(root, known); }
    annotate(root);
    // Accessibility fixes applied to every page: name every chart, make scrolling tables reachable by keyboard, fill empty headers.
    root.querySelectorAll('svg[role=img]:not([aria-label]), svg.chart:not([aria-label])').forEach(svg => {
      const t = svg.closest('.card')?.querySelector(':scope > h2')?.childNodes[0]?.textContent?.trim();
      svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t ? `Chart: ${t}. The numbers are described in the text of this figure.` : 'Chart');
    });
    root.querySelectorAll('.scroll').forEach((s, i) => { const t = s.closest('.card')?.querySelector(':scope > h2')?.childNodes[0]?.textContent?.trim(); s.tabIndex = 0; s.setAttribute('role', 'region'); s.setAttribute('aria-label', `Table ${i + 1}${t ? ': ' + t : ''}`); });
    root.querySelectorAll('th').forEach(th => { if (!th.textContent.trim()) th.append(h('span', { class: 'sr' }, 'Item')); });
    document.title = (known === 'overview' ? '' : (known === 'memory' ? 'Sixty years of fire' : PAGES.find(p => p[0] === known)?.[1] || 'Design kit') + ' · ') + 'Vulcan Orbit';
    const swap = () => view.replaceChildren(root);
    if (document.startViewTransition && document.documentElement.dataset.motion !== 'calm') document.startViewTransition(swap); else swap();
  }
  catch (e) { console.error(e); view.replaceChildren(h('div', { class: 'empty' }, h('h3', {}, 'This page failed to load'), h('pre', {}, String(e.stack || e)))); }
  view.focus({ preventScroll: true }); scrollTo(0, 0);
  return true;
}
addEventListener('hashchange', route);

// Less at once: a three-sentence short answer first, the main figure next, everything else one click away.
async function simplify(root, id) {
  const page = root.firstElementChild, head = page.querySelector('.phead');
  let lines = null; try { lines = await summary(id); } catch { lines = null; }
  if (lines?.length) head.after(h('section', { class: 'short', 'aria-label': 'The short answer' }, h('h2', {}, 'The short answer'), h('ol', {}, ...lines.map(t => h('li', {}, t)))));
  // inside each figure: keep the first sentence of long method text, fold the rest and the footnotes
  page.querySelectorAll('.card').forEach(c => {
    const sub = c.querySelector(':scope > .sub');
    if (sub && sub.textContent.length > 150) {
      const t = sub.textContent, m = t.match(/^.+?[.!?](\s|$)/);
      if (m && m[0].length < t.length - 20) { sub.textContent = m[0].trim(); c.append(h('details', { class: 'fold' }, h('summary', {}, 'How this was made'), h('p', {}, t.slice(m[0].length).trim()))); }
    }
    const notes = [...c.querySelectorAll(':scope > p')].filter(p => p.children.length === 1 && p.firstElementChild.tagName === 'SMALL' && p.textContent === p.firstElementChild.textContent);
    if (notes.length) { const d = h('details', { class: 'fold' }, h('summary', {}, 'Notes and sources')); notes.forEach(n => d.append(n)); c.append(d); }
  });
  // page level: show the main figures, fold the rest under one clear button
  const blocks = [...page.children].filter(e => !e.matches('.phead, .short, h1, .lead, .toc, script'));
  const keep = KEEP[id] ?? 2, rest = blocks.slice(keep);
  const n = rest.reduce((a, b) => a + (b.matches('.card') ? 1 : b.querySelectorAll(':scope > .card').length || 1), 0);
  if (rest.length) {
    const more = h('details', { class: 'more' }, h('summary', {}, h('span', {}, `Show ${n} more figure${n > 1 ? 's' : ''}`), h('small', {}, 'Methods, checks and extra views for people who want the detail')));
    rest[0].before(more); rest.forEach(r => more.append(r));
    more.addEventListener('toggle', () => { if (more.open) dispatchEvent(new Event('resize')); });
  }
}

// Professional page header: a full-width illustrated band with the section number, title and summary,
// then an "On this page" index of the figures, each one linkable.
function pageHead(root, id) {
  const h1 = root.querySelector('h1'); if (!h1) return;
  const lead = h1.nextElementSibling?.classList.contains('lead') ? h1.nextElementSibling : null;
  const shown = PAGES.filter(([k]) => !HIDDEN.includes(k)), n = shown.findIndex(p => p[0] === id), label = PAGES.find(p => p[0] === id)?.[1] || 'Design kit';
  const TITLE = { detect: 'Where is the fire?', predict: 'What will it do?', respond: 'What puts it out?', flame: 'A flame without gravity', evidence: 'How we checked it', explorer: 'The NASA experiments', locate: 'Our bench rig', ask: 'Ask a question', about: 'Sources and credits' };
  if (TITLE[id]) h1.textContent = TITLE[id];
  const kind = VISUAL[id] || 'earth';
  const vis = kind === 'flame' ? hero({ g: 0 }).el : banner(kind);
  const head = h('header', { class: 'phead' }, vis, h('div', { class: 'phead-in' },
    h('p', { class: 'kicker' }, n >= 0 ? `${String(n).padStart(2, '0')} / ${label}` : `More / ${label}`), h1, lead));
  const figs = [...root.querySelectorAll('.card > h2')].filter(x => !x.closest('.card .card .card'));
  const items = figs.map((t, i) => { const c = t.parentElement; c.id ||= `fig-${i + 1}`; const name = t.childNodes[0]?.textContent?.trim();
    return name ? h('li', {}, h('a', { href: `#/${id}`, onclick: e => { e.preventDefault(); c.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'calm' ? 'auto' : 'smooth', block: 'start' }); c.focus?.({ preventScroll: true }); } }, name)) : null; }).filter(Boolean);
  const first = root.firstElementChild;
  first.prepend(head);
}
addEventListener('vo:rerender', () => { const y = scrollY; route().then(() => scrollTo(0, y)); });

// Global warning while any panel still runs on placeholder numbers.
(async () => {
  const m = await load('manifest');
  const demo = (m.files || []).filter(f => f.status === 'demo').length, missing = (m.files || []).filter(f => f.status === 'missing').length;
  const b = document.getElementById('demo-banner');
  if (demo + missing) { b.hidden = false; b.textContent = [demo ? `${demo} data file${demo > 1 ? 's hold' : ' holds'} placeholder numbers.` : '', missing ? `${missing} data file${missing > 1 ? 's are' : ' is'} still to come, mostly from our bench rig.` : '', 'Every affected panel is labelled “No data yet”.'].filter(Boolean).join(' '); }
})();
route();
