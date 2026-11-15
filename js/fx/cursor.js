// Crosshair cursor (site v3, merged into the UI-lock look): a dot with 1 px full-viewport hairlines that follow the
// pointer on a spring. Over anything you can press, the dot opens into a ring and a fire-orange (#FF7A3D) outer ring
// expands. Over a drag surface (Home story, Earth globe, Find it scope, Assess plate, Respond droplet, History and
// Model-card tracks, dials) it shows a "grab" state, which closes when you press. Over text fields and readable text
// the custom cursor hides and the normal text cursor comes back. Over charts the hairlines brighten and act as a
// reading guide. Idea from "Cursor Structule" (Framer marketplace, credited in REFERENCES.md); code written here.
// Only with a fine, hovering pointer and effects allowed (Read your way Effects On, Motion Full, no reduced-motion);
// otherwise the elements are removed and the browser's own cursor returns. Never on touch or a coarse pointer.
// The native cursor is hidden ONLY while this effect is proven running (html.fx-cur-live is set after a frame has
// actually been drawn, and is dropped the moment the loop stalls or a tick fails), so a script error can never leave
// the reader with no cursor at all.
// Magnetic buttons (js/engine.js) lean up to 6 px toward the pointer: the crosshair reads the POINTER position, never
// an element's box, and a short hold on leaving the "press" state stops the hit test flickering at a leaning edge.
// Everything is aria-hidden and pointer-events:none, so it never intercepts a click.
import { register, fxAllowed, onFxChange, finePointer, wake } from './loop.js';

const root = document.documentElement;
const PRESS = 'a[href], button, summary, [role=button], [role=tab], .chip, input[type=range], select, input[type=checkbox], input[type=radio], label, [data-keynav], .term';
const TYPE = 'input:not([type]), input[type=text], input[type=search], input[type=number], input[type=email], input[type=url], textarea, [contenteditable=""], [contenteditable=true]';
const DRAG = '[data-drag], [role=slider], .story-drag, .ea-globe, .det-scope canvas, .as-plate-svg, .as-start, .fr-stage, .mem-track.live, .mcd-track.live, .xc-view, .fl-simcv, .cab3d-cv, .hero-gl canvas';
const CHART = 'svg.chart, .chart-wrap, .card canvas, figure canvas';
const READ = 'p, li, td, th, dd, dt, h1, h2, h3, blockquote, figcaption, caption, pre, code';

let els = null, on = false, started = false, live = false;
let tx = -100, ty = -100, x = -100, y = -100, vx = 0, vy = 0, seen = false, state = '', settled = true;
let lastTick = 0, holdT = 0;

function build() {
  const d = (cls) => { const e = document.createElement('div'); e.className = cls; return e; };
  const wrap = d('fx-cur'); wrap.setAttribute('aria-hidden', 'true');
  const hx = d('fx-cur-h'), vy_ = d('fx-cur-v'), dot = d('fx-cur-dot'), outer = d('fx-cur-outer');
  wrap.append(hx, vy_, outer, dot);
  document.body.append(wrap);
  return { wrap, hx, vy: vy_, dot, outer };
}
function setLive(v) { if (v === live) return; live = v; root.classList.toggle('fx-cur-live', v); }
function applyState(s) {
  if (s === state) return; state = s;
  els.wrap.dataset.state = s;
  root.classList.toggle('fx-cur-text', s === 'text');
}
function setState(s) {
  clearTimeout(holdT);
  // leaving "press" waits 90 ms: a magnetic button leaning under a still pointer must not flicker the ring
  if (state === 'press' && s !== 'press' && s !== 'text') { holdT = setTimeout(() => { if (els) applyState(s); }, 90); return; }
  applyState(s);
}
function classify(t) {
  if (!t || t.nodeType !== 1) return 'idle';
  if (t.closest(TYPE)) return 'text';
  if (t.closest(PRESS)) return 'press';
  if (t.closest(DRAG)) return 'drag';
  if (t.closest(CHART)) return 'chart';
  if (t.closest(READ)) return 'text';
  return 'idle';
}
function place() {
  const X = Math.round(x * 10) / 10, Y = Math.round(y * 10) / 10;
  els.hx.style.transform = `translate3d(0,${Y}px,0)`;
  els.vy.style.transform = `translate3d(${X}px,0,0)`;
  els.dot.style.transform = els.outer.style.transform = `translate3d(${X}px,${Y}px,0)`;
}
const hide = () => { if (els) els.wrap.hidden = true; seen = false; setLive(false); };
const onMove = e => {
  if (!on) return;
  if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') { hide(); return; }
  // a move arrived while the spring was still due to be ticking, but no tick ran for 400 ms: the loop is stalled,
  // so give the native cursor back until it ticks again
  if (!settled && live && performance.now() - lastTick > 400) setLive(false);
  tx = e.clientX; ty = e.clientY;
  if (!seen) { x = tx; y = ty; seen = true; }
  els.wrap.hidden = false;
  setState(classify(e.target));
  settled = false; wake();
};
const onDown = () => { if (els) els.wrap.classList.add('down'); };
const onUp = () => { if (els) els.wrap.classList.remove('down'); };
const onOut = e => { if (!e.relatedTarget) hide(); };

function enable() {
  if (on) return;
  try { els ||= build(); } catch (e) { console.warn('cursor effect not built', e); return; }
  on = true;
  els.wrap.hidden = true; seen = false;
  root.classList.add('fx-cursor');
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('pointercancel', onUp, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  addEventListener('blur', hide);
}
function disable() {
  if (!on) return; on = false;
  clearTimeout(holdT); setLive(false);
  root.classList.remove('fx-cursor', 'fx-cur-text');
  removeEventListener('pointermove', onMove);
  removeEventListener('pointerdown', onDown);
  removeEventListener('pointerup', onUp);
  removeEventListener('pointercancel', onUp);
  document.removeEventListener('pointerout', onOut);
  removeEventListener('blur', hide);
  els?.wrap.remove(); els = null; state = ''; settled = true;
}
const sync = () => { if (finePointer() && fxAllowed()) enable(); else disable(); };

export function startCursor() {
  if (started) return; started = true;
  register({
    active: () => on && !settled,
    tick(t, dt) {
      try {
        // critically-damped-ish spring: quick, no wobble
        const k = 900, c = 52;
        vx += (k * (tx - x) - c * vx) * dt; vy += (k * (ty - y) - c * vy) * dt;
        x += vx * dt; y += vy * dt;
        if (Math.abs(tx - x) < 0.05 && Math.abs(ty - y) < 0.05 && Math.abs(vx) < 1 && Math.abs(vy) < 1) { x = tx; y = ty; vx = vy = 0; settled = true; }
        place();
        lastTick = performance.now();
        if (!els.wrap.hidden) setLive(true);
      } catch (e) { console.warn('cursor effect stopped', e); disable(); }
    },
  });
  onFxChange(sync);
  sync();
}
