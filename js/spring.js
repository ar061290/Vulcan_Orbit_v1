// Touch physics for the whole site (feat/ui-lock): pointer-events drag with velocity, a spring settle
// (stiffness 170, damping 26) and rubber-band edges. Arrow keys mirror every drag; Enter mirrors every tap.
// Calm motion / reduced motion: no inertia and no spring, values jump straight to where they settle.
const calm = () => document.documentElement.dataset.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const K = 170, D = 26;

/** Spring-animate value x toward target, calling set(x) each frame. Returns a cancel function. */
export function spring(x, v, target, set, done) {
  if (calm()) { set(target); done?.(target); return () => {}; }
  let raf = 0, last = 0;
  const step = now => {
    const dt = last ? Math.min(.032, (now - last) / 1000) : .016; last = now;
    v += (-K * (x - target) - D * v) * dt; x += v * dt; set(x);
    if (Math.abs(x - target) < .3 && Math.abs(v) < 2) { set(target); done?.(target); raf = 0; return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/**
 * draggable(el, {axis:'x'|'y', bounds:[min,max], snap:number[]|fn, onMove(pos), onEnd(pos), step, value})
 * Drag el along an axis. Past the bounds it rubber-bands; on release it flings with its velocity, then springs to the
 * nearest snap point (or back inside the bounds). Arrow keys move by `step` (default 40 px) to the next snap point.
 * Returns {set(pos, animate), get(), destroy()}.
 */
export function draggable(el, { axis = 'x', bounds = [-Infinity, Infinity], snap = null, onMove = () => {}, onEnd = () => {}, step = 40, value = 0, touch = null, keys = true } = {}) {
  let pos = value, d = null, cancel = () => {};
  const B = () => (typeof bounds === 'function' ? bounds() : bounds);
  const rubber = p => { const [a, b] = B(); if (p < a) return a - (a - p) * .35; if (p > b) return b + (p - b) * .35; return p; };
  const near = p => { const pts = typeof snap === 'function' ? snap() : snap; if (!pts?.length) { const [a, b] = B(); return Math.max(a, Math.min(b, p)); } return pts.reduce((m, s) => (Math.abs(s - p) < Math.abs(m - p) ? s : m), pts[0]); };
  const apply = p => { pos = p; onMove(p); };
  const settle = (v = 0) => { cancel(); const target = near(pos + v * .18); cancel = spring(pos, v, target, apply, onEnd); };
  const down = e => {
    if (e.button > 0) return;
    cancel(); d = { s: axis === 'x' ? e.clientX : e.clientY, p0: pos, t: performance.now(), last: axis === 'x' ? e.clientX : e.clientY, v: 0, moved: false };
    try { el.setPointerCapture(e.pointerId); } catch { /* pointer gone */ }
  };
  const move = e => {
    if (!d) return;
    const c = axis === 'x' ? e.clientX : e.clientY, now = performance.now(), dt = Math.max(1, now - d.t);
    d.v = .8 * ((c - d.last) / dt * 1000) + .2 * d.v; d.last = c; d.t = now;
    if (Math.abs(c - d.s) > 3) d.moved = true;
    apply(rubber(d.p0 + (c - d.s)));
  };
  const up = () => { if (!d) return; const v = calm() ? 0 : d.v; d = null; settle(v); };
  const key = e => {
    const dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!dir || (axis === 'x') !== (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault(); cancel();
    const pts = typeof snap === 'function' ? snap() : snap;
    let target;
    if (pts?.length) { const sorted = [...pts].sort((a, b) => a - b); target = dir > 0 ? sorted.find(s => s > pos + .5) ?? sorted.at(-1) : [...sorted].reverse().find(s => s < pos - .5) ?? sorted[0]; }
    else { const [a, b] = B(); target = Math.max(a, Math.min(b, pos + dir * step)); }
    cancel = spring(pos, 0, target, apply, onEnd);
  };
  el.style.touchAction = touch ?? (axis === 'x' ? 'pan-y' : 'pan-x');
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); if (keys) el.addEventListener('keydown', key);
  return {
    get: () => pos,
    set(p, animate = true) { cancel(); if (animate) cancel = spring(pos, 0, p, apply, onEnd); else { apply(p); onEnd(p); } },
    destroy() { cancel(); el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('keydown', key); },
  };
}

/**
 * dial(el, {min, max, value, detents:number[], step, label, format, onChange(v)})
 * A rotary control: vertical or circular drag turns it, it snaps to the nearest detent on release, and it is a real
 * slider for assistive tech (role=slider, arrows, Home/End). Returns {set(v), get()}.
 */
export function dial(el, { min = 0, max = 1, value = min, detents = null, step = null, label = '', format = v => String(v), onChange = () => {} } = {}) {
  let v = value, d = null, cancel = () => {};
  const span = max - min, st = step ?? span / 100;
  const clampv = x => Math.max(min, Math.min(max, x));
  const nearest = x => (detents?.length ? detents.reduce((m, s) => (Math.abs(s - x) < Math.abs(m - x) ? s : m), detents[0]) : Math.round((x - min) / st) * st + min);
  el.setAttribute('role', 'slider'); el.tabIndex = 0;
  el.setAttribute('aria-valuemin', String(min)); el.setAttribute('aria-valuemax', String(max)); if (label) el.setAttribute('aria-label', label);
  const render = (x, fire = true) => {
    v = x;
    el.style.setProperty('--turn', String((x - min) / span));
    el.setAttribute('aria-valuenow', String(+x.toFixed(4))); el.setAttribute('aria-valuetext', format(x));
    if (fire) onChange(x);
  };
  const angleOf = e => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  el.addEventListener('pointerdown', e => { if (e.button > 0) return; cancel(); d = { y: e.clientY, a: angleOf(e), v0: v }; try { el.setPointerCapture(e.pointerId); } catch { /* gone */ } });
  el.addEventListener('pointermove', e => {
    if (!d) return;
    // vertical drag (200 px = full range) plus circular motion around the centre
    let da = angleOf(e) - d.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    const x = clampv(d.v0 + ((d.y - e.clientY) / 200 + da / (1.5 * Math.PI)) * span);
    d.a = angleOf(e); d.y = e.clientY; d.v0 = x; render(x);
  });
  const up = () => { if (!d) return; d = null; const t = nearest(v); cancel(); cancel = spring(v * 100, 0, t * 100, x => render(x / 100)); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('keydown', e => {
    let t = null;
    const sorted = detents?.length ? [...detents].sort((a, b) => a - b) : null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') t = sorted ? sorted.find(s => s > v + 1e-9) ?? max : v + st;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') t = sorted ? [...sorted].reverse().find(s => s < v - 1e-9) ?? min : v - st;
    else if (e.key === 'Home') t = min; else if (e.key === 'End') t = max;
    if (t == null) return; e.preventDefault(); cancel(); render(clampv(t));
  });
  el.style.touchAction = 'none';
  render(v, false);
  return { get: () => v, set: x => { cancel(); render(clampv(x), false); } };
}
