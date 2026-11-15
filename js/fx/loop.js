// One shared animation loop for the site v3 signature effects (stars, cursor, fluid, noise, warp, gravity).
// Every effect registers {tick(t, dt), active()}; the loop runs only while at least one effect is active and the tab
// is visible, so nothing spins in a hidden tab or with every effect off screen.
// fxAllowed(): Read your way "Effects: Off", Calm motion and the system reduced-motion setting all stop effects.
const root = document.documentElement;
const mm = q => { try { return matchMedia(q).matches; } catch { return false; } };

export function fxAllowed() {
  return root.dataset.effects !== 'off' && root.dataset.motion !== 'calm' && !mm('(prefers-reduced-motion: reduce)');
}
export const finePointer = () => mm('(pointer:fine) and (hover:hover)');
export const isNight = () => root.dataset.theme === 'night' || (!root.dataset.theme && mm('(prefers-color-scheme: dark)'));

const fxs = new Set();
let raf = 0, last = 0;
function frame(t) {
  raf = 0;
  if (document.hidden) { last = 0; return; }
  const dt = Math.min(0.05, last ? (t - last) / 1000 : 1 / 60); last = t;
  let any = false;
  for (const f of fxs) {
    let on = false;
    try { on = f.active(); } catch { on = false; }
    if (!on) continue;
    any = true;
    try { f.tick(t, dt); } catch (e) { console.error('fx tick failed', e); fxs.delete(f); }
  }
  if (any) raf = requestAnimationFrame(frame); else last = 0;
}
/** Ask the loop to run (call after something became active). */
export function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
/** Register an effect; returns its unregister function. */
export function register(fx) {
  fxs.add(fx); wake();
  return () => { fxs.delete(fx); };
}

const listeners = new Set();
let mo = null;
function fire() { for (const fn of listeners) { try { fn(); } catch (e) { console.error(e); } } wake(); }
/** Call fn when Effects, Motion, Theme or tab visibility changes (and when the reduced-motion setting flips). */
export function onFxChange(fn) {
  listeners.add(fn);
  if (!mo) {
    mo = new MutationObserver(fire);
    mo.observe(root, { attributes: true, attributeFilter: ['data-effects', 'data-motion', 'data-theme'] });
    document.addEventListener('visibilitychange', fire);
    try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', fire); } catch { /* old browser */ }
    try { matchMedia('(pointer:fine) and (hover:hover)').addEventListener('change', fire); } catch { /* old browser */ }
  }
  return () => listeners.delete(fn);
}

/** cb(true|false) when el enters or leaves the viewport. Returns a disconnect function. */
export function visibleWatch(el, cb) {
  if (!('IntersectionObserver' in window)) { cb(true); return () => {}; }
  const io = new IntersectionObserver(es => { for (const e of es) cb(e.isIntersecting); wake(); }, { rootMargin: '80px' });
  io.observe(el);
  return () => io.disconnect();
}

/** Compile a WebGL program; returns null on failure (callers fall back). */
export function program(gl, vs, fs) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return null;
  const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}
/** A full-screen triangle bound to attribute 0. */
export function quad(gl) {
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return b;
}
export function loseContext(gl) { try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ } }
