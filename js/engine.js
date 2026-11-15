// The shared engine for every tab (feat/ui-lock): mission clock, sound toggle (off by default), Ctrl/Cmd+K command
// palette, magnetic buttons, long-press for a figure's "Made by" box, the first-visit loader and the h1 line reveal.
// The router (js/router.js) calls enterPage() after each swap; app.js calls initEngine() once.
import { h, slug } from './lib.js';
import { PAGES } from './site.js';

const calm = () => document.documentElement.dataset.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get: k => { try { return localStorage.getItem('vo.' + k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem('vo.' + k, v); } catch { /* blocked */ } } };
export const pageNum = id => String(PAGES.findIndex(p => p.id === id) + 1).padStart(2, '0');

// ---------- sound (off by default; a short tone, never music) ----------
let ac = null, soundOn = store.get('sound') === 'on';
export function blip(freq = 660, dur = .06) {
  if (!soundOn) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.06, ac.currentTime + .01); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur + .02);
  } catch { /* no audio */ }
}
function soundButton() {
  const b = h('button', { type: 'button', class: 'hud-btn', 'aria-pressed': String(soundOn) }, 'Sound ', h('b', {}, soundOn ? 'on' : 'off'));
  b.addEventListener('click', () => { soundOn = !soundOn; store.set('sound', soundOn ? 'on' : 'off'); b.setAttribute('aria-pressed', String(soundOn)); b.querySelector('b').textContent = soundOn ? 'on' : 'off'; blip(880); });
  return b;
}

// ---------- mission clock: time since this visit started ----------
function missionClock() {
  const t0 = performance.now();
  const out = h('span', { class: 'mclock', role: 'timer', 'aria-label': 'Time since you opened the site' }, 'T+ 00:00');
  const tick = () => { const s = Math.floor((performance.now() - t0) / 1000); out.textContent = `T+ ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  setInterval(() => { if (!document.hidden) tick(); }, 1000);
  return out;
}

// ---------- command palette ----------
let pal = null, index = null, indexing = null;
async function buildIndex() {
  if (indexing) return indexing;
  index = PAGES.map(p => ({ label: `${pageNum(p.id)} ${p.label}`, sub: p.title || 'Page', href: `#/${p.id}` }));
  // figure titles come from each page's own "On this page" index: the current page's at once, every other page's from
  // a detached render (the same one the Sources site map uses), in the background
  const fromToc = (root, id) => [...root.querySelectorAll('.toc a')].map(a => ({ label: a.textContent.trim(), sub: `${pageNum(id)} ${PAGES.find(p => p.id === id)?.label}`, href: a.getAttribute('href') || `#/${id}?fig=${slug(a.textContent)}` }));
  const curId = document.getElementById('view')?.dataset.page;
  if (curId) index.push(...fromToc(document.getElementById('view'), curId));
  indexing = (async () => {
    const { renderPage } = await import('./router.js');
    for (const p of PAGES) {
      if (p.id === curId || p.head === false) continue;
      try { const r = await renderPage(p.id, { detached: true }); index.push(...fromToc(r.root, p.id)); r.dispose(); } catch { /* page failed: its page entry stays */ }
      if (pal && !pal.hidden) filter();
    }
  })();
  return indexing;
}
let input, list, sel = 0, shown = [];
function filter() {
  const q = input.value.trim().toLowerCase();
  shown = (index || []).filter(it => !q || (it.label + ' ' + it.sub).toLowerCase().includes(q)).slice(0, 40);
  sel = Math.min(sel, Math.max(0, shown.length - 1));
  list.replaceChildren(...shown.map((it, i) => h('li', { role: 'option', id: `pal-${i}`, 'aria-selected': String(i === sel), onclick: () => pick(i), onmousemove: () => { if (sel !== i) { sel = i; mark(); } } },
    h('span', {}, it.label), h('small', {}, it.sub))));
  if (!shown.length) list.append(h('li', { class: 'pal-none', role: 'option', 'aria-disabled': 'true', 'aria-selected': 'false' }, 'No match'));
  mark();
}
function mark() { [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === sel))); input.setAttribute('aria-activedescendant', shown.length ? `pal-${sel}` : ''); list.children[sel]?.scrollIntoView({ block: 'nearest' }); }
function pick(i) { const it = shown[i]; if (!it) return; closePalette(); location.hash = it.href.replace(/^#?/, '#'); }
let lastFocus = null;
export function openPalette() {
  if (!pal) {
    input = h('input', { type: 'text', class: 'pal-in', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', 'aria-label': 'Jump to a page or figure', placeholder: 'Jump to a page or figure…', autocomplete: 'off' });
    list = h('ul', { id: 'pal-list', class: 'pal-list', role: 'listbox', 'aria-label': 'Pages and figures' });
    pal = h('div', { class: 'pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette', hidden: true },
      h('div', { class: 'pal-box hud' }, h('p', { class: 'pal-k' }, 'Jump to · Enter opens · Esc closes'), input, list));
    pal.addEventListener('click', e => { if (e.target === pal) closePalette(); });
    input.addEventListener('input', () => { sel = 0; filter(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'Tab') e.preventDefault();          // focus stays in the dialog
    });
    document.body.append(pal);
  }
  lastFocus = document.activeElement;
  index = null; indexing = null; buildIndex();
  pal.hidden = false; input.value = ''; sel = 0; filter(); input.focus();
}
export function closePalette() { if (!pal || pal.hidden) return; pal.hidden = true; lastFocus?.focus?.({ preventScroll: true }); }

// ---------- magnetic buttons (mouse only; lean at most 6 px toward a pointer within 60 px) ----------
function magnetic() {
  let raf = 0, ev = null, leaned = [];
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || calm()) return; ev = e;
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      leaned.forEach(b => (b.style.translate = '')); leaned = [];
      const els = document.querySelectorAll('.btn, .judge, .hud-btn, .mag');
      for (const b of els) {
        const r = b.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = ev.clientX - Math.max(r.left, Math.min(r.right, ev.clientX)), dy = ev.clientY - Math.max(r.top, Math.min(r.bottom, ev.clientY));
        if (Math.hypot(dx, dy) > 60) continue;
        const k = 1 - Math.hypot(dx, dy) / 60, vx = ev.clientX - cx, vy = ev.clientY - cy, m = Math.hypot(vx, vy) || 1;
        const lean = Math.min(6, m * .15) * k;
        b.style.translate = `${(vx / m * lean).toFixed(1)}px ${(vy / m * lean).toFixed(1)}px`; leaned.push(b);
      }
    });
  }, { passive: true });
}

// ---------- long-press (500 ms) on a figure opens its "Made by" box ----------
function longPress() {
  let t = 0, at = null;
  const cancel = () => { clearTimeout(t); t = 0; };
  addEventListener('pointerdown', e => {
    const card = e.target.closest?.('#view .card[data-fignum]'); if (!card || e.button > 0) return;
    if (e.target.closest('a, button, input, select, summary, textarea')) return;
    at = { x: e.clientX, y: e.clientY };
    t = setTimeout(() => {
      const box = card.querySelector(':scope > details.madeby'); if (!box) return;
      box.open = true; box.querySelector('summary')?.focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
      navigator.vibrate?.(8); blip(520);
    }, 500);
  }, { passive: true });
  addEventListener('pointermove', e => { if (t && at && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 8) cancel(); }, { passive: true });
  addEventListener('pointerup', cancel); addEventListener('pointercancel', cancel);
}

// ---------- first-visit loader: real asset-load percent ----------
/** Show "IGNITING RENDERER n%" on the first visit while `tasks` (promises) settle and the page's fetches finish. */
export function loader(tasks) {
  if (store.get('ignited')) return Promise.all(tasks.map(p => p.catch(() => {})));
  store.set('ignited', '1');
  const pct = h('b', {}, '0%'), bar = h('i');
  const el = h('div', { class: 'loader', role: 'status', 'aria-live': 'polite' }, h('div', { class: 'loader-in' }, h('p', {}, 'Igniting renderer ', pct), h('div', { class: 'loader-bar' }, bar)));
  document.body.append(el);
  let total = tasks.length, done = 0;
  const of = window.fetch;
  const upd = () => { const p = Math.round(100 * done / Math.max(1, total)); pct.textContent = `${p}%`; bar.style.width = `${p}%`; };
  window.fetch = (...a) => { total++; upd(); return of(...a).finally(() => { done++; upd(); }); };
  tasks.forEach(p => p.finally(() => { done++; upd(); }));
  // never hold the site behind the loader for more than 6 s (a blocked font server must not stall it)
  return Promise.race([Promise.all(tasks.map(p => p.catch(() => {}))), new Promise(r => setTimeout(r, 6000))]).then(() => {
    window.fetch = of; done = total; upd();
    el.classList.add('done'); setTimeout(() => el.remove(), calm() ? 0 : 420);
  });
}

// ---------- entering a page: the h1 reveals word by word under a mask, the first 3 blocks stagger ----------
export function enterPage(view) {
  const h1 = view.querySelector('h1');
  if (h1 && !h1.dataset.split && !calm() && !h1.querySelector('*')) {
    const words = h1.textContent.split(/(\s+)/);
    h1.dataset.split = '1';
    h1.replaceChildren(...words.map((w, i) => (/^\s+$/.test(w) ? document.createTextNode(w) : h('span', { class: 'w' }, h('span', { style: `--i:${i >> 1}` }, w)))));
  }
  view.classList.remove('entering'); void view.offsetWidth; view.classList.add('entering');
  setTimeout(() => view.classList.remove('entering'), 1400);
}

export function initEngine() {
  const top = document.querySelector('.top');
  top?.append(h('div', { class: 'hud-right' }, missionClock(),
    h('button', { type: 'button', class: 'hud-btn', onclick: openPalette, 'aria-keyshortcuts': 'Control+K Meta+K' }, 'Jump ', h('kbd', {}, '⌘K')), soundButton()));
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal && !pal.hidden ? closePalette() : openPalette(); }
  });
  magnetic(); longPress();
}
