// Page-header illustrations, rendered live in WebGL 2 at native resolution. ILLUSTRATIONS, NOT DATA.
//  'earth': the planet's limb seen from orbit, with clouds, night side and a thin atmosphere rim.
//  'smoke': cabin smoke drifting with the ventilation through a detector's light beam.
// Interface (site/REBUILD_PLAN.md §2.11): banner('earth'|'smoke', ctx) → element.
// Lifecycle (§0 rule 6): the render step only builds a static SVG drawing. WebGL starts in ctx.onMount and stops
// (rAF cancelled, observers disconnected, GL context released) in ctx.onLeave. With ctx.detached nothing starts.
// Motion: Calm is re-checked every frame (one still frame, no loop); a Pause button stops the loop at any time.
// No-WebGL: the static drawing stays and a fallback sentence says so (spec D2 "Illustrations").
// The shader is ported verbatim from main's js/banner.js, except that the detector LED's pulse rate is a uniform
// (LED_RAD_S below) so the rate that keeps it under 3 flashes per second (spec D5.10) is stated in one place.
import { calm } from './lib.js';

const NS = 'http://www.w3.org/2000/svg';
const NOTE = 'Illustration, not data';
const FALLBACK = 'Still drawing: this browser has WebGL 2 turned off, so the moving illustration cannot run.';
// Detector LED pulse, in radians per second of illustration time. Main used sin(t*4): 4 / (2π) ≈ 0.64 pulses per
// second, well under the 3 flashes per second limit (WCAG 2.3.1, spec D5.10). The LED is also a tiny spot whose
// brightness swings smoothly (1.5 ± 0.8), not an on/off flash. Do not raise this above 2π·3 ≈ 18.8.
const LED_RAD_S = 4;
const LED_MAX_RAD_S = 2 * Math.PI * 3;
const T0 = 20;   // main's start time offset (and the still frame shown in Calm), illustration seconds

let n = 0;
let paused = false;   // shared by every banner in this session: pausing one keeps later pages paused too

// ---------- static drawing (phase 1 stub, kept as the no-WebGL and detached fallback) ----------
const STARS = [[60, 30], [140, 80], [250, 20], [330, 110], [420, 40], [520, 90], [610, 25], [700, 70], [790, 35], [880, 95], [960, 30], [1050, 75], [1130, 20], [1180, 120]];
function earthSvg(id) {
  return `<defs>
    <radialGradient id="${id}e" cx="35%" cy="160%" r="150%"><stop offset=".55" stop-color="#1b4a7a"/><stop offset=".64" stop-color="#2d6aa3"/><stop offset=".66" stop-color="#8fc3ff" stop-opacity=".9"/><stop offset=".7" stop-color="#5b8cff" stop-opacity="0"/></radialGradient>
  </defs>
  <g fill="#dfe6ff" opacity=".6">${STARS.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 3 ? 0.9 : 1.5}"/>`).join('')}</g>
  <ellipse cx="420" cy="980" rx="1100" ry="760" fill="url(#${id}e)"/>
  <ellipse cx="420" cy="980" rx="1100" ry="760" fill="none" stroke="#9cc4f6" stroke-opacity=".5" stroke-width="3"/>`;
}
function smokeSvg() {
  const puff = (d, o) => `<path d="${d}" fill="none" stroke="#c9d0dd" stroke-opacity="${o}" stroke-width="34" stroke-linecap="round"/>`;
  return `<rect x="0" y="150" width="1200" height="44" fill="#7aa2ff" opacity=".08"/>
  ${puff('M80 230 C240 170 360 260 520 200 S820 150 980 190', '.10')}
  ${puff('M60 260 C220 230 380 300 560 250 S860 210 1040 240', '.07')}
  ${puff('M120 200 C260 150 420 210 600 170 S900 120 1100 150', '.06')}
  <circle cx="90" cy="250" r="16" fill="#ff8a3d" opacity=".5"/><circle cx="90" cy="250" r="7" fill="#3b6cff" opacity=".8"/>
  <circle cx="1120" cy="172" r="6" fill="#ff4d4d"/>`;
}

// ---------- shader (verbatim from main's js/banner.js; LED rate as a uniform) ----------
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o; uniform vec2 res; uniform float t; uniform int mode; uniform float led;
float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; mat2 r = mat2(.8, .6, -.6, .8); for (int k = 0; k < 6; k++) { s += a * n2(p); p = r * p * 2.02 + 3.1; a *= .5; } return s; }
vec3 stars(vec2 p){ vec2 g = floor(p * 260.); float r = h2(g); float b = r > .992 ? pow(1. - length(fract(p * 260.) - .5) * 2., 8.) * (r - .992) * 120. : 0.; return vec3(b); }
vec3 earth(vec2 sp){
  vec3 col = stars(sp * .7) * .8;
  vec2 c = vec2(.35, -1.55); float R = 1.62; vec2 d = sp - c; float r = length(d);
  // atmosphere: thin bright rim fading into space
  float rim = exp(-pow((r - R) / .022, 2.)) * 1.2 + exp(-max(0., r - R) / .09) * .35 * step(R, r);
  vec3 sun = normalize(vec3(-.8, .55, .25));
  if (r < R) {
    float z = sqrt(R * R - r * r); vec3 n = normalize(vec3(d, z)); float lit = dot(n, sun);
    vec2 q = vec2(atan(n.x, n.z), asin(n.y)) * 2.2 + vec2(t * .004, 0.);
    float land = smoothstep(.52, .58, fbm(q * 1.3 + 7.));
    vec3 ground = mix(vec3(.02, .07, .16), mix(vec3(.10, .16, .07), vec3(.30, .26, .17), fbm(q * 4.)), land);
    float cl = smoothstep(.45, .85, fbm(q * 2.6 + vec2(t * .006, 0.)) + .15 * fbm(q * 9.));
    vec3 day = mix(ground, vec3(.95), cl * .9);
    float spec = pow(max(0., dot(reflect(-sun, n), vec3(0, 0, 1))), 40.) * (1. - land) * (1. - cl) * .6;
    float dl = smoothstep(-.08, .25, lit);
    vec3 night = vec3(1., .72, .38) * land * (1. - cl) * smoothstep(.62, .9, fbm(q * 14.)) * .9 * smoothstep(.05, -.15, lit);
    col = day * dl * (.15 + .95 * max(0., lit)) + spec + night;
    col = mix(col, vec3(.35, .55, 1.), pow(1. - n.z, 3.) * .65 * dl);
  }
  col += vec3(.30, .55, 1.) * rim * smoothstep(-.6, .5, dot(normalize(vec3(d, 0.)), sun) + .2);
  return col;
}
vec3 smoke(vec2 sp){
  vec3 col = vec3(.012, .016, .03) + .025 * vec3(.2, .3, .6) * (1. - uv.y);
  vec2 p = sp * 1.6; float tt = t * .12;
  vec2 w = vec2(fbm(p + vec2(tt, 0.)), fbm(p + vec2(5.2, 1.3) - vec2(0., tt * .6)));
  float d = fbm(p * 1.2 + 2.2 * w - vec2(tt * 2., 0.));
  float src = exp(-length((sp - vec2(-.95, -.25)) * vec2(.8, 1.4)) * 1.6);   // smoke comes from a source at the left
  float dens = smoothstep(.38, .95, d) * (.35 + 1.2 * src) * smoothstep(-1.4, .3, -sp.x * .4 + .2);
  // detector light beam crossing the cabin
  float beam = exp(-pow((sp.y - .16 - .05 * sp.x) / .035, 2.));
  vec3 lit = vec3(.55, .62, .75) * dens * .55 + vec3(1., .78, .55) * dens * beam * 2.6 + vec3(1., .85, .6) * beam * .06;
  float fire = exp(-length((sp - vec2(-.95, -.25)) * vec2(1., 1.)) * 9.);
  col += lit + vec3(.35, .55, 1.) * fire * .9 + vec3(1., .5, .15) * fire * fire * .5;
  float det = exp(-length(sp - vec2(1.25, .22)) * 60.);
  col += vec3(1., .3, .15) * det * (1.5 + sin(t * led) * .8);   // slow LED pulse: led rad/s, see LED_RAD_S
  return col;
}
void main(){
  vec2 sp = (uv * res - .5 * res) / res.y;
  vec3 col = mode == 0 ? earth(sp) : smoke(sp);
  col = 1. - exp(-col * 1.25); col = pow(col, vec3(.4545));
  col += (h2(gl_FragCoord.xy + t) - .5) / 255.;
  o = vec4(col, 1.);
}`;

// ---------- WebGL runner ----------
function startGL(wrap, cv, kind, ui) {
  let gl = null;
  try { gl = cv.getContext('webgl2', { antialias: false, powerPreference: 'low-power' }); } catch { gl = null; }
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed'); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || 'program link failed');
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(pr, 'res'), uT = gl.getUniformLocation(pr, 't');
  gl.uniform1i(gl.getUniformLocation(pr, 'mode'), kind === 'smoke' ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(pr, 'led'), Math.min(LED_RAD_S, LED_MAX_RAD_S));

  // illustration time only advances while the banner is actually animating, so Pause / Calm resume where they left off
  let vis = true, raf = 0, scale = Math.min(devicePixelRatio || 1, 2), last = 0, slow = 0, tIll = T0, stopped = false;
  const still = () => calm() || paused;
  const draw = (t) => {
    const r = cv.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * scale)), hh = Math.max(1, Math.round(r.height * scale));
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    gl.viewport(0, 0, w, hh); gl.uniform2f(uRes, w, hh); gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const frame = now => {
    raf = 0; if (stopped || !vis || !wrap.isConnected || gl.isContextLost()) { last = 0; return; }
    if (still()) { draw(calm() ? T0 : tIll); last = 0; ui.sync(); return; }   // one still frame, no loop (Calm re-checked every frame)
    const dt = last ? (now - last) / 1000 : 0.016; last = now;
    tIll += Math.min(dt, 0.1);
    // adaptive resolution (main): sustained slow frames drop the render scale by 15 %, down to 0.6
    if (dt > 0.03 && ++slow > 15 && scale > 0.6) { scale = Math.max(0.6, scale * 0.85); slow = 0; }
    draw(tIll);
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && !stopped) raf = requestAnimationFrame(frame); };
  const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) kick(); });
  const ro = new ResizeObserver(kick);
  io.observe(wrap); ro.observe(wrap);
  const onMotion = () => { last = 0; ui.sync(); kick(); };
  const mo = new MutationObserver(onMotion);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  const onLost = e => { e.preventDefault(); stop(); ui.fallback(); };
  cv.addEventListener('webglcontextlost', onLost);
  function stop() {
    if (stopped) return; stopped = true;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    io.disconnect(); ro.disconnect(); mo.disconnect();
    cv.removeEventListener('webglcontextlost', onLost);
    // release the GPU context now (browsers cap live WebGL contexts; main never released them)
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
  }
  kick();
  return { stop, kick: onMotion };
}

/**
 * Page-header illustration.
 * @param {'earth'|'smoke'} kind
 * @param {{detached?:boolean, onMount?:Function, onLeave?:Function}} [ctx] router context (§2.4)
 * @returns {HTMLDivElement} div.banner-gl (absolute-filled by .phead in components.css)
 */
export function banner(kind = 'earth', ctx) {
  kind = kind === 'smoke' ? 'smoke' : 'earth';
  const id = `ban${++n}`;
  const wrap = document.createElement('div');
  wrap.className = `banner-gl gl-static ${kind}`;
  wrap.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 1200 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${kind === 'smoke' ? smokeSvg() : earthSvg(id)}</svg>`;
  const bar = document.createElement('div'); bar.className = 'gl-bar';
  const note = document.createElement('p'); note.className = 'illus-note'; note.textContent = NOTE;
  bar.append(note); wrap.append(bar);
  if (ctx?.detached) return wrap;   // site map: static drawing only, nothing starts

  let run = null, btn = null, fb = null;
  const ui = {
    sync() {
      if (!btn) return;
      const c = calm();
      btn.hidden = c;   // in Calm nothing moves, so there is nothing to pause
      btn.setAttribute('aria-pressed', String(paused));
      btn.textContent = paused ? 'Play' : 'Pause';
      btn.setAttribute('aria-label', paused ? 'Play the header illustration' : 'Pause the header illustration');
    },
    fallback() {
      wrap.classList.remove('gl-live'); wrap.classList.add('gl-static');
      wrap.querySelector('canvas')?.remove();
      btn?.remove(); btn = null;
      if (!fb) { fb = document.createElement('p'); fb.className = 'gl-fallback'; fb.textContent = FALLBACK; bar.append(fb); }
    },
  };
  const mount = () => {
    if (run || !wrap.isConnected) return;
    const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    wrap.prepend(cv);
    try { run = startGL(wrap, cv, kind, ui); }
    catch (e) { console.warn('banner: WebGL 2 shader failed, showing the still drawing', e); run = null; }
    if (!run) { ui.fallback(); return; }
    wrap.classList.add('gl-live'); wrap.classList.remove('gl-static');
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'gl-pause';
    btn.addEventListener('click', () => {
      paused = !paused; ui.sync(); run?.kick();
      document.querySelectorAll('.banner-gl .gl-pause').forEach(b => { if (b !== btn) b.dispatchEvent(new Event('vo:glsync')); });
    });
    btn.addEventListener('vo:glsync', () => { ui.sync(); run?.kick(); });
    bar.prepend(btn); ui.sync();
  };
  const leave = () => { run?.stop(); run = null; };
  if (ctx && typeof ctx.onMount === 'function') {
    ctx.onMount(mount);
    if (typeof ctx.onLeave === 'function') ctx.onLeave(leave);
  } else {
    // no router context: start once the element is in the document; the frame loop stops itself when it is removed
    requestAnimationFrame(() => requestAnimationFrame(mount));
  }
  return wrap;
}
