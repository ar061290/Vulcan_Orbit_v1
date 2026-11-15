// Demo hero: a flowing orange cursor trail. Our own small WebGL2 fluid solver (stable-fluids method: advect, vorticity,
// pressure projection, dye), written for this page; the look is inspired by Framer's "Flowing Cursor" component.
// Decoration only: it shows no data. Off for prefers-reduced-motion, without WebGL2, and while the hero is off-screen.
export function flowingCursor(host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'fluid'; canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) { canvas.remove(); return; }
  gl.getExtension('OES_texture_float_linear');

  const SIM = 128, DYE = 512, PRESSURE_ITERS = 18, VEL_DECAY = 0.975, DYE_DECAY = 0.952, CURL = 18, SPLAT_R = 0.0016;
  const COLORS = [[1.0, 0.48, 0.24], [1.0, 0.36, 0.12], [1.0, 0.62, 0.3], [0.95, 0.3, 0.08]];   // fire orange family (#FF7A3D)

  const vs = `#version 300 es
  in vec2 p; out vec2 uv; out vec2 L; out vec2 R; out vec2 T; out vec2 B; uniform vec2 texel;
  void main(){ uv = p*.5+.5; L = uv-vec2(texel.x,0.); R = uv+vec2(texel.x,0.); T = uv+vec2(0.,texel.y); B = uv-vec2(0.,texel.y); gl_Position = vec4(p,0.,1.); }`;
  const head = `#version 300 es
  precision highp float; in vec2 uv; in vec2 L; in vec2 R; in vec2 T; in vec2 B; out vec4 o;`;
  const FS = {
    splat: `${head} uniform sampler2D src; uniform vec2 point; uniform vec3 color; uniform float radius, aspect;
      void main(){ vec2 d = uv-point; d.x *= aspect; vec3 s = exp(-dot(d,d)/radius)*color; o = vec4(texture(src,uv).xyz+s,1.); }`,
    advect: `${head} uniform sampler2D vel, src; uniform vec2 texel; uniform float dt, decay;
      void main(){ vec2 c = uv - dt*texture(vel,uv).xy*texel; o = vec4(decay*texture(src,c).xyz, 1.); }`,
    curl: `${head} uniform sampler2D vel;
      void main(){ float l=texture(vel,L).y, r=texture(vel,R).y, t=texture(vel,T).x, b=texture(vel,B).x; o = vec4(.5*(r-l-t+b),0.,0.,1.); }`,
    vort: `${head} uniform sampler2D vel, curl; uniform float strength, dt;
      void main(){ float l=texture(curl,L).x, r=texture(curl,R).x, t=texture(curl,T).x, b=texture(curl,B).x, c=texture(curl,uv).x;
        vec2 f = .5*vec2(abs(t)-abs(b), abs(r)-abs(l)); f /= length(f)+1e-4; f *= strength*c; f.y *= -1.;
        o = vec4(texture(vel,uv).xy + f*dt, 0., 1.); }`,
    div: `${head} uniform sampler2D vel;
      void main(){ float l=texture(vel,L).x, r=texture(vel,R).x, t=texture(vel,T).y, b=texture(vel,B).y; o = vec4(.5*(r-l+t-b),0.,0.,1.); }`,
    pres: `${head} uniform sampler2D pres, div;
      void main(){ float l=texture(pres,L).x, r=texture(pres,R).x, t=texture(pres,T).x, b=texture(pres,B).x; o = vec4((l+r+b+t-texture(div,uv).x)*.25,0.,0.,1.); }`,
    grad: `${head} uniform sampler2D pres, vel;
      void main(){ float l=texture(pres,L).x, r=texture(pres,R).x, t=texture(pres,T).x, b=texture(pres,B).x; o = vec4(texture(vel,uv).xy - vec2(r-l,t-b), 0., 1.); }`,
    clear: `${head} uniform sampler2D src; uniform float k; void main(){ o = k*texture(src,uv); }`,
    show: `${head} uniform sampler2D dye;
      void main(){ vec3 c = texture(dye,uv).rgb; c = 1.-exp(-c*1.4); float a = clamp(max(c.r,max(c.g,c.b))*0.9,0.,0.85); o = vec4(c, a); }`,
  };
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const V = compile(gl.VERTEX_SHADER, vs);
  const P = {};
  for (const [k, src] of Object.entries(FS)) {
    const pr = gl.createProgram(); gl.attachShader(pr, V); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, src)); gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    const u = {}; const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(pr, i).name; u[nm] = gl.getUniformLocation(pr, nm); }
    P[k] = { pr, u };
  }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function fbo(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h };
  }
  const pair = (w, h) => { let a = fbo(w, h), b = fbo(w, h); return { get r() { return a; }, get w() { return b; }, swap() { [a, b] = [b, a]; } }; };
  let vel, dye, pres, divg, curl, aspect = 1;
  function size() {
    const r = host.getBoundingClientRect(), dpr = Math.min(1.5, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    aspect = canvas.width / canvas.height;
    const sw = Math.round(SIM * Math.max(1, aspect)), sh = Math.round(SIM / Math.min(1, aspect));
    const dw = Math.round(DYE * Math.max(1, aspect)), dh = Math.round(DYE / Math.min(1, aspect));
    vel = pair(sw, sh); pres = pair(sw, sh); divg = fbo(sw, sh); curl = fbo(sw, sh); dye = pair(dw, dh);
  }
  function run(prog, target, uniforms, texel) {
    gl.useProgram(prog.pr); let unit = 0;
    for (const [k, v] of Object.entries(uniforms)) {
      const loc = prog.u[k]; if (loc == null) continue;
      if (v && v.t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.t); gl.uniform1i(loc, unit++); }
      else if (Array.isArray(v)) (v.length === 2 ? gl.uniform2f : gl.uniform3f).call(gl, loc, ...v);
      else gl.uniform1f(loc, v);
    }
    if (prog.u.texel && texel) gl.uniform2f(prog.u.texel, ...texel);
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const ptr = { x: 0.5, y: 0.5, dx: 0, dy: 0, moved: false, c: 0 };
  const move = (cx, cy) => {
    const r = canvas.getBoundingClientRect(); if (!r.width) return;
    const x = (cx - r.left) / r.width, y = 1 - (cy - r.top) / r.height;
    ptr.dx = (x - ptr.x) * 3200 * aspect; ptr.dy = (y - ptr.y) * 3200; ptr.x = x; ptr.y = y; ptr.moved = true;
  };
  host.addEventListener('pointermove', e => move(e.clientX, e.clientY), { passive: true });
  host.addEventListener('pointerdown', e => { const r = canvas.getBoundingClientRect(); ptr.x = (e.clientX - r.left) / r.width; ptr.y = 1 - (e.clientY - r.top) / r.height; }, { passive: true });

  function step(dt) {
    const vt = [1 / vel.r.w, 1 / vel.r.h];
    if (ptr.moved) {
      ptr.moved = false; const col = COLORS[(ptr.c = (ptr.c + 1) % (COLORS.length * 40)) / 40 | 0].map(v => v * 0.2);
      run(P.splat, vel.w, { src: vel.r, point: [ptr.x, ptr.y], color: [ptr.dx, ptr.dy, 0], radius: SPLAT_R, aspect }); vel.swap();
      run(P.splat, dye.w, { src: dye.r, point: [ptr.x, ptr.y], color: col, radius: SPLAT_R, aspect }); dye.swap();
    }
    run(P.curl, curl, { vel: vel.r }, vt);
    run(P.vort, vel.w, { vel: vel.r, curl, strength: CURL, dt }, vt); vel.swap();
    run(P.div, divg, { vel: vel.r }, vt);
    run(P.clear, pres.w, { src: pres.r, k: 0.8 }, vt); pres.swap();
    for (let i = 0; i < PRESSURE_ITERS; i++) { run(P.pres, pres.w, { pres: pres.r, div: divg }, vt); pres.swap(); }
    run(P.grad, vel.w, { pres: pres.r, vel: vel.r }, vt); vel.swap();
    run(P.advect, vel.w, { vel: vel.r, src: vel.r, dt, decay: VEL_DECAY }, vt); vel.swap();
    run(P.advect, dye.w, { vel: vel.r, src: dye.r, dt, decay: DYE_DECAY }, vt); dye.swap();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT);
    run(P.show, null, { dye: dye.r }); gl.disable(gl.BLEND);
  }

  let raf = 0, last = performance.now(), visible = true;
  const loop = now => { const dt = Math.min(0.033, (now - last) / 1000); last = now; step(dt); raf = requestAnimationFrame(loop); };
  const go = () => { cancelAnimationFrame(raf); if (visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; go(); }).observe(host);
  document.addEventListener('visibilitychange', go);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); }, 200); });
  size(); go();
}
