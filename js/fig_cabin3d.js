// 3D view of the smoke-drift model (data/drift.json): the 2D side-view result extruded across the cabin's depth and
// ray-marched in WebGL 2. The model is 2D, so the smoke is the same at every depth: the 3D is for seeing, not new physics.
// Package P4-B. WebGL starts in ctx.onMount and stops in ctx.onLeave; nothing plays until the visitor presses Play.
// Without WebGL 2 the card keeps its text summary and table and says why the drawing is missing.
// Shader look (colours, step count, glow fall-off, wall panels) is verbatim from main's js/cabin3d.js: illustration, not data.
import { h, card, fmt, calm, untip } from './lib.js';
import { keyNav } from './charts.js';
import { driftOK, driftEmpty, driftSummary, driftNumbers, frameValues } from './fig_drift.js';

const TITLE = 'Walk around the smoke (3D)';
const MAXDET = 4;
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform vec2 res; uniform float yaw, pitch, dist, t, smax; uniform sampler2D smoke; uniform vec3 L; uniform vec2 fire;
uniform vec2 dets[${MAXDET}]; uniform int nd; uniform vec4 vents;
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
    float t0 = max(hb.x, 0.), dt = (hb.y - t0) / 72., T = 1.; vec3 acc = vec3(0);
    float jit = h1(gl_FragCoord.xy + t);
    for (int i = 0; i < 72; i++) { vec3 p = ro + rd * (t0 + (float(i) + jit) * dt); float d = dens(p);
      if (d > .05) { float a = 1. - exp(-d * dt * .09); vec3 sc = mix(vec3(.80, .82, .86), vec3(1., .98, .95), clamp(p.y / L.y, 0., 1.)); acc += T * a * sc; T *= 1. - a; }
      float fd = length(p - vec3(fire, c.z)); acc += T * vec3(.35, .55, 1.) * exp(-fd * 14.) * dt * 9.;
      float dl = 0.;
      for (int j = 0; j < ${MAXDET}; j++) { if (j >= nd) break; dl += exp(-length(p - vec3(dets[j], c.z)) * 40.); }
      acc += T * vec3(1., .25, .15) * dl * dt * 14.;
      if (T < .02) break; }
    col = col * T + acc;
  }
  col = pow(col, vec3(.95)); o = vec4(col, 1.);
}`;

// camera, verbatim from main: start yaw 0.7, pitch 0.25, distance 5.2, pitch clamp −0.6..1.2, drag 1/200 rad per px, DPR cap 1.5
const VIEW0 = { yaw: 0.7, pitch: 0.25 }, DIST = 5.2, PMIN = -0.6, PMAX = 1.2, STEP_MS = 220;
const KEY_YAW = Math.PI / 12, KEY_PITCH = 0.15;   // keyboard and button step (team choice: 15° turn, 0.15 rad tilt)
const words = ['no', 'one', 'two', 'three', 'four'];

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };

/** The same camera as the shader, run forward: a cabin point → canvas fraction (0..1 from the top-left), or null if behind. */
function project(P, L, yaw, pitch, aspect) {
  const c = L.map(v => v / 2), ro = [c[0] + Math.sin(yaw) * Math.cos(pitch) * DIST, c[1] + Math.sin(pitch) * DIST, c[2] + Math.cos(yaw) * Math.cos(pitch) * DIST];
  const fw = norm3(sub3(c, ro)), rt = norm3(cross3(fw, [0, 1, 0])), up = cross3(rt, fw), v = sub3(P, ro), a = dot3(v, fw);
  if (a <= 0) return null;
  const sx = 1.6 * dot3(v, rt) / a, sy = 1.6 * dot3(v, up) / a;   // sp = (uv*res - res/2) / res.y
  return { fx: (sx + aspect / 2) / aspect, fy: 1 - (sy + 0.5) };
}

export function cabin3dCard(d, ctx) {
  if (!driftOK(d)) return driftEmpty(TITLE, 'drift');
  const n = d.frames.length, depth = d.ly_m;   // cabin depth: the model says 2.0 m (assumptions[0]); main uses ly_m
  const L = [d.lx_m, d.ly_m, depth], dets = d.detectors.slice(0, MAXDET);
  const id = `cab3d-${Math.random().toString(36).slice(2, 8)}`;
  let k = Math.floor(n * 0.15);   // main: open at 15 % of the run
  let yaw = VIEW0.yaw, pitch = VIEW0.pitch;

  const cv = h('canvas', { class: 'cab3d-cv' });
  const fallback = h('p', { class: 'cab3d-fallback', hidden: true });
  const wrap = h('div', { class: 'cab3d' }, cv, fallback);
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
    if (from !== 'gl') api?.frame();
  };
  const deg = r => Math.round(((r * 180 / Math.PI) % 360 + 360) % 360);
  const turn = (dy, dp) => { yaw -= dy; pitch = Math.max(PMIN, Math.min(PMAX, pitch + dp)); untip(); showView(); api?.kick(); };
  const reset = () => { yaw = VIEW0.yaw; pitch = VIEW0.pitch; untip(); showView(); api?.kick(); };
  const showView = () => { viewOut.textContent = `View: turned ${deg(yaw)}°, tilted ${Math.round(pitch * 180 / Math.PI)}°`; };
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
    if (!e.shiftKey) return;
    const m = { ArrowLeft: [KEY_YAW, 0], ArrowRight: [-KEY_YAW, 0], ArrowUp: [0, KEY_PITCH], ArrowDown: [0, -KEY_PITCH] }[e.key];
    if (!m) return;
    e.preventDefault(); e.stopImmediatePropagation(); turn(m[0], m[1]);
  });
  const anchor = P => () => {
    const r = cv.getBoundingClientRect(), q = project(P, L, yaw, pitch, r.width / Math.max(1, r.height));
    return q ? { x: r.left + Math.max(0, Math.min(1, q.fx)) * r.width, y: r.top + Math.max(0, Math.min(1, q.fy)) * r.height } : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  keyNav(cv, [
    { html: `<b>Fire (smoke source)</b><br>${fmt(d.fire[0], 2)} m along, ${fmt(d.fire[1], 2)} m up, mid-depth`, anchor: anchor([d.fire[0], d.fire[1], depth / 2]) },
    ...dets.map((det, i) => ({
      get html() { const v = frameValues(d, k), x = v.dets[i], on = det.alarm_s != null && v.t >= det.alarm_s; return `<b>${i + 1}. ${det.name}</b><br>${fmt(det.x, 2)} m along, ${fmt(det.y, 2)} m up<br>At ${fmt(v.t, 0)} s: ${det.alarm_s == null ? 'no alarm' : on ? `alarm at ${fmt(det.alarm_s, 0)} s` : 'quiet'}${x.c != null ? `, about ${x.c < 0.005 ? 'below 0.01' : Number(x.c.toPrecision(2))} mg/m³` : ''}`; },
      anchor: anchor([det.x, det.y, depth / 2]) })),
  ], { label: '3D view of smoke drifting through a cabin with no buoyancy. Arrow keys read the fire and detector values; Shift and the arrow keys turn the view' });

  // drag to turn (pointer), as on main
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; try { cv.setPointerCapture(e.pointerId); } catch { /* capture is optional */ } api?.kick(); });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = (e.clientX - drag[0]) / 200, dy = (e.clientY - drag[1]) / 200; drag = [e.clientX, e.clientY]; turn(dx, dy); });
  const endDrag = () => { drag = null; api?.kick(); };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

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
    // vents: the shader draws a ceiling supply and a right-wall return, the defaults the file uses; other walls are not drawn
    const sw = d.supply_wall || 'top', rw = d.return_wall || 'right';
    const s = sw === 'top' && Array.isArray(d.supply) ? [d.supply[0] * d.lx_m, d.supply[1] * d.lx_m] : [-1, -1];
    const r = rw === 'right' && Array.isArray(d.ret) ? [d.ret[0] * d.ly_m, d.ret[1] * d.ly_m] : [-1, -1];
    gl.uniform4f(U('vents'), s[0], s[1], r[0], r[1]);
    let raf = 0, last = 0, vis = true, dead = false;
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    const upload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, d.nx, d.ny, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(d.frames[k])); };
    const render = now => {
      raf = 0; if (dead || !vis) return;
      if (playing && now - last > STEP_MS) {
        last = now;
        if (k >= n - 1) { if (calm()) setPlaying(false); else { setK(0, 'gl'); upload(); } }   // loops as on main; in Calm it stops at the end
        else { setK(k + 1, 'gl'); upload(); }
      }
      const rc = cv.getBoundingClientRect(), w = Math.max(1, Math.round(rc.width * scale)), hh = Math.max(1, Math.round(rc.height * scale));
      if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
      gl.viewport(0, 0, w, hh); gl.uniform2f(U('res'), w, hh); gl.uniform1f(U('yaw'), yaw); gl.uniform1f(U('pitch'), pitch); gl.uniform1f(U('dist'), DIST);
      gl.uniform1f(U('t'), calm() ? 0 : now / 1000);   // Calm: the ray-march dither stays still
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (playing || drag) raf = requestAnimationFrame(render);
    };
    const kick = () => { if (!raf && vis && !dead) raf = requestAnimationFrame(render); };
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => { vis = e.isIntersecting; kick(); }) : null;
    io?.observe(wrap);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(kick) : null;
    ro?.observe(wrap);
    const lost = e => { e.preventDefault(); dead = true; fail('The WebGL drawing was stopped by the browser.'); };
    cv.addEventListener('webglcontextlost', lost);
    upload(); kick();
    return {
      frame: () => { upload(); kick(); }, kick,
      stop: () => { dead = true; if (raf) cancelAnimationFrame(raf); raf = 0; io?.disconnect(); ro?.disconnect(); cv.removeEventListener('webglcontextlost', lost); try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ } },
    };
  }

  const begin = () => { if (!api) api = startGL(); };
  const end = () => { setPlaying(false); api?.stop(); api = null; };
  if (ctx && typeof ctx.onMount === 'function') { if (!ctx.detached) { ctx.onMount(begin); ctx.onLeave?.(end); } }
  else queueMicrotask(begin);   // called without a ctx: start once the card is in the page
  setK(k, 'gl'); showView();

  const nd = dets.length;
  return card(TITLE, d.status, 'The same smoke-drift model, drawn as a cabin you can turn. Drag to look around; play to watch the smoke move with the air.',
    wrap,
    h('div', { class: 'row drift-ctl' }, play, h('label', { for: `${id}-t`, class: 'drift-tlabel' }, 'Time'), slider, clock),
    h('div', { class: 'row cab3d-keys', role: 'group', 'aria-label': 'Turn the view' },
      vb('Turn left', () => turn(KEY_YAW, 0)), vb('Turn right', () => turn(-KEY_YAW, 0)), vb('Tilt up', () => turn(0, KEY_PITCH)), vb('Tilt down', () => turn(0, -KEY_PITCH)), vb('Reset view', reset), viewOut),
    h('p', { class: 'cab3d-hint' }, h('small', {}, 'Keyboard: Tab to the drawing, then the arrow keys read the fire and each detector; Shift and the arrow keys turn it.')),
    summary, driftNumbers(d, 'Smoke at each detector, every frame (same model as the 2D map)'),
    h('p', {}, h('small', {}, `The model is a 2D side view, so the smoke is drawn the same at every depth. The blue glow is the fire, red lights are the ${words[nd] ?? nd} detector${nd === 1 ? '' : 's'}, dark strips are the air supply and return. Illustration of the model, not a measurement.`)));
}
