// Star journey (site v3): a 3D starfield flight. warpTo(href) plays about one second of stars streaking toward the
// viewer over a full-screen overlay, navigates, then fades the overlay out. starDrift(host) is the same field
// drifting very slowly, for behind the hero flame. Idea from Akimitsu Hamamuro's "Space Journey" CodePen (credited in
// REFERENCES.md); code written here from scratch in Canvas 2D. Decoration only, aria-hidden, never takes clicks.
// No flash: the overlay fades in and out over 180-260 ms on the page's own ink colour, and streaks stay below
// full white. Effects off, Calm or reduced motion: warpTo navigates at once and starDrift draws one still frame.
import { register, fxAllowed, onFxChange, visibleWatch, wake } from './loop.js';

const ease = x => x * x * (3 - 2 * x);
function inkColour() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  return v || '#07090f';
}
function field(n, rnd = Math.random) {
  return Array.from({ length: n }, () => ({ x: (rnd() - 0.5) * 2, y: (rnd() - 0.5) * 2, z: rnd(), pz: 0, w: rnd() < 0.2 }));
}
function go(href) {
  if (/^#/.test(href)) { if (location.hash === href) dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = href; }
  else location.href = href;
}

let busy = false;
/** Play ~1 s of warp, then navigate to href. Navigates at once when effects are not allowed. */
export function warpTo(href) {
  if (busy) return;
  const cv = document.createElement('canvas');
  const g = fxAllowed() ? cv.getContext('2d') : null;
  if (!g) { go(href); return; }
  busy = true;
  cv.className = 'fx-warp'; cv.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const W = cv.width = Math.round(innerWidth * dpr), H = cv.height = Math.round(innerHeight * dpr);
  cv.style.background = inkColour();
  cv.style.opacity = '0';
  document.body.append(cv);
  const S = field(Math.round(Math.min(700, (innerWidth * innerHeight) / 1800)));
  S.forEach(s => { s.pz = s.z; });
  const cx = W / 2, cy = H / 2, F = Math.max(W, H) * 0.5;
  let t0 = null, navigated = false;
  const D = 1000, NAV = 820, OUT = 260;
  const un = register({
    active: () => true,
    tick(t) {
      if (t0 == null) t0 = t;
      const e = t - t0;
      cv.style.opacity = String(e < 180 ? ease(e / 180) : e < D ? 1 : Math.max(0, 1 - ease((e - D) / OUT)));
      const speed = 0.002 + 0.03 * ease(Math.min(1, e / 700));   // accelerate into the jump
      g.clearRect(0, 0, W, H);
      g.lineCap = 'round';
      for (const s of S) {
        s.pz = s.z; s.z -= speed * (s.w ? 1.3 : 1);
        if (s.z <= 0.02) { s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; s.z = 1; s.pz = 1; continue; }
        const x = cx + s.x / s.z * F, y = cy + s.y / s.z * F, px = cx + s.x / s.pz * F, py = cy + s.y / s.pz * F;
        const b = Math.min(0.85, (1 - s.z) * 0.95);
        g.strokeStyle = s.w ? `rgba(255,214,170,${b})` : `rgba(236,232,224,${b})`;
        g.lineWidth = Math.max(0.6, (1 - s.z) * 2.2) * dpr;
        g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
      }
      if (!navigated && e >= NAV) { navigated = true; go(href); }
      if (e >= D + OUT) { un(); cv.remove(); busy = false; }
    },
  });
  wake();
  // safety: never leave the overlay up (e.g. the tab was hidden mid-flight)
  setTimeout(() => { if (cv.isConnected) { un(); cv.remove(); busy = false; if (!navigated) go(href); } }, D + OUT + 1500);
}

/** A slow starfield drifting toward the viewer, as a canvas inside host (under its content). */
export function starDrift(host) {
  const el = document.createElement('canvas');
  el.className = 'fx-drift-stars'; el.setAttribute('aria-hidden', 'true');
  host.prepend(el);
  const g = el.getContext('2d');
  if (!g) { el.remove(); return { el, destroy() {} }; }
  let s = 99991; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const S = field(220, rnd);
  let W = 0, H = 0, dpr = 1, inView = true, acc = 1;
  function size() {
    const r = host.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = el.width = Math.max(2, Math.round(r.width * dpr)); H = el.height = Math.max(2, Math.round(r.height * dpr));
  }
  function draw(step) {
    g.clearRect(0, 0, W, H);
    const cx = W * 0.62, cy = H * 0.5, F = Math.max(W, H) * 0.45;
    for (const st of S) {
      st.z -= step; if (st.z <= 0.05) { st.z = 1; st.x = (rnd() - 0.5) * 2; st.y = (rnd() - 0.5) * 2; }
      const x = cx + st.x / st.z * F, y = cy + st.y / st.z * F;
      if (x < 0 || y < 0 || x > W || y > H) continue;
      const a = Math.min(0.7, (1 - st.z) * 0.8), r = Math.max(0.4, (1 - st.z) * 1.5) * dpr;
      g.fillStyle = st.w ? `rgba(255,214,186,${a})` : `rgba(240,236,228,${a})`;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
  }
  size(); draw(0);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { size(); draw(0); }) : null;
  ro?.observe(host);
  const unVis = visibleWatch(host, v => { inView = v; });
  const unFx = onFxChange(() => { if (!fxAllowed()) draw(0); });
  const unReg = register({
    active: () => inView && fxAllowed(),
    tick(t, dt) { acc += dt; if (acc < 1 / 30) return; draw(acc * 0.012); acc = 0; },
  });
  return { el, destroy() { unReg(); unVis(); unFx(); ro?.disconnect(); el.remove(); } };
}
