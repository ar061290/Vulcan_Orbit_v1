// Background stars (site v3, Night theme only): sparse, tiny, slightly warm dots of varied size and brightness,
// a few with a soft glow, twinkling slowly. Idea from the Drama Collective site's dark theme (credited in
// REFERENCES.md); code written here from scratch. Decoration only: canvas#stars is aria-hidden and ignores the pointer.
// Twinkle is slow and shallow (period 4-11 s, brightness swing at most ±35 % of a dim star), so nothing flashes.
// Effects off, Calm or reduced motion: one still frame. Day theme: hidden.
import { register, fxAllowed, onFxChange, isNight, wake } from './loop.js';

let cv = null, g = null, W = 0, H = 0, dpr = 1, S = [], acc = 0, drawnStill = false, started = false;

function seed() {
  // deterministic layout per viewport so a resize does not shuffle the sky wildly
  let s = 1234567; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = Math.round(Math.min(260, Math.max(60, (innerWidth * innerHeight) / 7000)));
  S = Array.from({ length: n }, () => {
    const big = rnd() < 0.07;
    const warm = rnd();
    return {
      x: rnd() * W, y: rnd() * H,
      r: (big ? 1.1 + rnd() * 0.8 : 0.35 + rnd() * 0.65) * dpr,
      a: big ? 0.55 + rnd() * 0.3 : 0.18 + rnd() * 0.42,
      w: 2 * Math.PI / (4000 + rnd() * 7000), p: rnd() * 6.283, amp: 0.15 + rnd() * 0.2,
      glow: big,
      // slightly warm: from pale cream to soft peach, a few near-white
      c: warm < 0.55 ? [255, 236, 214] : warm < 0.85 ? [255, 214, 186] : [240, 238, 232],
    };
  });
}
function size() {
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
  seed(); drawnStill = false; draw(0, false);
}
function draw(t, live) {
  g.clearRect(0, 0, W, H);
  for (const s of S) {
    const k = live ? 1 - s.amp * (0.5 + 0.5 * Math.sin(t * s.w + s.p)) : 1 - s.amp * 0.5;
    const a = s.a * k, [r, gg, b] = s.c;
    if (s.glow) {
      const R = s.r * 5;
      const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, R);
      gr.addColorStop(0, `rgba(${r},${gg},${b},${a * 0.35})`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = gr; g.fillRect(s.x - R, s.y - R, 2 * R, 2 * R);
    }
    g.fillStyle = `rgba(${r},${gg},${b},${a})`;
    g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill();
  }
}
const live = () => !!cv && isNight() && fxAllowed();
function sync() {
  if (!cv) return;
  const night = isNight();
  cv.hidden = !night;
  if (!night) return;
  if (!fxAllowed()) { if (!drawnStill) { draw(0, false); drawnStill = true; } }
  else { drawnStill = false; wake(); }
}

export function startStars() {
  if (started) return; started = true;
  cv = document.getElementById('stars');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'stars'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv); }
  g = cv.getContext('2d');
  if (!g) { cv.remove(); cv = null; return; }
  size();
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 150); });
  register({
    active: live,
    tick(t, dt) { acc += dt; if (acc < 1 / 30) return; acc = 0; draw(t, true); },   // 30 fps is plenty for a slow twinkle
  });
  onFxChange(sync);
  sync();
}
