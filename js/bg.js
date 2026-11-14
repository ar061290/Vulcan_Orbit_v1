// Ambient background: slow motes carried by a gentle airflow, nudged by the pointer. Purely decorative.
const cv = document.createElement('canvas'); cv.id = 'bg'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv);
const ctx = cv.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let W, H, dpr, M = [], mx = -1e4, my = -1e4, last = 0;
const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; };
const seed = () => { M = Array.from({ length: Math.round(Math.min(90, innerWidth / 16)) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: (0.6 + Math.random() * 1.8) * dpr, p: Math.random() * 6.28, a: 0.08 + Math.random() * 0.22, warm: Math.random() < 0.18, vx: 0, vy: 0 })); };
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
  if (!document.hidden) {
    ctx.clearRect(0, 0, W, H);
    for (const m of M) {
      const fx = (10 + 6 * Math.sin(m.y / H * 6.28 + t / 9000)) * dpr, fy = 5 * Math.sin(m.x / W * 9 + m.p + t / 7000) * dpr;   // slow, curving airflow
      const dx = m.x - mx, dy = m.y - my, d2 = dx * dx + dy * dy, R = 140 * dpr;
      if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 220 * dpr; m.vx += dx / d * f * dt; m.vy += dy / d * f * dt; }
      m.vx += (fx - m.vx) * 1.2 * dt; m.vy += (fy - m.vy) * 1.2 * dt; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x > W + 10) m.x = -10; if (m.x < -10) m.x = W + 10; if (m.y > H + 10) m.y = -10; if (m.y < -10) m.y = H + 10;
      ctx.fillStyle = m.warm ? `rgba(217,89,38,${m.a})` : `rgba(120,165,235,${m.a})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
    }
  }
  if (!reduce) requestAnimationFrame(frame);
}
size(); seed(); requestAnimationFrame(frame);
addEventListener('resize', () => { size(); seed(); });
addEventListener('pointermove', e => { mx = e.clientX * dpr; my = e.clientY * dpr; }, { passive: true });
addEventListener('pointerleave', () => { mx = my = -1e4; });
