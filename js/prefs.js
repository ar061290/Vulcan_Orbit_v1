// "Read your way": theme, text size, science-word explanations, motion and read-aloud.
// Choices are kept in this browser only (localStorage, prefix "vo.", every access wrapped in try/catch).
// Dock text and behaviour carried over verbatim from main's js/theme.js; rows now have visible labels
// tied to their button groups (spec D5.7).
// Effects (v3): On/Off for the signature effects; sets html[data-effects]. Effects Off and Calm both stop them
// (js/fx/loop.js fxAllowed). It does not re-render the page: each effect listens for the attribute change itself.
// Events: 'vo:rerender' on theme and motion changes (the router re-renders the page, charts recolour);
//         'vo:prefs' on any change (detail {key, value}).
import { h } from './lib.js';
import { setChartTheme } from './charts.js';

const root = document.documentElement;
const KEYS = ['theme', 'size', 'terms', 'motion', 'lang', 'effects'];
const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
const DEFAULTS = {
  theme: () => 'night',   // UI lock: Night is the default; the Day toggle stays in Read your way
  size: () => '0',
  terms: () => 'on',
  motion: () => (mq('(prefers-reduced-motion: reduce)') ? 'calm' : 'full'),
  lang: () => 'en',
  // v3 signature effects (crosshair cursor, Home fire trail, ember noise, gravity toy), separate from Motion. Off by default
  // on a data-saver connection or a low-memory device (2 GB or less), so low-end machines start light; one click turns them on.
  effects: () => { try { return navigator.connection?.saveData === true || (navigator.deviceMemory && navigator.deviceMemory <= 2) ? 'off' : 'on'; } catch { return 'on'; } },
};
const read = k => { try { return localStorage.getItem('vo.' + k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem('vo.' + k, v); } catch { /* storage blocked: the choice lasts for this visit */ } };
const state = Object.fromEntries(KEYS.map(k => [k, read(k) || DEFAULTS[k]()]));

export const prefs = {
  get: k => state[k],
  set(k, v) {
    if (!KEYS.includes(k)) return;
    v = String(v); if (state[k] === v) return;
    state[k] = v; write(k, v); applyPrefs();
    dispatchEvent(new CustomEvent('vo:prefs', { detail: { key: k, value: v } }));
    if (k === 'theme' || k === 'motion') dispatchEvent(new Event('vo:rerender'));
  },
};

export function applyPrefs() {
  root.dataset.theme = state.theme; root.dataset.size = state.size; root.dataset.terms = state.terms; root.dataset.motion = state.motion; root.dataset.effects = state.effects;
  try { setChartTheme(state.theme); } catch (e) { console.error(e); }
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', state.theme === 'day' ? '#f4f6f9' : '#05060E');
}

// ---------- read aloud ----------
let speaking = false, listenBtn = null;
const LISTEN = '▶ Read this page aloud';
export function stopReading() {
  if (speaking && 'speechSynthesis' in window) speechSynthesis.cancel();
  speaking = false; if (listenBtn) listenBtn.textContent = LISTEN;
}
function readAloud() {
  if (!('speechSynthesis' in window)) { listenBtn.textContent = 'Read-aloud is not supported in this browser'; return; }
  if (speaking) { stopReading(); return; }
  const v = document.getElementById('view');
  const parts = [...v.querySelectorAll('h1, .lead, .hero-lead, .card > h2, .card > .sub, .qn h2, .qn p')].map(e => e.textContent.trim()).filter(Boolean);
  const u = new SpeechSynthesisUtterance(parts.join('. ').slice(0, 6000)); u.lang = 'en-IN'; u.rate = 0.98;
  u.onend = () => { speaking = false; listenBtn.textContent = LISTEN; };
  speechSynthesis.cancel(); speechSynthesis.speak(u); speaking = true; listenBtn.textContent = '■ Stop reading';
}

// ---------- the dock ----------
let built = null;
export function dock() {
  if (built) return built;
  const row = (key, label, opts) => {
    const id = `dock-${key}`;
    const btns = opts.map(([v, text]) => h('button', { type: 'button', 'data-v': v, 'aria-pressed': String(state[key] === v),
      onclick: () => { prefs.set(key, v); btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === state[key]))); } }, text));
    addEventListener('vo:prefs', e => { if (e.detail.key === key) btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === state[key]))); });
    return h('div', { class: 'dock-row' }, h('span', { id }, label), h('div', { class: 'seg', role: 'group', 'aria-labelledby': id }, btns));
  };
  listenBtn = h('button', { type: 'button', class: 'btn dock-listen', onclick: readAloud }, LISTEN);
  const panel = h('div', { class: 'dock-panel', id: 'dock-panel', role: 'dialog', 'aria-labelledby': 'dock-title', hidden: true },
    h('h2', { id: 'dock-title' }, 'Read your way'), h('p', {}, 'Make this site easier to read. Your choices stay on this device.'),
    row('theme', 'Light', [['day', 'Day'], ['night', 'Night']]),
    row('size', 'Text size', [['0', 'A'], ['1', 'A+'], ['2', 'A++']]),
    row('terms', 'Explain science words', [['on', 'On'], ['off', 'Off']]),
    row('motion', 'Motion', [['full', 'Full'], ['calm', 'Calm']]),
    row('effects', 'Effects', [['on', 'On'], ['off', 'Off']]),
    listenBtn);
  const toggle = h('button', { type: 'button', class: 'dock-toggle', 'aria-expanded': 'false', 'aria-controls': 'dock-panel' },
    h('span', { 'aria-hidden': 'true' }, 'Aa'), h('span', { class: 'dock-label' }, 'Read your way'));
  const setOpen = open => { panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => { const open = panel.hidden; setOpen(open); if (open) panel.querySelector('button').focus(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus(); } });
  addEventListener('hashchange', stopReading);
  built = h('div', { class: 'dock' }, panel, toggle);
  document.body.append(built);
  return built;
}
