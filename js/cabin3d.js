// 3D view of the smoke-drift model (data/drift.json): the 2D side-view result extruded across the cabin's depth and
// ray-marched in WebGL 2. The model is 2D, so the smoke is the same at every depth: the 3D is for seeing, not new physics.
import { h, card } from './lib.js';
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform vec2 res; uniform float yaw, pitch, dist, t; uniform sampler2D smoke; uniform vec3 L; uniform vec2 fire; uniform vec4 det; uniform vec4 vents;
float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 box(vec3 ro, vec3 rd, vec3 b0, vec3 b1){ vec3 i = 1. / rd, t0 = (b0 - ro) * i, t1 = (b1 - ro) * i; vec3 a = min(t0, t1), b = max(t0, t1);
  return vec2(max(max(a.x, a.y), a.z), min(min(b.x, b.y), b.z)); }
float dens(vec3 p){ vec2 q = vec2(p.x / L.x, 1. - p.y / L.y); float v = texture(smoke, q).r; float cc = 20. * (pow(10., 2. * v) - 1.) / 99.;   // back to mg/m3 (drift.json scale)
  float edge = smoothstep(0., .08, p.z) * smoothstep(L.z, L.z - .08, p.z); return cc * edge; }
void main(){
  vec2 sp = (uv * res - .5 * res) / res.y; vec3 c = L * .5;
  vec3 ro = c + vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist;
  vec3 fw = normalize(c - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw), rd = normalize(fw * 1.6 + rt * sp.x + up * sp.y);
  vec3 col = vec3(.035, .04, .055) + .03 * vec3(.3, .4, .7) * (1. - uv.y);
  vec2 hb = box(ro, rd, vec3(0), L);
  if (hb.x < hb.y && hb.y > 0.) {
    // back walls: the far side of the box from the camera, drawn as a cabin with panels and racks
    vec3 pw = ro + rd * hb.y, n = vec3(0);
    if (abs(pw.x) < 1e-3 || abs(pw.x - L.x) < 1e-3) n = vec3(sign(c.x - pw.x), 0, 0); else if (abs(pw.y) < 1e-3 || abs(pw.y - L.y) < 1e-3) n = vec3(0, sign(c.y - pw.y), 0); else n = vec3(0, 0, sign(c.z - pw.z));
    vec2 g = abs(n.x) > .5 ? pw.zy : abs(n.y) > .5 ? pw.xz : pw.xy;
    float panel = smoothstep(.0, .02, abs(fract(g.x * 2.) - .5) - .47) + smoothstep(.0, .02, abs(fract(g.y * 2.) - .5) - .47);
    vec3 wall = mix(vec3(.62, .64, .66), vec3(.80, .81, .80), h1(floor(g * 2.)) * .5) * (.55 + .45 * max(0., dot(n, normalize(vec3(.3, .8, .5)))));
    wall *= 1. - .25 * clamp(panel, 0., 1.);
    float handrail = smoothstep(.025, .0, abs(g.y - .95)) * step(.5, abs(n.z));
    wall = mix(wall, vec3(.85, .7, .2), handrail * .8);
    // supply and return vents (on the walls named in the model), detector lights
    float vs = step(abs(pw.y - L.y), .02) * step(vents.x, pw.x) * step(pw.x, vents.y);
    float vr = step(abs(pw.x - L.x), .02) * step(vents.z, pw.y) * step(pw.y, vents.w);
    wall = mix(wall, vec3(.25, .3, .38), max(vs, vr));
    col = wall * .42;
    // smoke: march from the near face to the far face
    float t0 = max(hb.x, 0.), dt = (hb.y - t0) / 72., T = 1.; vec3 acc = vec3(0);
    float jit = h1(gl_FragCoord.xy + t);
    for (int i = 0; i < 72; i++) { vec3 p = ro + rd * (t0 + (float(i) + jit) * dt); float d = dens(p);
      if (d > .05) { float a = 1. - exp(-d * dt * .09); vec3 sc = mix(vec3(.80, .82, .86), vec3(1., .98, .95), clamp(p.y / L.y, 0., 1.)); acc += T * a * sc; T *= 1. - a; }
      // fire glow and detectors as small lights in the volume
      float fd = length(p - vec3(fire, c.z)); acc += T * vec3(.35, .55, 1.) * exp(-fd * 14.) * dt * 9.;
      float d1 = length(p - vec3(det.xy, c.z)), d2 = length(p - vec3(det.zw, c.z)); acc += T * vec3(1., .25, .15) * (exp(-d1 * 40.) + exp(-d2 * 40.)) * dt * 14.;
      if (T < .02) break; }
    col = col * T + acc;
  }
  col = pow(col, vec3(.95)); o = vec4(col, 1.);
}`;
export function cabin3d(d) {
  const wrap = h('div', { class: 'cab3d' }), cv = h('canvas', { 'aria-label': '3D view of smoke drifting through a cabin with no buoyancy' }); wrap.append(cv);
  const slider = h('input', { type: 'range', min: 0, max: d.frames.length - 1, value: Math.floor(d.frames.length * 0.15), 'aria-label': 'Time' });
  const clock = h('b', { class: 'cab-t' }), play = h('button', { type: 'button', class: 'chip' }, '▶ Play');
  const gl = cv.getContext('webgl2', { antialias: false });
  const shell = card('Walk around the smoke (3D)', d.status, 'The same smoke-drift model, drawn as a cabin you can turn. Drag to look around; play to watch the smoke move with the air.',
    wrap, h('div', { class: 'row', style: 'margin-top:10px' }, play, slider, clock),
    h('p', {}, h('small', {}, 'The model is a 2D side view, so the smoke is drawn the same at every depth. The blue glow is the fire, red lights are the two detectors, dark strips are the air supply and return. Illustration of the model, not a measurement.')));
  if (!gl) { wrap.append(h('p', {}, 'This view needs WebGL 2.')); return shell; }
  const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, d.nx, d.ny, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(d.nx * d.ny));
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const U = n => gl.getUniformLocation(pr, n), depth = d.ly_m;   // cabin depth: the model says 2.0 m (assumptions[0])
  gl.uniform3f(U('L'), d.lx_m, d.ly_m, depth); gl.uniform2f(U('fire'), d.fire[0], d.fire[1]);
  gl.uniform4f(U('det'), d.detectors[0].x, d.detectors[0].y, d.detectors[1].x, d.detectors[1].y);
  gl.uniform4f(U('vents'), d.supply[0] * d.lx_m, d.supply[1] * d.lx_m, d.ret[0] * d.ly_m, d.ret[1] * d.ly_m);
  let yaw = 0.7, pitch = 0.25, drag = null, raf = 0, playing = false, last = 0, k = +slider.value, scale = Math.min(devicePixelRatio || 1, 1.5), vis = false;
  const setFrame = () => { k = +slider.value; gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, d.nx, d.ny, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(d.frames[k])); clock.textContent = `${k * d.frame_dt_s} s`; kick(); };
  const frame = now => {
    raf = 0; if (!vis) return;
    if (playing && now - last > 220) { last = now; slider.value = String((k + 1) % d.frames.length); setFrame(); }
    const r = cv.getBoundingClientRect(), w = Math.round(r.width * scale), hh = Math.round(r.height * scale); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    gl.viewport(0, 0, w, hh); gl.uniform2f(U('res'), w, hh); gl.uniform1f(U('yaw'), yaw); gl.uniform1f(U('pitch'), pitch); gl.uniform1f(U('dist'), 5.2); gl.uniform1f(U('t'), now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (playing || drag) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && vis) raf = requestAnimationFrame(frame); };
  cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); kick(); });
  cv.addEventListener('pointermove', e => { if (!drag) return; yaw -= (e.clientX - drag[0]) / 200; pitch = Math.max(-0.6, Math.min(1.2, pitch + (e.clientY - drag[1]) / 200)); drag = [e.clientX, e.clientY]; kick(); });
  cv.addEventListener('pointerup', () => { drag = null; kick(); });
  slider.oninput = () => { playing = false; play.textContent = '▶ Play'; setFrame(); };
  play.onclick = () => { playing = !playing; play.textContent = playing ? '❚❚ Pause' : '▶ Play'; kick(); };
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; kick(); }).observe(wrap);
  new ResizeObserver(kick).observe(wrap);
  setFrame();
  return shell;
}
