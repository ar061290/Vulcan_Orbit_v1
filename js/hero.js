// Hero illustration: a ray-marched droplet flame, rendered live in WebGL 2 at the screen's native resolution.
// This is an ILLUSTRATION, not data. The shapes follow what NASA's FLEX and candle films show qualitatively:
// in microgravity a droplet flame is a near-spherical, mostly blue shell with a faint soot layer inside;
// at Earth gravity buoyancy stretches it into a bright, sooty, flickering teardrop.
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform vec2 res; uniform float t, g, yaw, pitch, fit;
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int k = 0; k < 4; k++) { s += a * vn(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
// flame-space coordinate: identity in microgravity, buoyant teardrop at 1 g
vec3 fq(vec3 p){
  float fl = g * (.035 * sin(t * 8.3 + p.y * 5.) + .02 * sin(t * 13.1 + p.y * 9.));
  vec3 q = p; q.x += fl * smoothstep(-.2, 1.2, p.y);
  q.y -= g * .63;
  q.y *= mix(1., .64, g);
  q.xz *= 1. + g * 1.1 * smoothstep(-.3, 1.4, p.y);
  return q * mix(1., 1.5, g);
}
vec3 bb(float k){ return vec3(1., .42 + .38 * k, .10 + .25 * k * k); } // warm soot glow, hotter = whiter
vec3 stars(vec3 d){
  vec3 c = vec3(0.); vec3 s = d * 180.; vec3 id = floor(s); float r = h3(id);
  if (r > .985) { float b = pow(max(0., 1. - length(fract(s) - .5) * 2.4), 6.); c += b * mix(vec3(.7,.8,1.), vec3(1.,.85,.7), h3(id + 3.)) * (r - .985) * 60.; }
  float neb = fbm(d * 2.2 + vec3(0, 0, t * .01));
  c += vec3(.20, .09, .07) * pow(neb, 3.) * .55 + vec3(.04, .06, .14) * pow(fbm(d * 3.1 + 9.), 2.) * .5;
  return c;
}
void main(){
  vec2 sp = (uv * res - .5 * res) / res.y; if (fit > .5) { sp *= 1.2; sp.y += .34 * g; } else if (res.x > res.y * 1.2) sp.x -= .42; else { sp *= 1.9; sp.y -= .7; }
  float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), spp = sin(pitch);
  vec3 ro = vec3(sy * cp, spp, cy * cp) * 4.6;
  vec3 fw = normalize(-ro), rt = normalize(cross(vec3(0,1,0), fw)), up = cross(fw, rt);
  vec3 rd = normalize(fw * 1.75 + rt * sp.x + up * sp.y);
  vec3 col = stars(rd) * .9;
  // droplet (fuel) at the origin
  float rD = .042, bD = dot(ro, rd), cD = dot(ro, ro) - rD * rD, hD = bD * bD - cD, tD = 1e9;
  if (hD > 0.) tD = -bD - sqrt(hD);
  // volume march inside a bounding sphere
  float R = 1.9, b = dot(ro, rd), c = dot(ro, ro) - R * R, hh = b * b - c;
  vec3 acc = vec3(0.); float tr = 1.;
  if (hh > 0.) {
    float t0 = max(0., -b - sqrt(hh)), t1 = min(-b + sqrt(hh), tD);
    const int N = 72; float dt = (t1 - t0) / float(N);
    float jit = h3(vec3(gl_FragCoord.xy, t * 60.));
    for (int i = 0; i < N; i++) {
      float tt = t0 + (float(i) + jit) * dt; vec3 p = ro + rd * tt; vec3 q = fq(p);
      float r = length(q);
      float n = fbm(q * 3.2 + vec3(0., -t * (.25 + 1.6 * g), 0.));
      // blue chemiluminescent reaction zone (thin shell)
      float Rb = .62 + .035 * (n - .5), wb = .028 + .05 * g;
      float blue = exp(-pow((r - Rb) / wb, 2.)) * (.7 + .6 * n);
      // soot: a faint shell inside the blue zone in microgravity; at 1 g it fills the flame above the base and glows yellow
      float Rs = .46 + .05 * (n - .5);
      float sootShell = exp(-pow((r - Rs) / .07, 2.)) * smoothstep(.2, .7, n);
      float sootFill = smoothstep(.70, .28, r) * smoothstep(-.08, .32, p.y) * (.55 + .9 * n);
      float soot = mix(.06 * sootShell, 1.25 * sootFill, g);
      float core = g * smoothstep(.42, .05, r) * smoothstep(.0, .4, p.y) * .7;
      float blueBase = mix(1., smoothstep(.18, -.12, p.y) * 1.3 + .02, g); // at 1 g blue only near the base
      vec3 e = vec3(.16, .36, 1.3) * blue * blueBase * 4.2 + vec3(1., .46, .10) * soot * 2.6 + vec3(1., .82, .55) * core * 2.4;
      e += vec3(.06, .10, .35) * exp(-pow(r / .9, 2.)) * .05 * (1. - g);
      float dens = soot * .35 + core * .2;
      acc += e * tr * dt; tr *= exp(-dens * dt * 1.6);
    }
  }
  col = col * tr + acc;
  if (tD < 1e8) { // droplet surface: dark liquid, rim-lit by the flame
    vec3 p = ro + rd * tD, nrm = normalize(p);
    float fr = pow(1. - max(0., dot(-rd, nrm)), 3.);
    vec3 lit = mix(vec3(.25, .45, 1.), vec3(1., .6, .25), g) * (.18 + 1.4 * fr);
    col = col * .15 + lit * tr + acc * .4;
  }
  col = 1. - exp(-col * 1.35);
  col = pow(col, vec3(.4545));
  float v = smoothstep(1.25, .25, length(sp)); col *= mix(.55, 1., v);
  col += (h3(vec3(gl_FragCoord.xy, t)) - .5) / 255.; // dither, no banding
  o = vec4(col, 1.);
}`;

export function hero(opts = {}) {
  const wrap = document.createElement('div'); wrap.className = 'hero-gl';
  const cv = document.createElement('canvas'); cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'Illustration: a fuel droplet burning, with gravity switched off (a dim blue sphere) or on (a bright yellow teardrop)');
  wrap.append(cv);
  const gl = cv.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) { wrap.classList.add('nogl'); return { el: wrap, setG() {}, ok: false }; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n), uRes = U('res'), uT = U('t'), uG = U('g'), uYaw = U('yaw'), uPitch = U('pitch'), uFit = U('fit');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'calm';
  let g = opts.g ?? 0, gT = g, yaw = .5, pitch = .12, vy = 0, drag = null, scale = Math.min(devicePixelRatio || 1, 2), visible = true, raf = 0, slow = 0, start = performance.now();
  const size = () => { const r = cv.getBoundingClientRect(); const w = Math.round(r.width * scale), h = Math.round(r.height * scale); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } gl.viewport(0, 0, w, h); };
  let lastT = 0;
  const frame = now => {
    raf = 0; if (!visible) return;
    const dt = lastT ? Math.min(.1, (now - lastT) / 1000) : .016; lastT = now;
    // keep it smooth: if frames are slow, render fewer pixels (never below 1x CSS pixels on HiDPI, 0.6x otherwise)
    if (dt > .028) { if (++slow > 20 && scale > .6) { scale = Math.max(.6, scale * .85); slow = 0; } } else slow = Math.max(0, slow - 1);
    g += (gT - g) * Math.min(1, dt * 2.2);
    if (!drag) { yaw += (reduce ? 0 : .06) * dt + vy; vy *= .94; }
    size();
    gl.uniform2f(uRes, cv.width, cv.height); gl.uniform1f(uT, reduce ? 3 : (now - start) / 1000); gl.uniform1f(uG, g); gl.uniform1f(uYaw, yaw); gl.uniform1f(uPitch, pitch); gl.uniform1f(uFit, opts.fit === 'center' ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce || Math.abs(gT - g) > .002 || drag) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); kick(); });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = (e.clientX - drag.x) / 260, dy = (e.clientY - drag.y) / 260; yaw -= dx; vy = -dx * .3; pitch = Math.max(-.7, Math.min(.9, pitch + dy)); drag = { x: e.clientX, y: e.clientY }; });
  const end = () => { drag = null; kick(); }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { lastT = 0; kick(); } }).observe(wrap);
  new ResizeObserver(kick).observe(wrap);
  requestAnimationFrame(frame);
  return { el: wrap, ok: true, setG(v, now) { gT = v; if (now) g = v; kick(); } };
}
