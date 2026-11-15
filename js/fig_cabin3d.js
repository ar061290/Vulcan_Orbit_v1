// 3D view of the smoke-drift model (data/drift.json): the 2D side-view result extruded across the cabin's depth and
// ray-marched in WebGL 2. The model is 2D, so the smoke is the same at every depth: the 3D is for seeing, not new physics.
// Package P4-B. WebGL starts in ctx.onMount and stops in ctx.onLeave; nothing plays until the visitor presses Play.
// Without WebGL 2 the card keeps its text summary and table and says why the drawing is missing.
// Shader look (colours, step count, glow fall-off, wall panels) is verbatim from main's js/cabin3d.js: illustration, not data.
import { h, card, fmt, calm, untip } from './lib.js';
import { keyNav } from './charts.js';
import { driftOK, driftEmpty, driftSummary, driftNumbers, frameValues } from './fig_drift.js';
import { blip } from './engine.js';

const TITLE = 'Walk around the smoke (3D)';
const MAXDET = 4;
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform vec2 res; uniform float yaw, pitch, dist, t, smax; uniform sampler2D smoke; uniform vec3 L; uniform vec2 fire;
uniform vec2 dets[${MAXDET}]; uniform float don[${MAXDET}]; uniform int nd, ns; uniform vec4 vents;
float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 box(vec3 ro, vec3 rd, vec3 b0, vec3 b1){ vec3 i = 1. / rd, t0 = (b0 - ro) * i, t1 = (b1 - ro) * i; vec3 a = min(t0, t1), b = max(t0, t1);
  return vec2(max(max(a.x, a.y), a.z), min(min(b.x, b.y), b.z)); }
// back to mg/m3 with the file's own scale: value = 255 * log10(1 + 99*c/scale_max) / 2
float dens(vec3 p){ vec2 q = vec2(p.x / L.x, 1. - p.y / L.y); float v = texture(smoke, q).r; float cc = smax * (pow(10., 2. * v) - 1.) / 99.;
  float edge = smoothstep(0., .08, p.z) * smoothstep(L.z, L.z - .08, p.z); return cc * edge; }
void main(){
  vec2 sp = (uv * res - .5 * res) / res.y; vec3 c = L * .5;
  vec3 ro = c + vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist;
  vec3 fw = normalize(c - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw), rd = normalize(fw * 1.6 + rt * sp.x + up * sp.y);
  vec3 col = vec3(.035, .04, .055) + .03 * vec3(.3, .4, .7) * (1. - uv.y);
  vec2 hb = box(ro, rd, vec3(0), L);
  if (hb.x < hb.y && hb.y > 0.) {
    vec3 pw = ro + rd * hb.y, n = vec3(0);
    if (abs(pw.x) < 1e-3 || abs(pw.x - L.x) < 1e-3) n = vec3(sign(c.x - pw.x), 0, 0); else if (abs(pw.y) < 1e-3 || abs(pw.y - L.y) < 1e-3) n = vec3(0, sign(c.y - pw.y), 0); else n = vec3(0, 0, sign(c.z - pw.z));
    vec2 g = abs(n.x) > .5 ? pw.zy : abs(n.y) > .5 ? pw.xz : pw.xy;
    float panel = smoothstep(.0, .02, abs(fract(g.x * 2.) - .5) - .47) + smoothstep(.0, .02, abs(fract(g.y * 2.) - .5) - .47);
    vec3 wall = mix(vec3(.62, .64, .66), vec3(.80, .81, .80), h1(floor(g * 2.)) * .5) * (.55 + .45 * max(0., dot(n, normalize(vec3(.3, .8, .5)))));
    wall *= 1. - .25 * clamp(panel, 0., 1.);
    float handrail = smoothstep(.025, .0, abs(g.y - .95)) * step(.5, abs(n.z));
    wall = mix(wall, vec3(.85, .7, .2), handrail * .8);
    float vs = step(abs(pw.y - L.y), .02) * step(vents.x, pw.x) * step(pw.x, vents.y);
    float vr = step(abs(pw.x - L.x), .02) * step(vents.z, pw.y) * step(pw.y, vents.w);
    wall = mix(wall, vec3(.25, .3, .38), max(vs, vr));
    col = wall * .42;
    float t0 = max(hb.x, 0.), dt = (hb.y - t0) / float(ns), T = 1.; vec3 acc = vec3(0);
    float jit = h1(gl_FragCoord.xy + t);
    for (int i = 0; i < 72; i++) { if (i >= ns) break; vec3 p = ro + rd * (t0 + (float(i) + jit) * dt); float d = dens(p);
      if (d > .05) { float a = 1. - exp(-d * dt * .09); vec3 sc = mix(vec3(.80, .82, .86), vec3(1., .98, .95), clamp(p.y / L.y, 0., 1.)); acc += T * a * sc; T *= 1. - a; }
      float fd = length(p - vec3(fire, c.z)); acc += T * vec3(.35, .55, 1.) * exp(-fd * 14.) * dt * 9.;
      // detector lamps (feat/ui-lock): dim slate while quiet, fire orange (#FF7A3D) once the file's alarm time is reached
      vec3 dl = vec3(0);
      for (int j = 0; j < ${MAXDET}; j++) { if (j >= nd) break; float r = length(p - vec3(dets[j], c.z));
        dl += mix(vec3(.30, .34, .42) * .45 * exp(-r * 40.), vec3(1., .478, .239) * (exp(-r * 40.) + .35 * exp(-r * 12.)), don[j]); }
      acc += T * dl * dt * 14.;
      if (T < .02) break; }
    col = col * T + acc;
  }
  col = pow(col, vec3(.95)); o = vec4(col, 1.);
}`;

// camera, verbatim from main: start yaw 0.7, pitch 0.25, distance 5.2, pitch clamp −0.6..1.2, drag 1/200 rad per px, DPR cap 1.5
const VIEW0 = { yaw: 0.7, pitch: 0.25 }, DIST = 5.2, PMIN = -0.6, PMAX = 1.2, STEP_MS = 220;
const KEY_YAW = Math.PI / 12, KEY_PITCH = 0.15;   // keyboard and button step (team choice: 15° turn, 0.15 rad tilt)
// feat/ui-lock view feel (team choices, not data): zoom range in camera distance, zoom step, inertia decay, fly-in start
const DMIN = 2.4, DMAX = 10, ZOOM_STEP = 1.18, SPIN_TAU = 380, FLY_FROM = 10, FLY_YAW = 0.55, FLY_MS = 1500;
// camera motion (fly-in, inertia) also stops when Read your way sets Effects: Off (html[data-effects=off], site v3 merge)
const still = () => document.documentElement.dataset.motion === 'calm' || document.documentElement.dataset.effects === 'off' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
// performance budget (feat/v3-merge): phones and low-end laptops get fewer pixels and ray-march steps; the GL context
// exists only while the cabin is on screen and is handed back 2 s after it leaves (or at once on page leave)
const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
const lowEnd = () => mq('(pointer:coarse)') || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const PX_LOW = 250000, PX_HIGH = 900000, STEPS_LOW = 40, STEPS_HIGH = 72, RELEASE_MS = 2000;
const easeMove = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // close to --ease-move cubic-bezier(.65,0,.35,1)
const words = ['no', 'one', 'two', 'three', 'four'];

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };

/** The same camera as the shader, run forward: a cabin point → canvas fraction (0..1 from the top-left), or null if behind. */
function project(P, L, yaw, pitch, aspect, dist = DIST) {
  const c = L.map(v => v / 2), ro = [c[0] + Math.sin(yaw) * Math.cos(pitch) * dist, c[1] + Math.sin(pitch) * dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
  const fw = norm3(sub3(c, ro)), rt = norm3(cross3(fw, [0, 1, 0])), up = cross3(rt, fw), v = sub3(P, ro), a = dot3(v, fw);
  if (a <= 0) return null;
  const sx = 1.6 * dot3(v, rt) / a, sy = 1.6 * dot3(v, up) / a;   // sp = (uv*res - res/2) / res.y
  return { fx: (sx + aspect / 2) / aspect, fy: 1 - (sy + 0.5) };
}

/** Where the lamp rule comes from, in the file's own words and numbers (alarm_mg_m3, detector_delay_s, detectors[].alarm_s). */
function alarmText(d, sources) {
  // the what-if file lists its sources as "Alarm <level> mg/m3: <reference>"; use the one for this file's level, if any
  const cite = Number.isFinite(d.alarm_mg_m3) && Array.isArray(sources) ? (sources.map(String).find(x => new RegExp(`^Alarm\\s+${String(d.alarm_mg_m3).replace('.', '\\.')}\\s*mg/m3:`, 'i').test(x)) || '').replace(/^[^:]*:\s*/, '') : '';
  const lvl = Number.isFinite(d.alarm_mg_m3) ? `${fmt(d.alarm_mg_m3, 2)} mg/m³` : null, delay = Number.isFinite(d.detector_delay_s) ? `${fmt(d.detector_delay_s, 0)} s` : null;
  return [h('span', { class: 'cab3d-tag' }, 'DETECTOR LAMPS'), ' ',
    `A lamp turns orange at that detector's alarm time in data/drift.json (detectors[].alarm_s): when the air it samples reaches ${lvl ? `the file's alarm level of ${lvl} (alarm_mg_m3)` : 'the file\'s alarm level (not stated in the file)'}${delay ? `, plus the file's ${delay} detector delay (detector_delay_s)` : ''}.`,
    cite ? ` Level source, as listed in data/whatif.json: ${cite}.` : ''];
}

export function cabin3dCard(d, ctx, { sources } = {}) {
  if (!driftOK(d)) return driftEmpty(TITLE, 'drift');
  const n = d.frames.length, depth = d.ly_m;   // cabin depth: the model says 2.0 m (assumptions[0]); main uses ly_m
  const L = [d.lx_m, d.ly_m, depth], dets = d.detectors.slice(0, MAXDET);
  const id = `cab3d-${Math.random().toString(36).slice(2, 8)}`;
  let k = Math.floor(n * 0.15);   // main: open at 15 % of the run
  let yaw = VIEW0.yaw, pitch = VIEW0.pitch, dist = DIST;
  let spin = null, fly = null, flyPending = false;   // inertia after a drag {vy, vp} in rad/ms; the one-off fly-in {t0}

  const cv = h('canvas', { class: 'cab3d-cv' });
  const fallback = h('p', { class: 'cab3d-fallback', hidden: true });
  // detector lamps beside the drawing: lit from detectors[].alarm_s in the file, never from a level set here
  const lamps = dets.map((det, i) => h('li', { class: 'cab3d-lamp' }, h('i', { 'aria-hidden': 'true' }), h('span', { class: 'cab3d-lname' }, `${i + 1} · ${det.name}`), h('b', {})));
  const lampList = h('ul', { class: 'cab3d-lamps', 'aria-label': 'Detector lamps' }, lamps);
  const wrap = h('div', { class: 'cab3d hud' }, cv, fallback);
  let litMask = '';
  const slider = h('input', { type: 'range', id: `${id}-t`, min: 0, max: n - 1, step: 1, value: k, class: 'drift-slider' });
  const clock = h('output', { class: 'cab3d-t', for: `${id}-t` });
  const play = h('button', { type: 'button', class: 'chip', 'aria-pressed': false }, 'Play');
  const summary = h('p', { class: 'drift-sum' });
  const viewOut = h('span', { class: 'cab3d-view' });
  let api = null;   // set once WebGL runs: {draw(), setFrame(), stop()}

  const setK = (v, from) => {
    k = Math.max(0, Math.min(n - 1, v));
    const t = k * (d.frame_dt_s ?? 0);
    slider.value = String(k); slider.setAttribute('aria-valuetext', `${fmt(t, 0)} s`); clock.textContent = `${fmt(t, 0)} s`;
    summary.textContent = driftSummary(d, k);
    const on = dets.map(det => det.alarm_s != null && t >= det.alarm_s);
    lamps.forEach((li, i) => { li.classList.toggle('on', on[i]); li.lastChild.textContent = dets[i].alarm_s == null ? 'no alarm' : on[i] ? `alarm at ${fmt(dets[i].alarm_s, 0)} s` : 'quiet'; });
    const mask = on.map(Number).join('');
    if (litMask && mask !== litMask && on.some((x, i) => x && litMask[i] === '0')) blip(880);   // a lamp just came on
    litMask = mask; api?.lamps(on);
    if (from !== 'gl') api?.frame();
  };
  const deg = r => Math.round(((r * 180 / Math.PI) % 360 + 360) % 360);
  const settleFly = () => { if (flyPending) { flyPending = false; dist = DIST; yaw = VIEW0.yaw; } fly = null; };
  const turn = (dy, dp) => { settleFly(); yaw -= dy; pitch = Math.max(PMIN, Math.min(PMAX, pitch + dp)); fly = null; untip(); showView(); api?.kick(); };
  const zoomTo = v => { settleFly(); dist = Math.max(DMIN, Math.min(DMAX, v)); fly = null; untip(); showView(); api?.kick(); };
  const zoom = f => zoomTo(dist * f);
  const reset = () => { flyPending = false; yaw = VIEW0.yaw; pitch = VIEW0.pitch; dist = DIST; spin = null; fly = null; untip(); showView(); api?.kick(); };
  const showView = () => { viewOut.textContent = `View: turned ${deg(yaw)}°, tilted ${Math.round(pitch * 180 / Math.PI)}°, ${Math.round(DIST / dist * 100)}% zoom`; };
  const vb = (label, fn) => h('button', { type: 'button', class: 'chip', onclick: fn }, label);
  let playing = false, timer = 0;
  const setPlaying = on => {
    playing = on; play.textContent = on ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(on));
    clearInterval(timer); timer = 0;
    if (on && api) api.kick();
    else if (on) timer = setInterval(() => { if (!cv.isConnected || k >= n - 1) return setPlaying(false); setK(k + 1); }, STEP_MS);   // no WebGL: the summary still steps
  };
  play.addEventListener('click', () => { if (!playing && k >= n - 1) setK(0); setPlaying(!playing); });
  slider.addEventListener('input', () => { setPlaying(false); setK(+slider.value); });

  // keyboard on the drawing: Shift + arrows turn it (handled first), plain arrows read the fire and detectors
  cv.setAttribute('tabindex', '0');
  cv.addEventListener('keydown', e => {
    const z = { '+': 1 / ZOOM_STEP, '=': 1 / ZOOM_STEP, '-': ZOOM_STEP, _: ZOOM_STEP }[e.key];   // + and - mirror pinch zoom
    if (z && !e.ctrlKey && !e.metaKey) { e.preventDefault(); zoom(z); return; }
    if (!e.shiftKey) return;
    const m = { ArrowLeft: [KEY_YAW, 0], ArrowRight: [-KEY_YAW, 0], ArrowUp: [0, KEY_PITCH], ArrowDown: [0, -KEY_PITCH] }[e.key];
    if (!m) return;
    e.preventDefault(); e.stopImmediatePropagation(); turn(m[0], m[1]);
  });
  const anchor = P => () => {
    const r = cv.getBoundingClientRect(), q = project(P, L, yaw, pitch, r.width / Math.max(1, r.height), dist);
    return q ? { x: r.left + Math.max(0, Math.min(1, q.fx)) * r.width, y: r.top + Math.max(0, Math.min(1, q.fy)) * r.height } : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  keyNav(cv, [
    { html: `<b>Fire (smoke source)</b><br>${fmt(d.fire[0], 2)} m along, ${fmt(d.fire[1], 2)} m up, mid-depth`, anchor: anchor([d.fire[0], d.fire[1], depth / 2]) },
    ...dets.map((det, i) => ({
      get html() { const v = frameValues(d, k), x = v.dets[i], on = det.alarm_s != null && v.t >= det.alarm_s; return `<b>${i + 1}. ${det.name}</b><br>${fmt(det.x, 2)} m along, ${fmt(det.y, 2)} m up<br>At ${fmt(v.t, 0)} s: ${det.alarm_s == null ? 'no alarm' : on ? `alarm at ${fmt(det.alarm_s, 0)} s` : 'quiet'}${x.c != null ? `, about ${x.c < 0.005 ? 'below 0.01' : Number(x.c.toPrecision(2))} mg/m³` : ''}`; },
      anchor: anchor([det.x, det.y, depth / 2]) })),
  ], { label: '3D view of smoke drifting through a cabin with no buoyancy. Arrow keys read the fire and detector values; Shift and the arrow keys turn the view; plus and minus zoom' });

  // drag to turn (pointer), as on main; feat/ui-lock adds inertia on release, two-pointer pinch and ctrl + wheel zoom
  let drag = null, pinch = null;
  const pts = new Map();
  const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  cv.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch { /* capture is optional */ }
    spin = null; settleFly();
    if (pts.size === 2) { drag = null; pinch = { g0: gap(), d0: dist }; }
    else if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, t: performance.now(), vy: 0, vp: 0 };
    api?.kick();
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) { zoomTo(pinch.d0 * pinch.g0 / gap()); return; }
    if (!drag) return;
    const now = performance.now(), dt = Math.max(1, now - drag.t), dx = (e.clientX - drag.x) / 200, dy = (e.clientY - drag.y) / 200;
    drag.vy = .7 * (dx / dt) + .3 * drag.vy; drag.vp = .7 * (dy / dt) + .3 * drag.vp;   // rad per ms, smoothed
    drag.x = e.clientX; drag.y = e.clientY; drag.t = now; turn(dx, dy);
  });
  const endDrag = e => {
    pts.delete(e.pointerId);
    if (pinch) { if (pts.size < 2) pinch = null; if (pts.size === 1) { const [p] = pts.values(); drag = { x: p.x, y: p.y, t: performance.now(), vy: 0, vp: 0 }; } api?.kick(); return; }
    if (drag && e.type === 'pointerup' && !still() && performance.now() - drag.t < 80 && Math.hypot(drag.vy, drag.vp) > 2e-4) spin = { vy: drag.vy, vp: drag.vp };
    drag = null; api?.kick();
  };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('wheel', e => {   // ctrl + wheel (and trackpad pinch, which arrives as ctrl + wheel) zooms; a plain wheel scrolls the page
    if (!e.ctrlKey) return;
    e.preventDefault(); zoomTo(dist * Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.01));
  }, { passive: false });
  /** One frame of camera motion: the fly-in, then any inertia. Returns true while something still moves. */
  const motion = (now, dtms) => {
    let busy = false;
    if (fly) {
      const p = Math.min(1, (now - fly.t0) / FLY_MS), e = easeMove(p);
      dist = FLY_FROM + (DIST - FLY_FROM) * e; yaw = VIEW0.yaw + FLY_YAW * (1 - e);
      if (p >= 1) fly = null; else busy = true; showView();
    }
    if (spin && !drag) {
      yaw -= spin.vy * dtms; pitch = Math.max(PMIN, Math.min(PMAX, pitch + spin.vp * dtms));
      const f = Math.exp(-dtms / SPIN_TAU); spin.vy *= f; spin.vp *= f;
      if (Math.hypot(spin.vy, spin.vp) < 2e-5) spin = null; else busy = true; showView();
    }
    return busy;
  };
  const beginFly = () => { if (!flyPending) return; flyPending = false; if (still()) { dist = DIST; yaw = VIEW0.yaw; showView(); return; } fly = { t0: performance.now() }; api?.kick(); };

  function startGL() {
    const fail = why => { cv.hidden = true; fallback.hidden = false; fallback.textContent = `${why} The 2D map in "Where the smoke goes" shows the same model, and the summary and table below give its values.`; return null; };
    let gl = null;
    try { gl = cv.getContext('webgl2', { antialias: false }); } catch { gl = null; }
    if (!gl) return fail('This view needs WebGL 2, which this browser has turned off or does not support.');
    let pr;
    try {
      const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    } catch (e) { console.warn('cabin3d: shader failed', e); return fail('This view could not start its WebGL 2 drawing.'); }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, d.nx, d.ny, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(d.nx * d.ny));
    for (const [a, b] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, b);
    const U = nm => gl.getUniformLocation(pr, nm);
    gl.uniform3f(U('L'), L[0], L[1], L[2]); gl.uniform2f(U('fire'), d.fire[0], d.fire[1]);
    gl.uniform1f(U('smax'), d.scale_max_mg_m3 > 0 ? d.scale_max_mg_m3 : 0);   // no stated scale: no smoke drawn rather than a guessed one
    const dv = new Float32Array(MAXDET * 2); dets.forEach((x, i) => { dv[i * 2] = x.x; dv[i * 2 + 1] = x.y; });
    gl.uniform2fv(U('dets'), dv); gl.uniform1i(U('nd'), dets.length);
    const low = lowEnd();
    gl.uniform1i(U('ns'), low ? STEPS_LOW : STEPS_HIGH);
    const setLamps = on => { gl.useProgram(pr); const a = new Float32Array(MAXDET); on.forEach((x, i) => { if (i < MAXDET) a[i] = x ? 1 : 0; }); gl.uniform1fv(U('don'), a); };
    setLamps(dets.map(det => det.alarm_s != null && k * (d.frame_dt_s ?? 0) >= det.alarm_s));
    // vents: the shader draws a ceiling supply and a right-wall return, the defaults the file uses; other walls are not drawn
    const sw = d.supply_wall || 'top', rw = d.return_wall || 'right';
    const s = sw === 'top' && Array.isArray(d.supply) ? [d.supply[0] * d.lx_m, d.supply[1] * d.lx_m] : [-1, -1];
    const r = rw === 'right' && Array.isArray(d.ret) ? [d.ret[0] * d.ly_m, d.ret[1] * d.ly_m] : [-1, -1];
    gl.uniform4f(U('vents'), s[0], s[1], r[0], r[1]);
    let raf = 0, last = 0, dead = false, prevNow = 0, inRender = false;
    const scale = Math.min(devicePixelRatio || 1, low ? 1 : 1.5), budget = low ? PX_LOW : PX_HIGH;
    const upload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, d.nx, d.ny, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(d.frames[k])); };
    const render = now => {
      raf = 0; if (dead || !onScreen || document.hidden) { prevNow = 0; return; }
      inRender = true;
      const moving = motion(now, prevNow ? Math.min(50, now - prevNow) : 16); prevNow = now;
      if (playing && now - last > STEP_MS) {
        last = now;
        if (k >= n - 1) { if (calm()) setPlaying(false); else { setK(0, 'gl'); upload(); } }   // loops as on main; in Calm it stops at the end
        else { setK(k + 1, 'gl'); upload(); }
      }
      const rc = cv.getBoundingClientRect(), px = rc.width * rc.height * scale * scale, f = px > budget ? scale * Math.sqrt(budget / px) : scale;   // pixel cap; CSS stretches the rest
      const w = Math.max(1, Math.round(rc.width * f)), hh = Math.max(1, Math.round(rc.height * f));
      if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
      gl.viewport(0, 0, w, hh); gl.uniform2f(U('res'), w, hh); gl.uniform1f(U('yaw'), yaw); gl.uniform1f(U('pitch'), pitch); gl.uniform1f(U('dist'), dist);
      gl.uniform1f(U('t'), calm() ? 0 : now / 1000);   // Calm: the ray-march dither stays still
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      inRender = false;
      if (playing || drag || pinch || moving) raf = requestAnimationFrame(render); else prevNow = 0;
    };
    const kick = () => { if (!raf && !inRender && onScreen && !dead && !document.hidden) raf = requestAnimationFrame(render); };
    // off screen or a hidden tab: no frames (the on-screen watch lives in begin(), which also hands the context back)
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVis);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(kick) : null;
    ro?.observe(wrap);
    const lost = () => { dead = true; if (!releasing) { api = null; fail('The WebGL drawing was stopped by the browser.'); } };
    cv.addEventListener('webglcontextlost', lost);
    upload(); kick();
    return {
      frame: () => { upload(); kick(); }, kick, lamps: on => { if (!dead) { setLamps(on); kick(); } },
      stop: () => {
        dead = true; if (raf) cancelAnimationFrame(raf); raf = 0; ro?.disconnect(); document.removeEventListener('visibilitychange', onVis); cv.removeEventListener('webglcontextlost', lost);
        releasing = true; try { const x = gl.getExtension('WEBGL_lose_context'); loseExt = x || loseExt; x?.loseContext(); } catch { /* ignore */ } releasing = false;
      },
    };
  }
  // a context we handed back is asked for again with restoreContext (a lost canvas cannot make a new one); preventDefault
  // on every loss keeps that possible. A loss the browser forces shows the fallback text (handled in startGL).
  let loseExt = null, releasing = false, restoring = false, onScreen = false, wanted = false, offT = 0, io = null;
  cv.addEventListener('webglcontextlost', e => e.preventDefault());
  cv.addEventListener('webglcontextrestored', () => { restoring = false; if (wanted && onScreen && !api) { api = startGL(); if (playing && api) setPlaying(true); api?.kick(); } else if (!api) { releasing = true; try { loseExt?.loseContext(); } catch { /* ignore */ } releasing = false; } });
  const acquire = () => {
    if (api || restoring || cv.hidden || !cv.isConnected) return;   // cv.hidden: the fallback text is already showing
    let gl = null; try { gl = cv.getContext('webgl2', { antialias: false }); } catch { gl = null; }
    if (gl && gl.isContextLost()) {
      if (!loseExt) return;
      restoring = true; try { loseExt.restoreContext(); } catch { restoring = false; fail0('This view could not restart its WebGL 2 drawing.'); return; }
      setTimeout(() => { if (restoring) { restoring = false; fail0('This view could not restart its WebGL 2 drawing.'); } }, 3000);   // no restore event: say so, never a blank box
      return;
    }
    api = startGL();
  };
  const release = () => { clearTimeout(offT); offT = 0; if (api) { api.stop(); api = null; if (playing) setPlaying(true); } };   // playing on: the summary keeps stepping
  const fail0 = why => { cv.hidden = true; fallback.hidden = false; fallback.textContent = `${why} The 2D map in "Where the smoke goes" shows the same model, and the summary and table below give its values.`; };

  const show = on => {
    onScreen = on;
    if (on) {
      clearTimeout(offT); offT = 0; acquire(); if (playing && api) setPlaying(true);   // hand playback back to the GL loop
      if (api) beginFly(); else if (!restoring && flyPending) { flyPending = false; dist = DIST; yaw = VIEW0.yaw; showView(); }   // no WebGL: the normal view
      api?.kick();
    }
    else if (api && !offT) offT = setTimeout(release, RELEASE_MS);   // scrolled away: give the GPU context back after 2 s
  };
  const begin = () => {
    if (wanted) return;
    wanted = true;
    flyPending = !still(); if (flyPending) { dist = FLY_FROM; yaw = VIEW0.yaw + FLY_YAW; showView(); }   // calm: the normal view, no flight
    if (typeof IntersectionObserver === 'function') { io = new IntersectionObserver(([e]) => show(e.isIntersecting), { rootMargin: '120px 0px' }); io.observe(wrap); }
    else show(true);
  };
  const end = () => { wanted = false; io?.disconnect(); io = null; onScreen = false; setPlaying(false); spin = null; fly = null; flyPending = false; pts.clear(); drag = null; pinch = null; release(); };
  if (ctx && typeof ctx.onMount === 'function') { if (!ctx.detached) { ctx.onMount(begin); ctx.onLeave?.(end); } }
  else queueMicrotask(begin);   // called without a ctx: start once the card is in the page
  setK(k, 'gl'); showView();

  const nd = dets.length;
  return card(TITLE, d.status, 'The same smoke-drift model, drawn as a cabin you can turn. Drag to look around; play to watch the smoke move with the air.',
    wrap, lampList,
    h('div', { class: 'row drift-ctl' }, play, h('label', { for: `${id}-t`, class: 'drift-tlabel' }, 'Time'), slider, clock),
    h('div', { class: 'row cab3d-keys', role: 'group', 'aria-label': 'Turn the view' },
      vb('Turn left', () => turn(KEY_YAW, 0)), vb('Turn right', () => turn(-KEY_YAW, 0)), vb('Tilt up', () => turn(0, KEY_PITCH)), vb('Tilt down', () => turn(0, -KEY_PITCH)),
      vb('Zoom in', () => zoom(1 / ZOOM_STEP)), vb('Zoom out', () => zoom(ZOOM_STEP)), vb('Reset view', reset), viewOut),
    h('p', { class: 'cab3d-alarm' }, alarmText(d, sources)),
    h('p', { class: 'cab3d-hint' }, h('small', {}, 'Drag to turn (it keeps turning a little when you let go); pinch, or Ctrl and the mouse wheel, to zoom. Keyboard: Tab to the drawing, then the arrow keys read the fire and each detector; Shift and the arrow keys turn it; + and − zoom.')),
    summary, driftNumbers(d, 'Smoke at each detector, every frame (same model as the 2D map)'),
    h('p', {}, h('small', {}, `The model is a 2D side view, so the smoke is drawn the same at every depth. The blue glow is the fire, red lights are the ${words[nd] ?? nd} detector${nd === 1 ? '' : 's'}, dark strips are the air supply and return. Illustration of the model, not a measurement.`)));
}
