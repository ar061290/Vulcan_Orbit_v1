// Fire noise field (site v3): a slow, warped ember glow with fine film grain and faint scanlines, on near-black.
// Domain-warped fractal noise (after Inigo Quilez's "domain warping" article) in the fire palette; idea from the
// "SpectraNoise" Framer component. Both credited in REFERENCES.md; code written here from scratch. Illustration only.
//
// Readability: text sits on top, so the shader caps brightness at relative luminance 0.08 in the middle of the box
// and lets it reach 0.15 only toward the edges and the bottom. Light text (#eef1f7) keeps at least 4.6:1 at the brightest edge and 7:1 in the middle.
// Slow: the pattern drifts over tens of seconds; grain is +-3 % and changes at 12 Hz in tiny cells, so nothing
// flashes.
// Performance budget (merged site): the WebGL context exists ONLY while the host is on screen with effects allowed on a
// fine pointer. It is created lazily, released (WEBGL_lose_context) after 2 s off screen, on Effects Off / Calm /
// reduced motion, and on destroy(). Phones and coarse pointers never create one. Its render is capped at
// devicePixelRatio 1, half resolution and at most 0.25 megapixel, 30 fps. Whenever there is no live canvas the host
// shows the still CSS ember glow (.fx-noise-still), so there is never a blank box.
import { register, fxAllowed, onFxChange, finePointer, visibleWatch, program, quad, loseContext, wake } from './loop.js';

const MAXPX = 250000;

const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `precision highp float; varying vec2 uv; uniform vec2 res; uniform float t, k, gt;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * n(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= .5; } return s; }
vec3 fire(float x){ vec3 a = vec3(.353,.059,.020), b = vec3(.851,.282,.059), c = vec3(.961,.624,0.), d = vec3(1.,.953,.839);
  x = clamp(x, 0., 1.); return x < .45 ? mix(vec3(0.), a, x / .45) : x < .75 ? mix(a, b, (x - .45) / .3) : x < .93 ? mix(b, c, (x - .75) / .18) : mix(c, d, (x - .93) / .07); }
void main(){
  vec2 q = (gl_FragCoord.xy / res) * vec2(res.x / res.y, 1.) * .62;
  float T = t * .025;
  vec2 w1 = vec2(fbm(q + vec2(0., T)), fbm(q + vec2(5.2, 1.3 - T)));
  vec2 w2 = vec2(fbm(q + 3.5 * w1 + vec2(1.7, 9.2) + T * .7), fbm(q + 3.5 * w1 + vec2(8.3, 2.8) - T * .5));
  float v = fbm(q + 2.2 * w2);
  v = smoothstep(.34, .9, v + .3 * w2.x - .04);
  vec2 cc = uv - vec2(.5, .42);
  float edge = smoothstep(.25, .75, length(cc * vec2(1., 1.25))) * .7 + (1. - smoothstep(0., .45, uv.y)) * .5;
  edge = clamp(edge, 0., 1.);
  vec3 col = fire(v * (.55 + .45 * edge)) * k;
  vec3 lin = pow(max(col, 0.), vec3(2.2)); float Y = dot(lin, vec3(.2126, .7152, .0722));
  float cap = mix(.08, .15, edge); if (Y > cap) col *= pow(cap / Y, 1. / 2.2);
  float g = h(floor(gl_FragCoord.xy) + gt) - .5; col += g * .03 * (.4 + col);
  col *= .93 + .07 * step(.5, fract(gl_FragCoord.y * .5));
  gl_FragColor = vec4(max(col, 0.), 1.);
}`;

export function noiseField(host, { strength = 1 } = {}) {
  let el = null, gl = null, P = null, inView = false, W = 0, H = 0, acc = 1, gt = 0, offT = 0, losses = 0, broken = false, dead = false, shown = false;
  const t0 = performance.now() - 40000;   // start mid-drift so the first frame is not blank
  const still = v => host.classList.toggle('fx-noise-still', v);
  still(true);
  const allowed = () => !broken && !dead && finePointer() && fxAllowed();

  function size() {
    if (!el) return false;
    const r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1) * 0.5;
    let w = r.width * d, hh = r.height * d;
    const px = w * hh; if (px > MAXPX) { const f = Math.sqrt(MAXPX / px); w *= f; hh *= f; }
    w = Math.max(2, Math.round(w)); hh = Math.max(2, Math.round(hh));
    if (w === W && hh === H) return false;
    W = el.width = w; H = el.height = hh; return true;
  }
  function draw(t) {
    if (!gl || gl.isContextLost()) return;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(P.u.res, W, H); gl.uniform1f(P.u.t, t); gl.uniform1f(P.u.k, Math.max(0, Math.min(1.5, strength))); gl.uniform1f(P.u.gt, gt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) { shown = true; el.hidden = false; still(false); }
  }
  function release() {
    clearTimeout(offT); offT = 0;
    if (!el) return;
    const g = gl; gl = null; P = null; el.remove(); el = null; W = H = 0; shown = false;
    loseContext(g);
    still(true);
  }
  function create() {
    if (el || !allowed() || !inView) return;
    const c = document.createElement('canvas');
    c.className = 'fx-noise'; c.setAttribute('aria-hidden', 'true'); c.hidden = true;
    let g = null, p = null;
    try { g = c.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }); } catch { g = null; }
    if (g) { p = program(g, VS, FS); if (p) { g.useProgram(p.p); quad(g); } }
    if (!g || !p) { loseContext(g); broken = true; return; }        // no WebGL: the still glow stays
    // the browser dropped the context (too many on the page): fall back to the still; give up after three losses
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); if (el === c) { if (++losses >= 3) broken = true; release(); } });
    el = c; gl = g; P = p;
    host.prepend(el); size(); acc = 1; wake();
  }
  const sync = () => {
    if (allowed() && inView) { clearTimeout(offT); offT = 0; create(); wake(); }
    else if (!allowed()) release();
    else if (el && !offT) offT = setTimeout(release, 2000);   // off screen: keep it 2 s in case the reader scrolls back
  };

  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { if (size()) { acc = 0; draw((performance.now() - t0) / 1000); } }) : null;
  ro?.observe(host);
  const unVis = visibleWatch(host, v => { inView = v; sync(); });
  const unFx = onFxChange(sync);
  const unReg = register({
    active: () => !!gl && inView && fxAllowed() && !gl.isContextLost(),
    tick(t, dt) {
      acc += dt; if (acc < 1 / 30) return;        // 30 fps: the drift is slow, grain refreshes at ~12 Hz
      if (Math.floor(t / 83) !== Math.floor((t - acc * 1000) / 83)) gt = (gt + 17.13) % 997;
      acc = 0; draw((t - t0) / 1000);
    },
  });
  return {
    /** The live canvas, or null while the still glow is showing (created and dropped on demand). */
    get el() { return el; },
    // the host keeps .fx-noise-still after destroy (the still glow), so a caller that drops the live field because
    // Effects went Off or Calm never leaves a blank band; a page leave removes the host anyway
    destroy() { dead = true; unReg(); unVis(); unFx(); ro?.disconnect(); release(); },
  };
}
