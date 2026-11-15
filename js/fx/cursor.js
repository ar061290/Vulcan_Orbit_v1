// Crosshair cursor (site v3): a dot with thin full-viewport hairlines that follow the pointer on a spring.
// Over anything you can press, the dot becomes a flame-orange ring and an outer ring expands. Over text fields and
// readable text the custom cursor hides and the normal text cursor comes back. Over charts the hairlines brighten
// and act as a reading guide. Idea from "Cursor Structule" (Framer marketplace, credited in REFERENCES.md); code
// written here from scratch.
// Only with a fine, hovering pointer and effects allowed (Read your way Effects On, Motion Full, no reduced-motion);
// otherwise the elements are removed and the browser's own cursor returns. Everything is aria-hidden and
// pointer-events:none, so it never intercepts a click.
import { register, fxAllowed, onFxChange, finePointer, wake } from './loop.js';

const root = document.documentElement;
const PRESS = 'a[href], button, summary, [role=button], .chip, input[type=range], select, input[type=checkbox], input[type=radio], label, [data-keynav], .term';
const TYPE = 'input:not([type]), input[type=text], input[type=search], input[type=number], input[type=email], input[type=url], textarea, [contenteditable=""], [contenteditable=true]';
const CHART = 'svg.chart, .chart-wrap, .card canvas, figure canvas';
const READ = 'p, li, td, th, dd, dt, h1, h2, h3, blockquote, figcaption, caption, pre, code';

let els = null, on = false, started = false;
let tx = -100, ty = -100, x = -100, y = -100, vx = 0, vy = 0, seen = false, state = '', settled = true;

function build() {
  const d = (cls) => { const e = document.createElement('div'); e.className = cls; return e; };
  const wrap = d('fx-cur'); wrap.setAttribute('aria-hidden', 'true');
  const hx = d('fx-cur-h'), vy_ = d('fx-cur-v'), dot = d('fx-cur-dot'), outer = d('fx-cur-outer');
  wrap.append(hx, vy_, outer, dot);
  document.body.append(wrap);
  return { wrap, hx, vy: vy_, dot, outer };
}
function setState(s) {
  if (s === state) return; state = s;
  els.wrap.dataset.state = s;
  root.classList.toggle('fx-cur-text', s === 'text');
}
function classify(t) {
  if (!t || t.nodeType !== 1) return 'idle';
  if (t.closest(TYPE)) return 'text';
  if (t.closest(PRESS)) return 'press';
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
const onMove = e => {
  if (!on) return;
  if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') { els.wrap.hidden = true; return; }
  tx = e.clientX; ty = e.clientY;
  if (!seen) { x = tx; y = ty; seen = true; }
  els.wrap.hidden = false;
  setState(classify(e.target));
  settled = false; wake();
};
const onLeave = () => { if (els) els.wrap.hidden = true; seen = false; };
const onDown = () => { if (els) els.wrap.classList.add('down'); };
const onUp = () => { if (els) els.wrap.classList.remove('down'); };

function enable() {
  if (on) return; on = true;
  els ||= build();
  els.wrap.hidden = true; seen = false;
  root.classList.add('fx-cursor');
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  root.addEventListener('pointerleave', onLeave);
  addEventListener('blur', onLeave);
}
function disable() {
  if (!on) return; on = false;
  root.classList.remove('fx-cursor', 'fx-cur-text');
  removeEventListener('pointermove', onMove);
  removeEventListener('pointerdown', onDown);
  removeEventListener('pointerup', onUp);
  root.removeEventListener('pointerleave', onLeave);
  removeEventListener('blur', onLeave);
  els?.wrap.remove(); els = null; state = '';
}
const sync = () => { if (finePointer() && fxAllowed()) enable(); else disable(); };

export function startCursor() {
  if (started) return; started = true;
  register({
    active: () => on && !settled,
    tick(t, dt) {
      // critically-damped-ish spring: quick, no wobble
      const k = 900, c = 52;
      vx += (k * (tx - x) - c * vx) * dt; vy += (k * (ty - y) - c * vy) * dt;
      x += vx * dt; y += vy * dt;
      if (Math.abs(tx - x) < 0.05 && Math.abs(ty - y) < 0.05 && Math.abs(vx) < 1 && Math.abs(vy) < 1) { x = tx; y = ty; vx = vy = 0; settled = true; }
      place();
    },
  });
  onFxChange(sync);
  sync();
}
