// Ambient background: slow motes carried by a gentle airflow, nudged by the pointer. Purely decorative
// (canvas#bg, aria-hidden; css/base.css fixes it behind the page). Ported from main's js/bg.js with these changes:
//  - it starts and stops through startBackground() / stopBackground() instead of running on import;
//  - Calm motion (html[data-motion=calm], set by prefs.js, re-checked live) stops the loop AND clears the canvas,
//    so no frozen last frame stays on screen (main's bug); switching back to Full restarts it;
//  - the loop stops while the tab is hidden instead of spinning.
// Flow constants, counts, colours and sizes are main's (decoration, not data). Nothing here flashes: each mote keeps
// a fixed alpha and drifts at a few px per second.
import { calm } from './lib.js';

let cv = null, g = null, raf = 0, running = false;
let W = 0, H = 0, dpr = 1, M = [], mx = -1e4, my = -1e4, last = 0;
let mo = null;

const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr); };
const seed = () => {
  M = Array.from({ length: Math.round(Math.min(90, innerWidth / 16)) }, () => ({
    x: Math.random() * W, y: Math.random() * H, r: (0.6 + Math.random() * 1.8) * dpr, p: Math.random() * 6.28,
    a: 0.08 + Math.random() * 0.22, warm: Math.random() < 0.18, vx: 0, vy: 0,
  }));
};
const clear = () => { if (g) g.clearRect(0, 0, W, H); };
const off = () => calm() || document.hidden;

function frame(t) {
  raf = 0;
  if (!running) return;
  if (off()) { clear(); last = 0; return; }   // Calm or hidden: blank canvas, no loop (restarted by sync())
  const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
  g.clearRect(0, 0, W, H);
  for (const m of M) {
    const fx = (10 + 6 * Math.sin(m.y / H * 6.28 + t / 9000)) * dpr, fy = 5 * Math.sin(m.x / W * 9 + m.p + t / 7000) * dpr;   // slow, curving airflow
    const dx = m.x - mx, dy = m.y - my, d2 = dx * dx + dy * dy, R = 140 * dpr;
    if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 220 * dpr; m.vx += dx / d * f * dt; m.vy += dy / d * f * dt; }
    m.vx += (fx - m.vx) * 1.2 * dt; m.vy += (fy - m.vy) * 1.2 * dt; m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.x > W + 10) m.x = -10; if (m.x < -10) m.x = W + 10; if (m.y > H + 10) m.y = -10; if (m.y < -10) m.y = H + 10;
    g.fillStyle = m.warm ? `rgba(217,89,38,${m.a})` : `rgba(120,165,235,${m.a})`; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 6.283); g.fill();
  }
  raf = requestAnimationFrame(frame);
}

// re-evaluate after a motion or visibility change: clear at once when going still, restart when allowed
function sync() {
  if (!running) return;
  if (off()) { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; clear(); cv.hidden = calm(); return; }
  cv.hidden = false;
  if (!raf) raf = requestAnimationFrame(frame);
}
const onResize = () => { size(); seed(); sync(); };
const onMove = e => { mx = e.clientX * dpr; my = e.clientY * dpr; };
const onOut = () => { mx = my = -1e4; };

/** Create canvas#bg (once) and start the motes. Safe to call more than once. */
export function startBackground() {
  if (running) return;
  cv = document.getElementById('bg');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'bg'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv); }
  g = cv.getContext('2d');
  if (!g) { cv.remove(); cv = null; return; }   // no 2D canvas: no background, nothing else depends on it
  running = true;
  size(); seed();
  addEventListener('resize', onResize);
  addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onOut);
  document.addEventListener('visibilitychange', sync);
  mo = new MutationObserver(sync);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  sync();
}

/** Stop the motes, clear and remove canvas#bg. */
export function stopBackground() {
  running = false;
  if (raf) cancelAnimationFrame(raf); raf = 0; last = 0;
  removeEventListener('resize', onResize);
  removeEventListener('pointermove', onMove);
  document.documentElement.removeEventListener('pointerleave', onOut);
  document.removeEventListener('visibilitychange', sync);
  mo?.disconnect(); mo = null;
  clear();
  (cv || document.getElementById('bg'))?.remove();
  cv = null; g = null; M = [];
}
