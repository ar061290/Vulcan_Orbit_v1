// Gravity points (site v3, Home "Why it happens"): motes drift with a gentle cabin airflow and have no "down".
// "Turn gravity on" adds a pull and they fall and pile up on the floor. ILLUSTRATION, NOT DATA: the flow, counts and
// speeds are drawing choices. Idea from Akimitsu Hamamuro's "Gravity Points" CodePen (credited in REFERENCES.md);
// code written here from scratch in Canvas 2D.
// Effects off, Calm or reduced motion: a still frame; the button still switches the still frame between floating and
// settled. Pauses off screen.
import { register, fxAllowed, onFxChange, visibleWatch, wake } from './loop.js';

const LABEL_OFF = 'Illustration: motes drifting with the cabin airflow. With no gravity they have no up or down.';
const LABEL_ON = 'Illustration: with gravity turned on, the same motes fall and pile up on the floor.';

export function gravityPoints() {
  const cv = document.createElement('canvas');
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', LABEL_OFF);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn fx-grav-btn'; btn.setAttribute('aria-pressed', 'false'); btn.textContent = 'Turn gravity on';
  const note = document.createElement('span'); note.className = 'illus-tag'; note.textContent = 'Illustration, not data';
  const cap = document.createElement('figcaption'); cap.className = 'fx-grav-cap';
  cap.append(note, ' Motes ride the fan airflow. Nothing pulls them down until you add gravity.');
  const bar = document.createElement('div'); bar.className = 'fx-grav-bar'; bar.append(btn, cap);
  const fig = document.createElement('figure'); fig.className = 'fx-grav';
  const stage = document.createElement('div'); stage.className = 'fx-grav-stage'; stage.append(cv);
  fig.append(stage, bar);

  const g = cv.getContext('2d');
  if (!g) { stage.textContent = 'This illustration needs a canvas; the rest of the page works without it.'; return fig; }

  let W = 0, H = 0, dpr = 1, M = [], grav = false, inView = true, T = 0, cols = null, colour = null, binW = 6;
  let s = 4242; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const readColours = () => {
    const cs = getComputedStyle(fig);
    colour = { ink: cs.getPropertyValue('--mute').trim() || '#8d96a8', hot: cs.getPropertyValue('--accent').trim() || '#d9480f' };
  };
  function size() {
    const r = stage.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (w === W && h === H && M.length) return;
    W = cv.width = w; H = cv.height = h; binW = 6 * dpr;
    cols = new Float32Array(Math.ceil(W / binW) + 1);
    const n = Math.round(Math.min(220, Math.max(90, (r.width * r.height) / 1500)));
    M = Array.from({ length: n }, () => ({ x: rnd() * W, y: rnd() * H, vx: 0, vy: 0, r: (1 + rnd() * 1.8) * dpr, hot: rnd() < 0.14, rest: false, p: rnd() * 6.28 }));
  }
  function settleAll() {   // the still "gravity on" frame: every mote piled on the floor
    cols.fill(0);
    for (const m of M) { const c = Math.min(cols.length - 1, Math.max(0, Math.floor(m.x / binW))); m.y = H - m.r - cols[c]; cols[c] += m.r * 1.7; m.rest = true; m.vx = m.vy = 0; }
  }
  function floatAll() { s = 4242; for (const m of M) { m.x = rnd() * W; m.y = rnd() * H; m.rest = false; } }
  function draw() {
    g.clearRect(0, 0, W, H);
    for (const m of M) {
      g.fillStyle = m.hot ? colour.hot : colour.ink;
      g.globalAlpha = m.hot ? 0.9 : 0.7;
      g.beginPath(); g.arc(m.x, m.y, m.r, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
  }
  function step(dt) {
    T += dt;
    const u = 26 * dpr;
    for (const m of M) {
      if (m.rest) { if (!grav) { m.rest = false; m.vy = -(10 + rnd() * 20) * dpr; } else continue; }
      // cabin airflow: mostly left to right, curling slowly; no preferred up or down
      const fx = u * (0.7 + 0.5 * Math.sin(m.y / H * 6.283 + T * 0.25 + m.p * 0.2));
      const fy = u * 0.45 * Math.sin(m.x / W * 9 + T * 0.3 + m.p);
      m.vx += (fx - m.vx) * 1.5 * dt;
      if (grav) m.vy += 420 * dpr * dt; else m.vy += (fy - m.vy) * 1.5 * dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x > W + 4) m.x -= W + 8; if (m.x < -4) m.x += W + 8;
      if (grav) {
        const c = Math.min(cols.length - 1, Math.max(0, Math.floor(m.x / binW)));
        const floor = H - m.r - cols[c];
        if (m.y >= floor) { m.y = floor; m.vy = 0; m.vx = 0; m.rest = true; cols[c] += m.r * 1.7; }
      } else { if (m.y > H + 4) m.y -= H + 8; if (m.y < -4) m.y += H + 8; }
    }
  }
  const setGrav = on => {
    grav = on;
    btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Turn gravity off' : 'Turn gravity on';
    cv.setAttribute('aria-label', on ? LABEL_ON : LABEL_OFF);
    if (on) cols?.fill(0);
    if (!fxAllowed()) { if (on) settleAll(); else floatAll(); draw(); } else wake();
  };
  btn.addEventListener('click', () => setGrav(!grav));

  const init = () => { readColours(); size(); if (!fxAllowed() && grav) settleAll(); draw(); };
  requestAnimationFrame(init);   // after the figure is in the page, so it has a width
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { const w = W; size(); if (W !== w) { if (grav) settleAll(); draw(); } }) : null;
  ro?.observe(stage);
  const unVis = visibleWatch(fig, v => { inView = v; });
  const unFx = onFxChange(() => { if (!fig.isConnected) return; readColours(); if (!fxAllowed()) { if (grav) settleAll(); draw(); } });
  let acc = 0, was = false;
  const cleanup = () => { un(); unVis(); unFx(); ro?.disconnect(); };
  const un = register({
    // once the figure has been on the page and is gone (the router swapped pages), drop everything
    active: () => { if (fig.isConnected) was = true; else if (was) { cleanup(); return false; } return fig.isConnected && inView && fxAllowed() && W > 2; },
    tick(t, dt) { acc += dt; if (acc < 1 / 60 - 1e-3) return; step(Math.min(acc, 1 / 30)); acc = 0; draw(); },
  });
  return fig;
}
