// Demo page background: a warp-speed starfield. Our own code; the idea (stars flying at the viewer, the pointer
// steering the direction of travel) is inspired by "Space Journey" by Akimitsu Hamamuro (codepen.io/akm2/pen/RwQXLdP).
// Decoration only: it shows no data.
//   - stars in 3D, projected toward a vanishing point; each is drawn as a streak from last frame's position
//   - the pointer (or a finger) steers the vanishing point, eased by a spring
//   - press and hold anywhere outside a control = warp; scrolling adds a little speed
//   - prefers-reduced-motion: one still frame, no animation; paused while the tab is hidden
const canvas = document.createElement('canvas');
canvas.className = 'starfield';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);
const ctx = canvas.getContext('2d', { alpha: false });
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

const N = 900, DEPTH = 1000, BASE = 2.2, WARP = 34;
let W = 0, H = 0, dpr = 1, stars = [];
let speed = BASE, target = BASE, warp = false, scrollBoost = 0, lastY = scrollY;
const vp = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 };         // vanishing point offset (px) and its spring state

function rnd(a, b) { return a + Math.random() * (b - a); }
function spawn(s, anywhere) {
  s.x = rnd(-1, 1) * W; s.y = rnd(-1, 1) * H;
  s.z = anywhere ? rnd(1, DEPTH) : DEPTH;
  s.pz = s.z; s.hue = Math.random() < 0.12 ? (Math.random() < 0.5 ? 18 : 222) : 0;   // a few warm/cold stars: fire orange, orbit blue
  return s;
}
function resize() {
  dpr = Math.min(1.5, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!stars.length) stars = Array.from({ length: N }, () => spawn({}, true));
}
function project(s, z) {
  const k = 280 / z;
  return [W / 2 + vp.x + s.x * k * 0.5, H / 2 + vp.y + s.y * k * 0.5];
}
function frame(still) {
  // spring the vanishing point toward the pointer, ease the speed toward its target
  vp.vx += (vp.tx - vp.x) * 0.02; vp.vy += (vp.ty - vp.y) * 0.02; vp.vx *= 0.82; vp.vy *= 0.82;
  vp.x += vp.vx; vp.y += vp.vy;
  scrollBoost *= 0.92;
  target = (warp ? WARP : BASE) + scrollBoost;
  speed += (target - speed) * (warp ? 0.06 : 0.04);

  ctx.fillStyle = `rgba(5,6,14,${still ? 1 : Math.max(0.28, 0.9 - speed / 60)})`;   // longer trails at warp
  ctx.fillRect(0, 0, W, H);
  const stretch = Math.min(1, speed / WARP);
  for (const s of stars) {
    s.pz = s.z; s.z -= still ? 0 : speed;
    if (s.z < 1) { spawn(s, false); continue; }
    const [x, y] = project(s, s.z), [px, py] = project(s, s.pz + speed * (1 + stretch * 3));
    if (x < -50 || x > W + 50 || y < -50 || y > H + 50) { spawn(s, false); continue; }
    const near = 1 - s.z / DEPTH, a = Math.min(1, near * 1.4 + 0.08);
    ctx.strokeStyle = s.hue ? `hsla(${s.hue},95%,${s.hue === 18 ? 62 : 74}%,${a})` : `rgba(237,232,223,${a})`;
    ctx.lineWidth = Math.max(0.6, near * 2.4);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
  }
}
let raf = 0;
function loop() { frame(false); raf = requestAnimationFrame(loop); }
function start() { cancelAnimationFrame(raf); if (reduce.matches) { frame(true); return; } raf = requestAnimationFrame(loop); }

// input: steer with pointer or finger; hold for warp (not on links, buttons, inputs, or text you might select)
const steer = (cx, cy) => { vp.tx = (cx - W / 2) * -0.35; vp.ty = (cy - H / 2) * -0.35; };
addEventListener('pointermove', e => steer(e.clientX, e.clientY), { passive: true });
addEventListener('pointerdown', e => {
  if (e.target.closest('a, button, input, select, textarea, label, svg, .panel')) return;
  steer(e.clientX, e.clientY); warp = true;
}, { passive: true });
['pointerup', 'pointercancel', 'blur'].forEach(t => addEventListener(t, () => { warp = false; }, { passive: true }));
addEventListener('scroll', () => { const d = Math.abs(scrollY - lastY); lastY = scrollY; scrollBoost = Math.min(18, scrollBoost + d * 0.08); }, { passive: true });
addEventListener('resize', () => { resize(); if (reduce.matches) frame(true); });
document.addEventListener('visibilitychange', () => (document.hidden ? cancelAnimationFrame(raf) : start()));
reduce.addEventListener?.('change', start);

resize(); start();
