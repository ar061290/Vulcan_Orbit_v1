// Fire fluid trail (site v3, Home story only): moving the pointer leaves curling trails that glow ember to orange to
// amber, cool into dark smoke and fade. A small 2D fluid solver on the GPU, written here from scratch after Jos Stam's
// "Stable Fluids" method (semi-Lagrangian advection, vorticity confinement, Jacobi pressure solve) and the idea of the
// "Flowing Cursor" Framer component (both credited in REFERENCES.md). Illustration only: nothing here is data.
//
// Readability: the canvas sits UNDER the page text. The display shader caps the light it adds so that the colour
// behind text never gets brighter than relative luminance 0.10; text at #eef1f7 then keeps at least 6:1 (WCAG AA).
// It runs only with a fine pointer, effects allowed and the Night theme; it pauses off screen and stops 6 s after the
// last pointer move, when the trail has faded. Velocity runs on a coarse grid (1/8 of CSS px), dye at half res.
import { register, fxAllowed, onFxChange, finePointer, isNight, visibleWatch, program, quad, loseContext, wake } from './loop.js';

const VS = `#version 300 es
in vec2 p; out vec2 uv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB; uniform vec2 tx;
void main(){ uv = p * .5 + .5; vL = uv - vec2(tx.x, 0.); vR = uv + vec2(tx.x, 0.); vT = uv + vec2(0., tx.y); vB = uv - vec2(0., tx.y); gl_Position = vec4(p, 0., 1.); }`;
const H = `#version 300 es
precision highp float; precision highp sampler2D; in vec2 uv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB; out vec4 o;`;
const SPLAT = `${H} uniform sampler2D tg; uniform float asp, rad; uniform vec2 pt; uniform vec3 col;
void main(){ vec2 d = uv - pt; d.x *= asp; o = texture(tg, uv) + vec4(col * exp(-dot(d, d) / rad), 0.); }`;
const ADV_VEL = `${H} uniform sampler2D vel; uniform vec2 vtx; uniform float dt, diss;
void main(){ vec2 c = uv - dt * texture(vel, uv).xy * vtx; o = diss * texture(vel, c); }`;
// dye: r = heat, g = smoke. Heat cools each step and the lost heat turns into smoke, which fades more slowly.
const ADV_DYE = `${H} uniform sampler2D vel, src; uniform vec2 vtx; uniform float dt, hd, sd;
void main(){ vec2 c = uv - dt * texture(vel, uv).xy * vtx; vec2 d = texture(src, c).rg; float h = d.r * hd; float s = d.g * sd + (d.r - h) * .85; o = vec4(h, min(s, 1.5), 0., 1.); }`;
const CURL = `${H} uniform sampler2D vel;
void main(){ float L = texture(vel, vL).y, R = texture(vel, vR).y, T = texture(vel, vT).x, B = texture(vel, vB).x; o = vec4(.5 * (R - L - T + B), 0., 0., 1.); }`;
const VORT = `${H} uniform sampler2D vel, crl; uniform float k, dt;
void main(){ float L = texture(crl, vL).x, R = texture(crl, vR).x, T = texture(crl, vT).x, B = texture(crl, vB).x, C = texture(crl, uv).x;
  vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= k * C; f.y *= -1.;
  o = vec4(texture(vel, uv).xy + f * dt, 0., 1.); }`;
const DIV = `${H} uniform sampler2D vel;
void main(){ float L = texture(vel, vL).x, R = texture(vel, vR).x, T = texture(vel, vT).y, B = texture(vel, vB).y;
  vec2 C = texture(vel, uv).xy; if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
  o = vec4(.5 * (R - L + T - B), 0., 0., 1.); }`;
const FADE = `${H} uniform sampler2D tg; uniform float v; void main(){ o = v * texture(tg, uv); }`;
const PRES = `${H} uniform sampler2D prs, dv;
void main(){ float L = texture(prs, vL).x, R = texture(prs, vR).x, T = texture(prs, vT).x, B = texture(prs, vB).x; o = vec4((L + R + B + T - texture(dv, uv).x) * .25, 0., 0., 1.); }`;
const GRAD = `${H} uniform sampler2D prs, vel;
void main(){ float L = texture(prs, vL).x, R = texture(prs, vR).x, T = texture(prs, vT).x, B = texture(prs, vB).x; o = vec4(texture(vel, uv).xy - .5 * vec2(R - L, T - B), 0., 1.); }`;
// fire palette: ember #5a0f05 -> orange #d9480f -> amber #f59f00 -> near-white #fff3d6; smoke grey; premultiplied out
const SHOW = `${H} uniform sampler2D dye;
vec3 fire(float t){ vec3 a = vec3(.353,.059,.020), b = vec3(.851,.282,.059), c = vec3(.961,.624,0.), d = vec3(1.,.953,.839);
  return t < .4 ? mix(a, b, t / .4) : t < .75 ? mix(b, c, (t - .4) / .35) : mix(c, d, (t - .75) / .25); }
void main(){ vec2 d = texture(dye, uv).rg; float h = clamp(d.r, 0., 1.), s = clamp(d.g, 0., 1.);
  float ha = smoothstep(.02, .6, h) * .62; float sa = smoothstep(0., .8, s) * .3;
  vec3 c = fire(h) * ha + vec3(.24, .22, .21) * sa * (1. - ha); float a = ha + sa * (1. - ha);
  vec3 lin = pow(max(c, 0.), vec3(2.2)); float Y = dot(lin, vec3(.2126, .7152, .0722));
  if (Y > .1) { float f = pow(.1 / Y, 1. / 2.2); c *= f; }
  o = vec4(c, a); }`;

export function fluidTrail(host) {
  const el = document.createElement('canvas');
  el.className = 'fx-fluid'; el.setAttribute('aria-hidden', 'true');
  host.prepend(el);
  let gl = null, P = null, ok = false, inView = true, lastInput = -1e9, now = 0, enabled = false;
  let sim = null, dye = null, vel = null, prs = null, dv = null, crl = null, sw = 0, sh = 0, dw = 0, dh = 0;
  const pts = [];   // pending pointer splats

  try {
    gl = el.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  } catch { gl = null; }
  if (gl && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) {
    const mk = fs => program(gl, VS, fs);
    P = { splat: mk(SPLAT), advV: mk(ADV_VEL), advD: mk(ADV_DYE), curl: mk(CURL), vort: mk(VORT), div: mk(DIV), fade: mk(FADE), pres: mk(PRES), grad: mk(GRAD), show: mk(SHOW) };
    ok = Object.values(P).every(Boolean);
    if (ok) quad(gl);
  }
  if (!ok) { loseContext(gl); el.hidden = true; return { el, destroy() { el.remove(); } }; }

  function fbo(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h, free() { gl.deleteTexture(t); gl.deleteFramebuffer(f); } };
  }
  const dbl = (w, h) => { let a = fbo(w, h), b = fbo(w, h); return { get r() { return a; }, get w() { return b; }, swap() { [a, b] = [b, a]; }, free() { a.free(); b.free(); } }; };
  function alloc() {
    const r = host.getBoundingClientRect();
    const cw = Math.max(2, Math.round(r.width)), ch = Math.max(2, Math.round(r.height));
    const nDw = Math.max(2, Math.round(Math.min(cw / 2, 720))), nDh = Math.max(2, Math.round(nDw * ch / cw));
    const nSw = Math.max(2, Math.round(Math.min(cw / 8, 180))), nSh = Math.max(2, Math.round(nSw * ch / cw));
    if (nDw === dw && nDh === dh && sim) return;
    [dye, vel, prs, dv, crl].forEach(x => x?.free());
    dw = nDw; dh = nDh; sw = nSw; sh = nSh;
    el.width = dw; el.height = dh;
    dye = dbl(dw, dh); vel = dbl(sw, sh); prs = dbl(sw, sh); dv = fbo(sw, sh); crl = fbo(sw, sh); sim = true;
  }
  function run(prog, target, uni, w, h) {
    gl.useProgram(prog.p);
    let unit = 0;
    for (const [k, v] of Object.entries(uni)) {
      const loc = prog.u[k]; if (loc == null) continue;
      if (v && v.t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.t); gl.uniform1i(loc, unit++); }
      else if (Array.isArray(v)) (v.length === 2 ? gl.uniform2f : gl.uniform3f).call(gl, loc, ...v);
      else gl.uniform1f(loc, v);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, w ?? target.w, h ?? target.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function step(dt) {
    const vtx = [1 / sw, 1 / sh], asp = dw / dh;
    for (const s of pts.splice(0)) {
      run(P.splat, vel.w, { tx: vtx, tg: vel.r, asp, rad: 0.0009, pt: [s.x, s.y], col: [s.dx * 2600, s.dy * 2600, 0] }); vel.swap();
      run(P.splat, dye.w, { tx: [1 / dw, 1 / dh], tg: dye.r, asp, rad: 0.0006, pt: [s.x, s.y], col: [Math.min(0.75, 0.3 + s.sp * 30), 0.05, 0] }); dye.swap();
    }
    run(P.curl, crl, { tx: vtx, vel: vel.r });
    run(P.vort, vel.w, { tx: vtx, vel: vel.r, crl, k: 22, dt }); vel.swap();
    run(P.div, dv, { tx: vtx, vel: vel.r });
    run(P.fade, prs.w, { tx: vtx, tg: prs.r, v: 0.8 }); prs.swap();
    for (let i = 0; i < 14; i++) { run(P.pres, prs.w, { tx: vtx, prs: prs.r, dv }); prs.swap(); }
    run(P.grad, vel.w, { tx: vtx, prs: prs.r, vel: vel.r }); vel.swap();
    const k = dt * 60;
    run(P.advV, vel.w, { tx: vtx, vel: vel.r, vtx, dt, diss: Math.pow(0.985, k) }); vel.swap();
    run(P.advD, dye.w, { tx: [1 / dw, 1 / dh], vel: vel.r, src: dye.r, vtx, dt, hd: Math.pow(0.95, k), sd: Math.pow(0.982, k) }); dye.swap();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, dw, dh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    run(P.show, null, { tx: [1 / dw, 1 / dh], dye: dye.r }, dw, dh);
    gl.disable(gl.BLEND);
  }
  function clearAll() {
    if (!sim || gl.isContextLost()) return;
    [dye.r, dye.w, vel.r, vel.w, prs.r, prs.w].forEach(b => { gl.bindFramebuffer(gl.FRAMEBUFFER, b.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, dw, dh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  }

  let px = null, py = null;
  const onMove = e => {
    if (!enabled || (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
    const r = host.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) { px = null; return; }
    if (px != null) {
      const dx = x - px, dy = y - py, sp = Math.hypot(dx, dy);
      // splat along the segment, so a fast flick leaves one continuous ribbon instead of separate puffs
      if (sp > 0.0004) { const n = Math.min(6, Math.ceil(sp / 0.012)); for (let i = 1; i <= n && pts.length < 24; i++) pts.push({ x: px + dx * i / n, y: py + dy * i / n, dx: dx / n, dy: dy / n, sp: sp / n }); }
    }
    px = x; py = y; lastInput = now; wake();
  };
  const onOut = () => { px = null; };
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerleave', onOut);

  const allowed = () => finePointer() && fxAllowed() && isNight();
  const sync = () => {
    const a = allowed();
    if (a && !enabled) { enabled = true; el.hidden = false; alloc(); }
    if (!a && enabled) { enabled = false; clearAll(); el.hidden = true; }
    if (!a) el.hidden = true;
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { if (enabled) alloc(); }) : null;
  ro?.observe(host);
  const unVis = visibleWatch(host, v => { inView = v; });
  const unFx = onFxChange(sync);
  let idleCleared = true;
  const unReg = register({
    active: () => enabled && inView && (now - lastInput < 6000 || !idleCleared) && !gl.isContextLost(),
    tick(t, dt) {
      now = t;
      if (lastInput < 0 || now - lastInput > 6000) { if (!idleCleared) { clearAll(); idleCleared = true; } return; }
      idleCleared = false;
      step(Math.min(dt, 1 / 30));
    },
  });
  // performance.now() and rAF time share an origin, so input stamps compare with tick times
  const stamp = () => { now = performance.now(); };
  host.addEventListener('pointermove', stamp, { passive: true, capture: true });
  sync();

  return {
    el,
    destroy() {
      unReg(); unVis(); unFx(); ro?.disconnect();
      host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerleave', onOut);
      host.removeEventListener('pointermove', stamp, { capture: true });
      [dye, vel, prs, dv, crl].forEach(x => x?.free?.());
      loseContext(gl); el.remove();
    },
  };
}
