// Hero illustration: a ray-marched droplet flame, rendered live in WebGL 2 (site/REBUILD_PLAN.md §2.11, P6-A).
// This is an ILLUSTRATION, not data. The shapes follow what NASA's FLEX and candle films show qualitatively:
// in microgravity a droplet flame is a near-spherical, mostly blue shell with a faint soot layer inside;
// at Earth gravity buoyancy stretches it into a bright, sooty, flickering teardrop.
//
// Interface (frozen): hero({g, fit, ctx}) → {el, ok, setG(v, now)}
//  - ctx.detached → the static SVG drawing, no WebGL context, nothing started.
//  - otherwise the WebGL context is made now (so `ok` is known at once), and the render loop starts in ctx.onMount
//    and stops in ctx.onLeave (the context is released there too). With no ctx at all it starts on the next frame.
//  - no WebGL 2, a shader error or a lost context → the same static drawing plus the fallback sentence.
//  - Calm motion is re-checked on every frame: no auto-turn, no flicker, a gravity change jumps instead of morphing.
//  - a Pause / Play button; ← / → (and ↑ / ↓) turn the flame when it has keyboard focus; drag turns it too.
// The shader and the frame loop (adaptive resolution, drag, morph rate) are main's js/hero.js, unchanged in effect.
// Every constant below is a drawing parameter of the illustration, not a measured value.

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

const NS = 'http://www.w3.org/2000/svg';
const LABEL = 'Illustration: a fuel droplet burning, with gravity switched off (a dim blue sphere) or on (a bright yellow teardrop)';
const KEYS_HINT = 'Use the left and right arrow keys to turn it.';
const FALLBACK = 'This illustration needs WebGL 2; the rest of the site works without it.';   // main's sentence, verbatim
// Fixed star positions for the static drawing (decoration, not data).
const STARS = [[18, 30], [52, 210], [88, 64], [120, 250], [150, 22], [196, 280], [232, 48], [262, 160], [284, 236], [40, 140], [176, 110], [214, 200]];
let n = 0;

const isCalm = () => document.documentElement.dataset.motion === 'calm';
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** The static drawing (phase-1 stub, kept as the no-WebGL fallback). Returns {svg, setG}. */
function staticDrawing(fit) {
  const id = `hero${++n}`;
  const box = document.createElement('div');
  box.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 300 300" preserveAspectRatio="${fit === 'center' ? 'xMidYMid meet' : 'xMaxYMid meet'}" role="img" aria-label="${LABEL}" focusable="false">
  <defs>
    <radialGradient id="${id}b" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#0b1a3a" stop-opacity="0"/><stop offset=".62" stop-color="#1d3f9a" stop-opacity=".25"/><stop offset=".86" stop-color="#5b8cff" stop-opacity=".75"/><stop offset="1" stop-color="#9cc0ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}s" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb36b" stop-opacity="0"/><stop offset=".7" stop-color="#ff8a3d" stop-opacity=".22"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}y" cx="50%" cy="72%" r="65%"><stop offset="0" stop-color="#fff6d8"/><stop offset=".35" stop-color="#ffd166"/><stop offset=".7" stop-color="#ff8a3d" stop-opacity=".85"/><stop offset="1" stop-color="#c2410c" stop-opacity="0"/></radialGradient>
  </defs>
  <g fill="#cfd8ff" opacity=".55">${STARS.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 3 ? 0.8 : 1.3}"/>`).join('')}</g>
  <g class="g0"><circle cx="150" cy="150" r="78" fill="url(#${id}b)"/><circle cx="150" cy="150" r="54" fill="url(#${id}s)"/><circle cx="150" cy="150" r="4" fill="#3a3a3a"/></g>
  <g class="g1"><path d="M150 40 C120 95 104 150 112 190 C118 222 134 240 150 240 C166 240 182 222 188 190 C196 150 180 95 150 40 Z" fill="url(#${id}y)"/><path d="M150 205 C140 210 136 226 150 236 C164 226 160 210 150 205 Z" fill="#3b6cff" opacity=".7"/><circle cx="150" cy="222" r="4" fill="#3a3a3a"/></g>
</svg>`;
  const svg = box.firstElementChild;
  const setG = v => { svg.querySelector('.g0').style.display = v >= 0.5 ? 'none' : ''; svg.querySelector('.g1').style.display = v >= 0.5 ? '' : 'none'; };
  return { svg, setG };
}

/** Make the WebGL 2 program; returns null on any failure (no context, compile or link error). */
function makeGL(cv) {
  let gl = null;
  try { gl = cv.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); } catch { gl = null; }
  if (!gl) return null;
  try {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed'); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || 'program link failed');
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = k => gl.getUniformLocation(pr, k);
    return { gl, u: { res: U('res'), t: U('t'), g: U('g'), yaw: U('yaw'), pitch: U('pitch'), fit: U('fit') } };
  } catch (e) {
    console.warn('Hero flame: WebGL 2 shader failed, showing the static drawing.', e);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
}

export function hero({ g = 0, fit, ctx } = {}) {
  const center = fit === 'center';
  const wrap = mk('div', `hero-gl${center ? ' hero-center' : ' hero-band'}`);
  const note = mk('p', 'illus-note', 'Illustration, not data');

  // static drawing: detached site-map renders, and every fallback
  const goStatic = (withSentence) => {
    const S = staticDrawing(fit);
    wrap.classList.add('gl-static', 'nogl');
    // the Home porthole prints this sentence in its own caption, so only the page-header band adds it here,
    // in one box with the label so the two fit above the heading at 320 px
    if (withSentence && !center) { const box = mk('div', 'hero-fb'); box.append(note, ' ', mk('p', 'hero-fallback', FALLBACK)); wrap.replaceChildren(S.svg, box); }
    else wrap.replaceChildren(S.svg, note);
    S.setG(g);
    return S.setG;
  };
  if (ctx?.detached) { const set = goStatic(false); return { el: wrap, ok: false, setG: v => set(v) }; }

  const cv = document.createElement('canvas');
  const G = makeGL(cv);
  if (!G) { const set = goStatic(true); return { el: wrap, ok: false, setG: v => set(v) }; }
  const { gl, u } = G;

  const hintId = `herohint${++n}`;
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', LABEL);
  cv.setAttribute('aria-describedby', hintId);
  cv.tabIndex = 0;
  const hint = mk('span', 'sr', KEYS_HINT); hint.id = hintId;
  const pauseBtn = mk('button', 'hero-pause'); pauseBtn.type = 'button';
  wrap.append(cv, hint, note, pauseBtn);

  // state (main's starting view)
  let gNow = g, gT = g, yaw = .5, pitch = .12, vy = 0, drag = null, scale = Math.min(devicePixelRatio || 1, 2);
  let yOff = 0, pOff = 0;                 // v3: extra turn linked to the Home scroll position (setScroll), never in Calm
  let visible = true, raf = 0, slow = 0, lastT = 0, clock = 3, mounted = false, gone = false, fallen = false;
  let want = 'auto';                      // 'auto' follows Calm; 'pause' / 'play' are the visitor's own choice
  let setStatic = null;                   // set once the context is lost and the static drawing has taken over
  const still = () => want === 'pause' || (want === 'auto' && isCalm());
  let shown = null;
  const syncBtn = () => {
    const s = still(); if (s === shown) return; shown = s;
    pauseBtn.textContent = s ? 'Play' : 'Pause';
    pauseBtn.setAttribute('aria-label', s ? 'Play the illustration' : 'Pause the illustration');
  };
  syncBtn();

  const size = () => {
    // v3: the Home hero is ~800 px wide; the ray-marcher is drawn at most ~90k pixels and CSS scales it up (perf check, see site/REDESIGN_REPORT.md)
    const r = cv.getBoundingClientRect(), cap = Math.min(1, Math.sqrt(90000 / Math.max(1, r.width * r.height * scale * scale)));
    const w = Math.max(1, Math.round(r.width * scale * cap)), hh = Math.max(1, Math.round(r.height * scale * cap));
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    gl.viewport(0, 0, w, hh);
  };
  const frame = now => {
    raf = 0; if (!visible || gone || fallen) return;
    const dt = lastT ? Math.min(.1, (now - lastT) / 1000) : .016; lastT = now;
    // keep it smooth: if frames are slow, render fewer pixels (main's rule: 20 slow frames → 0.85×, floor 0.6×)
    if (dt > .028) { if (++slow > 20 && scale > .35) { scale = Math.max(.35, scale * .85); slow = 0; } } else slow = Math.max(0, slow - 1);
    const calmNow = isCalm(), s = still();          // re-checked on every frame
    syncBtn();
    if (calmNow) gNow = gT; else gNow += (gT - gNow) * Math.min(1, dt * 2.2);
    if (!drag) { yaw += (s ? 0 : .06) * dt + vy; vy *= .94; if (Math.abs(vy) < 1e-4) vy = 0; }
    if (!s) clock += dt;
    size();
    gl.uniform2f(u.res, cv.width, cv.height); gl.uniform1f(u.t, clock); gl.uniform1f(u.g, gNow);
    gl.uniform1f(u.yaw, yaw + yOff); gl.uniform1f(u.pitch, Math.max(-.7, Math.min(.9, pitch + pOff))); gl.uniform1f(u.fit, center ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // a still flame renders only on demand: while a gravity change settles, while dragged or while it coasts
    if (!s || Math.abs(gT - gNow) > .002 || drag || vy) raf = requestAnimationFrame(frame);
    else lastT = 0;
  };
  const kick = () => { if (mounted && !raf && visible && !gone && !fallen) raf = requestAnimationFrame(frame); };

  // input
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch { /* pointer gone */ } kick(); });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / 260, dy = (e.clientY - drag.y) / 260;
    yaw -= dx; vy = still() ? 0 : -dx * .3; pitch = Math.max(-.7, Math.min(.9, pitch + dy)); drag = { x: e.clientX, y: e.clientY };
  });
  const end = () => { drag = null; kick(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowLeft') yaw += .2;                       // same sense as dragging left
    else if (k === 'ArrowRight') yaw -= .2;
    else if (k === 'ArrowUp') pitch = Math.max(-.7, pitch - .1);
    else if (k === 'ArrowDown') pitch = Math.min(.9, pitch + .1);
    else return;
    e.preventDefault(); vy = 0; kick();
  });
  pauseBtn.addEventListener('click', () => { want = still() ? 'play' : 'pause'; syncBtn(); kick(); });

  // lifecycle
  const onPrefs = () => { syncBtn(); kick(); };
  const onVis = () => { if (!document.hidden) { lastT = 0; kick(); } };
  let io = null, ro = null;
  const start = () => {
    if (mounted || gone) return; mounted = true;
    addEventListener('vo:prefs', onPrefs); document.addEventListener('visibilitychange', onVis);
    if (typeof IntersectionObserver === 'function') { io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { lastT = 0; kick(); } }); io.observe(wrap); }
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(kick); ro.observe(wrap); }
    kick();
  };
  const stop = () => {
    if (gone) return; gone = true; mounted = false;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    removeEventListener('vo:prefs', onPrefs); document.removeEventListener('visibilitychange', onVis);
    io?.disconnect(); ro?.disconnect();
    gl.getExtension('WEBGL_lose_context')?.loseContext();   // free the GPU context; a re-render makes a new one
  };
  cv.addEventListener('webglcontextlost', e => {
    if (gone) return;                                        // our own release in stop()
    e.preventDefault(); fallen = true; if (raf) cancelAnimationFrame(raf); raf = 0;
    setStatic = goStatic(true);
    setStatic(gT);
  });

  if (ctx && typeof ctx.onMount === 'function') { ctx.onMount(start); ctx.onLeave?.(stop); }
  else requestAnimationFrame(start);                         // no lifecycle given (not used by the site)

  return {
    el: wrap, ok: true,
    setG(v, now) {
      gT = v; if (now || isCalm()) gNow = v;
      if (setStatic) setStatic(v); else kick();
    },
    /** v3 Home: f = 0..1 scroll progress through the hero; turns the flame a little. Ignored in Calm. */
    setScroll(f) {
      const y = isCalm() ? 0 : f * 2.4, p = isCalm() ? 0 : -f * .4;
      if (y === yOff && p === pOff) return; yOff = y; pOff = p; if (!setStatic) kick();
    },
  };
}
