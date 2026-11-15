// Fire noise field (site v3): a slow, warped ember glow with fine film grain and faint scanlines, on near-black.
// Domain-warped fractal noise (after Inigo Quilez's "domain warping" article) in the fire palette; idea from the
// "SpectraNoise" Framer component. Both credited in REFERENCES.md; code written here from scratch. Illustration only.
//
// Readability: text sits on top, so the shader caps brightness at relative luminance 0.08 in the middle of the box
// and lets it reach 0.15 only toward the edges and the bottom. Light text (#eef1f7) keeps at least 4.6:1 at the brightest edge and 7:1 in the middle.
// Slow: the pattern drifts over tens of seconds; grain is +-3 % and changes at 12 Hz in tiny cells, so nothing
// flashes. Effects off / Calm / reduced motion: one still frame. No WebGL: a still CSS gradient (.fx-noise-still).
import { register, fxAllowed, onFxChange, visibleWatch, program, quad, loseContext, wake } from './loop.js';

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
  const el = document.createElement('canvas');
  el.className = 'fx-noise'; el.setAttribute('aria-hidden', 'true');
  host.prepend(el);
  let gl = null, P = null;
  try { gl = el.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true }); } catch { gl = null; }
  if (gl) { P = program(gl, VS, FS); if (P) { gl.useProgram(P.p); quad(gl); } }
  if (!gl || !P) {
    loseContext(gl); el.remove(); host.classList.add('fx-noise-still');
    return { el, destroy() { host.classList.remove('fx-noise-still'); } };
  }
  let inView = true, W = 0, H = 0, acc = 1, still = false, gt = 0;
  const t0 = performance.now() - 40000;   // start mid-drift so the first still frame is not blank
  function size() {
    const r = host.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1.5) / 2;
    const w = Math.max(2, Math.round(r.width * d)), hh = Math.max(2, Math.round(r.height * d));
    if (w === W && hh === H) return false;
    W = el.width = w; H = el.height = hh; return true;
  }
  function draw(t) {
    if (gl.isContextLost()) return;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(P.u.res, W, H); gl.uniform1f(P.u.t, t); gl.uniform1f(P.u.k, Math.max(0, Math.min(1.5, strength))); gl.uniform1f(P.u.gt, gt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const stillFrame = () => { draw(40); still = true; };
  size(); stillFrame();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { if (size()) { if (fxAllowed()) wake(); else stillFrame(); } }) : null;
  ro?.observe(host);
  const unVis = visibleWatch(host, v => { inView = v; });
  const unFx = onFxChange(() => { if (!fxAllowed()) stillFrame(); else { still = false; wake(); } });
  const unReg = register({
    active: () => inView && fxAllowed() && !gl.isContextLost(),
    tick(t, dt) {
      acc += dt; if (acc < 1 / 30) return;        // 30 fps: the drift is slow, grain refreshes at ~12 Hz
      if (Math.floor(t / 83) !== Math.floor((t - acc * 1000) / 83)) gt = (gt + 17.13) % 997;
      acc = 0; draw((t - t0) / 1000);
    },
  });
  return {
    el,
    destroy() { unReg(); unVis(); unFx(); ro?.disconnect(); loseContext(gl); el.remove(); },
  };
}
