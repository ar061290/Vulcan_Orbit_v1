// The ticking clock: how long each sensor took to alarm on NASA's real Saffire-III fire, played back at 10x.
// Numbers come from data/saffire_latency.json (our stated alarm rule, not the vehicle's).
import { h } from './lib.js';
export function ticking(lat, opts = {}) {
  const fires = lat.burns.filter(b => b.channels.some(c => /radiometer/i.test(c.name) && c.alarm_s != null));
  const pick = re => fires.map(b => b.channels.find(c => re.test(c.name))?.alarm_s).filter(v => v != null);
  const rad = Math.max(...pick(/radiometer/i)), sc = pick(/scatter/i), obsNever = lat.burns.every(b => b.channels.find(c => /obscuration/i.test(c.name))?.alarm_s == null);
  const T = Math.max(...sc) + 13, lanes = [
    { name: 'Flame light sensor', at: rad, label: `${rad} s` },
    { name: 'Smoke detector', at: Math.min(...sc), upto: Math.max(...sc), label: `${Math.min(...sc)}–${Math.max(...sc)} s` },
    { name: 'Smoke detector, second channel', at: null, label: obsNever ? 'never' : '—' },
  ];
  const clock = h('div', { class: 'tc-time', 'aria-hidden': 'true' }, '0 s');
  const rows = lanes.map((l, i) => { const bar = h('i'), done = h('b', {}, ''); return { l, bar, done, el: h('div', { class: `tc-row lane${i}` }, h('span', {}, l.name), h('div', { class: 'tc-track' }, bar, l.upto ? h('em', { style: `left:${l.at / T * 100}%;width:${(l.upto - l.at) / T * 100}%` }) : null), done) }; });
  const box = h('figure', { class: `tick ${opts.dark ? 'dark' : ''}`, 'aria-label': `Time to alarm on NASA's Saffire-III fire, our analysis: flame light sensor ${rad} seconds; smoke detector ${lanes[1].label}; second smoke channel ${lanes[2].label}.` },
    h('div', { class: 'tc-head' }, h('span', {}, 'After ignition'), h('button', { type: 'button', class: 'chip tc-replay', onclick: e => { e.stopPropagation(); started = false; run(); } }, '↻ Replay'), clock), ...rows.map(r => r.el),
    h('figcaption', {}, 'Our analysis of NASA Saffire-III telemetry (PSI-100), played at 10× speed. Alarm rule: ours, stated on the Find it page.'));
  const draw = t => { clock.textContent = `${Math.floor(t)} s`;
    for (const r of rows) { const end = r.l.at ?? T, x = Math.min(t, end) / T * 100; r.bar.style.width = x + '%'; const hit = r.l.at != null && t >= r.l.at;
      r.el.classList.toggle('hit', hit); r.done.textContent = hit ? r.l.label : (r.l.at == null && t >= T - 0.5 ? r.l.label : ''); } };
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'calm';
  let started = false;
  const run = () => { if (started) return; started = true; if (calm()) return draw(T);
    const t0 = performance.now(), step = now => { const t = Math.min(T, (now - t0) / 100); draw(t); if (t < T && box.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  draw(0); new IntersectionObserver(([e], o) => { if (e.isIntersecting) { run(); o.disconnect(); } }, { threshold: 0.4 }).observe(box);
  return box;
}
