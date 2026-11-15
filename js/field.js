// The one live WebGL field behind every tab (feat/ui-lock). ILLUSTRATION, NOT DATA.
// One fixed full-screen canvas and ONE WebGL 2 context for the whole visit. Each tab is a "station": a set of uniforms
// (camera distance, yaw, pitch, flame gravity, smoke, dim, Earth) that is tweened over 900 ms on a route change.
// The flame shader is gl_hero.js's ray-marched droplet flame; the Earth is gl_banner.js's limb, both reused here.
//  - Rendered at half resolution, devicePixelRatio capped at 1.5, adaptive down to 0.3x if frames run slow.
//  - Paused while the browser tab is hidden. When the reader is deep in a page (the field is mostly dimmed) it renders
//    one frame in four.
//  - Calm motion / prefers-reduced-motion: no loop and no camera moves. Each station is drawn once, as a still poster.
//  - Day theme: the field shows only inside the current "host" (the page header or the Home story), clipped to it.
//  - No WebGL 2: the canvas is removed and html gets .nogl; every page still works.
// Every constant here is a drawing parameter of the illustration, not a measured value.

const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform vec2 res; uniform float t, g, yaw, pitch, dist, dim, smoke, earth, offx, spin;
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int k = 0; k < 4; k++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
vec3 fq(vec3 p){
  float fl = g * (.035 * sin(t * 8.3 + p.y * 5.) + .02 * sin(t * 13.1 + p.y * 9.));
  vec3 q = p; q.x += fl * smoothstep(-.2, 1.2, p.y);
  q.y -= g * .63; q.y *= mix(1., .64, g);
  q.xz *= 1. + g * 1.1 * smoothstep(-.3, 1.4, p.y);
  return q * mix(1., 1.5, g);
}
vec3 stars(vec3 d){
  vec3 c = vec3(0.); vec3 s = d * 180.; vec3 id = floor(s); float r = h3(id);
  if (r > .985) { float b = pow(max(0., 1. - length(fract(s) - .5) * 2.4), 6.); c += b * mix(vec3(.7,.8,1.), vec3(1.,.85,.7), h3(id + 3.)) * (r - .985) * 60.; }
  return c;
}
vec3 flame(vec2 sp){
  float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), spp = sin(pitch);
  vec3 ro = vec3(sy * cp, spp, cy * cp) * dist;
  vec3 fw = normalize(-ro), rt = normalize(cross(abs(fw.y) > .995 ? vec3(0,0,1) : vec3(0,1,0), fw)), up = cross(fw, rt);
  vec3 rd = normalize(fw * 1.75 + rt * sp.x + up * sp.y);
  vec3 col = stars(rd) * .8;
  float rD = .042, bD = dot(ro, rd), cD = dot(ro, ro) - rD * rD, hD = bD * bD - cD, tD = 1e9;
  if (hD > 0.) tD = -bD - sqrt(hD);
  float R = 1.9 + smoke * 1.2, b = dot(ro, rd), c = dot(ro, ro) - R * R, hh = b * b - c;
  vec3 acc = vec3(0.); float tr = 1.;
  if (hh > 0.) {
    float t0 = max(0., -b - sqrt(hh)), t1 = min(-b + sqrt(hh), tD);
    const int N = 56; float dt = (t1 - t0) / float(N);
    float jit = h3(vec3(gl_FragCoord.xy, t * 60.));
    float Rsm = .7 + smoke * 2.2;
    for (int i = 0; i < N; i++) {
      float tt = t0 + (float(i) + jit) * dt; vec3 p = ro + rd * tt; vec3 q = fq(p);
      float r = length(q);
      float n = fbm(q * 3.2 + vec3(0., -t * (.25 + 1.6 * g), 0.));
      float Rb = .62 + .035 * (n - .5), wb = .028 + .05 * g;
      float blue = exp(-pow((r - Rb) / wb, 2.)) * (.7 + .6 * n);
      float Rs = .46 + .05 * (n - .5);
      float sootShell = exp(-pow((r - Rs) / .07, 2.)) * smoothstep(.2, .7, n);
      float sootFill = smoothstep(.70, .28, r) * smoothstep(-.08, .32, p.y) * (.55 + .9 * n);
      float soot = mix(.06 * sootShell, 1.25 * sootFill, g);
      float core = g * smoothstep(.42, .05, r) * smoothstep(.0, .4, p.y) * .7;
      float blueBase = mix(1., smoothstep(.18, -.12, p.y) * 1.3 + .02, g);
      vec3 e = vec3(.16, .36, 1.3) * blue * blueBase * 4.2 + vec3(1., .46, .10) * soot * 2.6 + vec3(1., .82, .55) * core * 2.4;
      // smoke with no buoyancy: an even cloud spreading the same way in every direction
      float rr = length(p);
      float sm = smoke * smoothstep(Rsm, Rsm * .55, rr) * smoothstep(.75, 1.05, rr) * smoothstep(.35, .85, fbm(p * 1.7 + vec3(t * .04, 0., -t * .03)));
      e += vec3(.30, .33, .40) * sm * .55;
      float dens = soot * .35 + core * .2 + sm * .5;
      acc += e * tr * dt; tr *= exp(-dens * dt * 1.6);
    }
  }
  col = col * tr + acc;
  if (tD < 1e8) {
    vec3 p = ro + rd * tD, nrm = normalize(p);
    float fr = pow(1. - max(0., dot(-rd, nrm)), 3.);
    vec3 lit = mix(vec3(.25, .45, 1.), vec3(1., .6, .25), g) * (.18 + 1.4 * fr);
    col = col * .15 + lit * tr + acc * .4;
  }
  return col;
}
float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float fbm2(vec2 p){ float a = .5, s = 0.; mat2 r = mat2(.8, .6, -.6, .8); for (int k = 0; k < 5; k++) { s += a * n2(p); p = r * p * 2.02 + 3.1; a *= .5; } return s; }
vec3 planet(vec2 sp){
  vec3 col = vec3(0.);
  vec2 c = vec2(.15, -.05); float R = .62; vec2 d = sp - c; float r = length(d);
  float rim = exp(-pow((r - R) / .012, 2.)) * 1.2 + exp(-max(0., r - R) / .05) * .35 * step(R, r);
  vec3 sun = normalize(vec3(-.8, .55, .45));
  if (r < R) {
    float z = sqrt(R * R - r * r); vec3 n = normalize(vec3(d, z)); float lit = dot(n, sun);
    vec2 q = vec2(atan(n.x, n.z) + spin, asin(n.y)) * 2.2;
    float land = smoothstep(.52, .58, fbm2(q * 1.3 + 7.));
    vec3 ground = mix(vec3(.02, .07, .16), mix(vec3(.10, .16, .07), vec3(.30, .26, .17), fbm2(q * 4.)), land);
    float cl = smoothstep(.45, .85, fbm2(q * 2.6 + vec2(t * .006, 0.)) + .15 * fbm2(q * 9.));
    vec3 day = mix(ground, vec3(.95), cl * .9);
    float dl = smoothstep(-.08, .25, lit);
    vec3 night = vec3(1., .72, .38) * land * (1. - cl) * smoothstep(.62, .9, fbm2(q * 14.)) * .9 * smoothstep(.05, -.15, lit);
    col = day * dl * (.15 + .95 * max(0., lit)) + night;
    col = mix(col, vec3(.35, .55, 1.), pow(1. - n.z, 3.) * .65 * dl);
  }
  col += vec3(.30, .55, 1.) * rim * smoothstep(-.6, .5, dot(normalize(vec3(d, 0.)), sun) + .2);
  return col;
}
void main(){
  vec2 sp = (uv * res - .5 * res) / res.y; sp.x -= offx;
  vec3 col = vec3(0.);
  if (earth < .99) col += flame(sp) * (1. - earth);
  if (earth > .01) col += planet(sp) * earth;
  col = 1. - exp(-col * 1.35);
  col = pow(col, vec3(.4545));
  col *= 1. - dim;
  col += (h2(gl_FragCoord.xy + t) - .5) / 255.;
  o = vec4(col, 1.);
}`;

// Stations: camera distance, yaw, pitch, flame gravity, smoke, dim, Earth, horizontal offset (screen units).
const BASE = { dist: 4.6, yaw: .5, pitch: .12, g: 0, smoke: 0, dim: .45, earth: 0, offx: .38, spin: 0 };
export const STATIONS = {
  overview: { g: 1, dim: 0, offx: .36 },
  memory: { dist: 6.2, g: 1, dim: .6, yaw: 1.4 },
  detect: { dist: 5.4, smoke: .55, dim: .5, yaw: -.4 },
  assess: { dist: 6.0, pitch: 1.45, dim: .5, offx: .3 },
  predict: { dist: 3.0, smoke: .8, dim: .45, yaw: 2.1 },
  respond: { dist: 2.4, dim: .4, pitch: .05 },
  flame: { dist: 4.4, g: .5, dim: .45, yaw: 0 },
  explorer: { dist: 7.2, dim: .6, pitch: .5 },
  evidence: { dist: 7.6, dim: .65, yaw: -1 },
  ask: { dist: 8.2, dim: .7 },
  models: { dist: 6.6, dim: .65, yaw: 3 },
  earth: { earth: 1, dim: .05, offx: .32 },
  locate: { dist: 6.2, dim: .7, g: 1 },
  about: { dist: 8.4, dim: .75 },
  design: { dist: 5.8, dim: .6, pitch: .4 },
};
const KEYS = Object.keys(BASE);
const calmNow = () => document.documentElement.dataset.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);   // cubic-bezier(.65,0,.35,1)-like "move"

let cv = null, gl = null, U = null, raf = 0, ok = false, scale = 1, slow = 0, frameN = 0;
let cur = { ...BASE }, from = { ...BASE }, to = { ...BASE }, tw0 = 0, twDur = 900;
let over = {};          // live overrides from the page (Home story, Respond drag): drawn on top of the station
let host = null, clock = 0, lastT = 0, dirty = true, scrollDim = 0;
let drag = null, vYaw = 0, vPitch = 0, userYaw = 0, userPitch = 0;
const fps = { n: 0, t0: 0, value: 0 };

function compile() {
  try { gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' }); } catch { gl = null; }
  if (!gl) return false;
  try {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile'); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || 'link');
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    U = Object.fromEntries(['res', 't', ...KEYS].map(k => [k, gl.getUniformLocation(pr, k)]));
    return true;
  } catch (e) { console.warn('field: WebGL 2 shader failed; the site runs without the field.', e); gl = null; return false; }
}

function size() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.round(innerWidth * dpr * scale * .5 * 2) >> 1), hh = Math.max(1, Math.round(innerHeight * dpr * scale * .5 * 2) >> 1);
  // half resolution: half the pixels of a 1.5-capped devicePixelRatio (scale 1), lower if frames run slow
  if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
  gl.viewport(0, 0, w, hh);
}

function clip() {
  if (!cv) return;
  const day = document.documentElement.dataset.theme === 'day';
  if (!day) { cv.style.clipPath = ''; cv.hidden = false; return; }
  if (!host || !host.isConnected) { cv.hidden = true; return; }
  const r = host.getBoundingClientRect();
  if (r.bottom <= 0 || r.top >= innerHeight) { cv.hidden = true; return; }
  cv.hidden = false;
  cv.style.clipPath = `inset(${Math.max(0, r.top)}px ${Math.max(0, innerWidth - r.right)}px ${Math.max(0, innerHeight - r.bottom)}px ${Math.max(0, r.left)}px)`;
}

function draw() {
  size();
  const v = { ...cur, ...over };
  v.yaw += userYaw; v.pitch = Math.max(-1.5, Math.min(1.53, v.pitch + userPitch));
  v.dim = 1 - (1 - v.dim) * (1 - scrollDim);
  gl.uniform2f(U.res, cv.width, cv.height); gl.uniform1f(U.t, clock);
  for (const k of KEYS) gl.uniform1f(U[k], v[k]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function frame(now) {
  raf = 0;
  if (!ok || document.hidden) { lastT = 0; return; }
  const still = calmNow();
  const dt = lastT ? Math.min(.1, (now - lastT) / 1000) : .016; lastT = now;
  // station tween
  const k = still ? 1 : Math.min(1, (now - tw0) / twDur), e = ease(k);
  for (const key of KEYS) cur[key] = from[key] + (to[key] - from[key]) * e;
  // drag inertia
  if (!drag && !still) { userYaw += vYaw; userPitch += vPitch; vYaw *= .93; vPitch *= .9; if (Math.abs(vYaw) < 1e-5) vYaw = 0; if (Math.abs(vPitch) < 1e-5) vPitch = 0; }
  const moving = k < 1 || drag || vYaw || vPitch || dirty;
  if (!still) clock += dt;
  // deep in a page the field is mostly dimmed: draw one frame in four
  const thin = scrollDim > .55 && !moving;
  if (!thin || (frameN++ & 3) === 0) {
    draw(); dirty = false;
    // adaptive resolution: 20 slow frames drop the render scale 15 %, floor 0.3
    if (dt > .028) { if (++slow > 20 && scale > .3) { scale = Math.max(.3, scale * .85); slow = 0; } } else slow = Math.max(0, slow - 1);
  }
  fps.n++; if (!fps.t0) fps.t0 = now; if (now - fps.t0 > 1000) { fps.value = Math.round(fps.n * 1000 / (now - fps.t0)); fps.n = 0; fps.t0 = now; window.__voFps = fps.value; }
  if (!still || moving) raf = requestAnimationFrame(frame);
  else lastT = 0;
}
const kick = () => { clip(); if (ok && !raf && !document.hidden) raf = requestAnimationFrame(frame); };

function onScroll() {
  const y = scrollY, H = innerHeight;
  scrollDim = Math.max(0, Math.min(.75, (y - H * .25) / H * .8));
  if (host?.dataset.fieldNoDim) scrollDim = 0;
  clip(); if (calmNow()) dirty = true; kick();
}

/** Create the field (once). Returns true when WebGL 2 runs. */
export function initField() {
  if (cv) return ok;
  cv = document.createElement('canvas'); cv.id = 'field'; cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  ok = compile();
  if (!ok) { cv.remove(); document.documentElement.classList.add('nogl'); return false; }
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); ok = false; cv.hidden = true; document.documentElement.classList.add('nogl'); });
  addEventListener('resize', () => { dirty = true; kick(); });
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', () => { lastT = 0; kick(); });
  new MutationObserver(() => { dirty = true; kick(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-theme'] });
  kick();
  return true;
}
export const fieldOk = () => ok;

/** Move to a tab's station over 900 ms. dir > 0 = going deeper (camera pushes in first), < 0 = going back. */
export function station(id, dir = 0) {
  const s = { ...BASE, ...(STATIONS[id] || {}) };
  from = { ...cur, ...over }; from.yaw += userYaw; from.pitch += userPitch;
  over = {}; userYaw = 0; userPitch = 0; vYaw = vPitch = 0;
  if (dir && !calmNow()) from.dist *= dir > 0 ? 1.25 : .8;     // the camera moves in (or out) toward the new station
  to = s; tw0 = performance.now(); dirty = true;
  if (calmNow()) cur = { ...s };
  kick();
}
/** Live overrides on top of the station (e.g. the Home story's gravity). Pass {} to clear. */
export function setField(v) { over = { ...over, ...v }; dirty = true; kick(); }
export function clearField() { over = {}; dirty = true; kick(); }
/** The element the field shows through in the Day theme (clip), and whether it is exempt from scroll dimming. */
export function setHost(el, { noDim = false } = {}) { host = el; if (el) el.dataset.fieldNoDim = noDim ? '1' : ''; onScroll(); }

/** Drag on el orbits the camera, with inertia; arrow keys on el turn it. Returns an unbind function. */
export function bindOrbit(el) {
  const down = e => { if (e.button > 0) return; drag = { x: e.clientX, y: e.clientY }; vYaw = vPitch = 0; try { el.setPointerCapture(e.pointerId); } catch { /* gone */ } kick(); };
  const move = e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / 300, dy = (e.clientY - drag.y) / 300; drag = { x: e.clientX, y: e.clientY };
    userYaw -= dx; userPitch += dy; vYaw = calmNow() ? 0 : -dx * .6; vPitch = calmNow() ? 0 : dy * .3; dirty = true; kick();
  };
  const up = () => { drag = null; kick(); };
  const key = e => {
    const m = { ArrowLeft: [.2, 0], ArrowRight: [-.2, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }[e.key];
    if (!m) return; e.preventDefault(); userYaw += m[0]; userPitch += m[1]; dirty = true; kick();
  };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('keydown', key);
  return () => { drag = null; el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('keydown', key); };
}
/** The shader compile counts as one loader step (js/engine.js). */
export const fieldReady = () => Promise.resolve(ok);
