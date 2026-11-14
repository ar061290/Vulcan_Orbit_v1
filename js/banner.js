// Page-header illustrations, rendered live in WebGL 2 at native resolution. Illustrations, not data.
//  'earth': the planet's limb seen from orbit, with clouds, night side and a thin atmosphere.
//  'smoke': cabin smoke drifting with the ventilation through a detector's light beam.
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o; uniform vec2 res; uniform float t; uniform int mode;
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
  col += vec3(1., .3, .15) * det * (1.5 + sin(t * 4.) * .8);
  return col;
}
void main(){
  vec2 sp = (uv * res - .5 * res) / res.y;
  vec3 col = mode == 0 ? earth(sp) : smoke(sp);
  col = 1. - exp(-col * 1.25); col = pow(col, vec3(.4545));
  col += (h2(gl_FragCoord.xy + t) - .5) / 255.;
  o = vec4(col, 1.);
}`;
export function banner(kind) {
  const wrap = document.createElement('div'); wrap.className = 'banner-gl';
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); wrap.append(cv);
  const gl = cv.getContext('webgl2', { antialias: false });
  if (!gl) return wrap;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(pr, 'res'), uT = gl.getUniformLocation(pr, 't'); gl.uniform1i(gl.getUniformLocation(pr, 'mode'), kind === 'smoke' ? 1 : 0);
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'calm';
  let vis = true, raf = 0, scale = Math.min(devicePixelRatio || 1, 2), start = performance.now(), last = 0, slow = 0;
  const frame = now => {
    raf = 0; if (!vis || !wrap.isConnected) return;
    const dt = last ? (now - last) / 1000 : .016; last = now;
    if (dt > .03 && ++slow > 15 && scale > .6) { scale *= .85; slow = 0; }
    const r = cv.getBoundingClientRect(), w = Math.round(r.width * scale), hh = Math.round(r.height * scale);
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } gl.viewport(0, 0, w, hh);
    gl.uniform2f(uRes, w, hh); gl.uniform1f(uT, calm() ? 20 : (now - start) / 1000 + 20); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!calm()) raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(frame); }).observe(wrap);
  new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(frame); }).observe(wrap);
  return wrap;
}
