// "Read your way" panel: theme, text size, plain-language terms, motion and read-aloud. Choices are kept in this browser only.
import { h } from './lib.js';
import { setChartTheme } from './charts.js';
const root = document.documentElement;
const store = { get: k => { try { return localStorage.getItem('vo.' + k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem('vo.' + k, v); } catch {} } };
const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
const prefersCalm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {
  theme: store.get('theme') || (prefersDark ? 'night' : 'day'),
  size: store.get('size') || '0',
  terms: store.get('terms') || 'on',
  motion: store.get('motion') || (prefersCalm ? 'calm' : 'full'),
};
const apply = () => {
  root.dataset.theme = state.theme; root.dataset.size = state.size; root.dataset.terms = state.terms; root.dataset.motion = state.motion;
  setChartTheme(state.theme);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', state.theme === 'day' ? '#f3f0e8' : '#070a12');
};
apply();
export const calm = () => state.motion === 'calm';

const seg = (key, label, opts, rerender) => {
  const btns = opts.map(([v, text]) => h('button', { type: 'button', 'aria-pressed': String(state[key] === v), onclick: () => {
    state[key] = v; store.set(key, v); apply(); btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    if (rerender) dispatchEvent(new Event('vo:rerender'));
  }, 'data-v': v }, text));
  return h('div', { class: 'dock-row', role: 'group', 'aria-label': label }, h('span', {}, label), h('div', { class: 'seg' }, ...btns));
};
let speaking = false;
const listen = h('button', { type: 'button', class: 'btn', style: 'width:100%;justify-content:center', onclick: () => {
  if (!('speechSynthesis' in window)) { listen.textContent = 'Read-aloud is not supported in this browser'; return; }
  if (speaking) { speechSynthesis.cancel(); speaking = false; listen.textContent = '▶ Read this page aloud'; return; }
  const v = document.getElementById('view');
  const parts = [...v.querySelectorAll('h1, .lead, .hero-lead, .card > h2, .card > .sub, .qn h2, .qn p')].map(e => e.textContent.replace(/FIG\.\s*\d+/, '').trim()).filter(Boolean);
  const u = new SpeechSynthesisUtterance(parts.join('. ').slice(0, 6000)); u.lang = 'en-IN'; u.rate = 0.98;
  u.onend = () => { speaking = false; listen.textContent = '▶ Read this page aloud'; };
  speechSynthesis.cancel(); speechSynthesis.speak(u); speaking = true; listen.textContent = '■ Stop reading';
} }, '▶ Read this page aloud');
addEventListener('hashchange', () => { if (speaking) { speechSynthesis.cancel(); speaking = false; listen.textContent = '▶ Read this page aloud'; } });

const panel = h('div', { class: 'dock-panel', id: 'dock-panel', role: 'dialog', 'aria-label': 'Read your way', hidden: true },
  h('h2', {}, 'Read your way'), h('p', {}, 'Make this site easier to read. Your choices stay on this device.'),
  seg('theme', 'Light', [['day', 'Day'], ['night', 'Night']], true),
  seg('size', 'Text size', [['0', 'A'], ['1', 'A+'], ['2', 'A++']]),
  seg('terms', 'Explain science words', [['on', 'On'], ['off', 'Off']]),
  seg('motion', 'Motion', [['full', 'Full'], ['calm', 'Calm']], true),
  listen);
const toggle = h('button', { type: 'button', class: 'dock-toggle', 'aria-expanded': 'false', 'aria-controls': 'dock-panel', onclick: () => {
  const open = panel.hidden; panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('button').focus();
} }, h('span', { 'aria-hidden': 'true' }, 'Aa'), 'Read your way');
addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
document.body.append(h('div', { class: 'dock' }, panel, toggle));
