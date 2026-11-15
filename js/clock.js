// The ticking clock: how long each sensor took to alarm on NASA's real Saffire-III fire, played back at 10x.
// Numbers come from data/saffire_latency.json (our stated alarm rule, not the vehicle's).
// Interface (site/REBUILD_PLAN.md §2.11): ticking(lat, {dark, ctx}) → figure.tick, with the same aria-label as main.
// - The figure is built in its final state, so a detached render (site map), a missing ctx and Calm all show the answer.
// - Playback starts only in ctx.onMount: it rewinds to 0 s and plays once the clock scrolls into view, unless Calm is on.
// - Play/Pause and Replay are real <button>s with visible labels. A Play pressed by the visitor runs even in Calm (user-started motion).
// - ctx.onLeave stops the frame loop and the observer. Each lane changes state once, so nothing flashes.
import { h, isMissing, calm } from './lib.js';

const SPEED = 10;   // main: 10x playback (100 ms of wall time per second of fire time)
const TAIL = 13;    // main: 13 s of track after the last alarm

export function ticking(lat, opts = {}) {
  const ctx = opts.ctx || null;
  const burns = isMissing(lat) || !Array.isArray(lat.burns) ? [] : lat.burns;
  const chans = b => (Array.isArray(b?.channels) ? b.channels : []);
  const fires = burns.filter(b => chans(b).some(c => /radiometer/i.test(c.name) && c.alarm_s != null));
  if (!fires.length) {
    return h('figure', { class: `tick ${opts.dark ? 'dark' : ''}`, 'aria-label': 'Time to alarm on NASA\'s Saffire-III fire: no data yet.' },
      h('div', { class: 'tc-head' }, h('span', {}, 'After ignition')),
      h('p', { class: 'tc-empty' }, 'No data yet: data/saffire_latency.json is missing or has no burn with a flame light sensor alarm.'));
  }
  const pick = re => fires.map(b => chans(b).find(c => re.test(c.name))?.alarm_s).filter(v => v != null);
  const rad = Math.max(...pick(/radiometer/i)), sc = pick(/scatter/i);
  const obsNever = burns.every(b => chans(b).find(c => /obscuration/i.test(c.name))?.alarm_s == null);
  const T = Math.max(rad, ...sc) + TAIL;
  const lanes = [
    { name: 'Flame light sensor', at: rad, label: `${rad} s` },
    sc.length ? { name: 'Smoke detector', at: Math.min(...sc), upto: Math.max(...sc), label: `${Math.min(...sc)}–${Math.max(...sc)} s` } : { name: 'Smoke detector', at: null, label: '—' },
    { name: 'Smoke detector, second channel', at: null, label: obsNever ? 'never' : '—' },
  ];

  const clock = h('div', { class: 'tc-time', 'aria-hidden': 'true' }, `${Math.floor(T)} s`);
  const rows = lanes.map((l, i) => {
    const bar = h('i'), done = h('b', {}, '');
    const el = h('div', { class: `tc-row lane${i}` }, h('span', {}, l.name),
      h('div', { class: 'tc-track' }, bar, l.upto ? h('em', { style: `left:${l.at / T * 100}%;width:${(l.upto - l.at) / T * 100}%` }) : null),
      done);
    return { l, bar, done, el };
  });

  let t = T, raf = 0, last = 0, playing = false, userPlay = false, io = null;
  // The Play button's own label says what a press does (Play / Pause), the media-player pattern; it carries no
  // aria-pressed, because a pressed state on a button whose name also flips reads as a double negative.
  const playBtn = h('button', { type: 'button', class: 'chip tc-btn tc-play', 'data-state': 'paused' }, 'Play');
  const replayBtn = h('button', { type: 'button', class: 'chip tc-btn tc-replay' }, '↻ Replay');
  const controls = h('div', { class: 'tc-ctrl', role: 'group', 'aria-label': 'Clock playback, 10× speed' }, playBtn, replayBtn);

  const draw = now => {
    t = Math.max(0, Math.min(T, now));
    clock.textContent = `${Math.floor(t)} s`;
    for (const r of rows) {
      const end = r.l.at ?? T, hit = r.l.at != null && t >= r.l.at;
      r.bar.style.width = `${Math.min(t, end) / T * 100}%`;
      r.el.classList.toggle('hit', hit);
      r.done.textContent = hit ? r.l.label : (r.l.at == null && t >= T - 0.5 ? r.l.label : '');
    }
  };
  const setBtn = () => {
    playBtn.textContent = playing ? 'Pause' : (t >= T ? 'Play from 0 s' : 'Play');
    playBtn.dataset.state = playing ? 'playing' : 'paused';
  };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; playing = false; setBtn(); };
  const frame = now => {
    raf = 0;
    if (!box.isConnected) return stop();
    if (calm() && !userPlay) { draw(T); return stop(); }   // Calm switched on mid-autoplay: jump to the answer
    const dt = Math.min(0.25, (now - last) / 1000);          // a background tab does not skip the race
    last = now; draw(t + dt * SPEED);
    if (t >= T) return stop();
    raf = requestAnimationFrame(frame);
  };
  const play = byUser => {
    if (playing) return;
    userPlay = byUser;
    if (t >= T) draw(0);
    playing = true; setBtn();
    last = performance.now(); raf = requestAnimationFrame(frame);
  };
  const pause = () => { stop(); };

  playBtn.addEventListener('click', e => { e.stopPropagation(); if (playing) pause(); else play(true); });
  replayBtn.addEventListener('click', e => { e.stopPropagation(); stop(); draw(0); play(true); });

  const box = h('figure', { class: `tick ${opts.dark ? 'dark' : ''}`, 'aria-label': `Time to alarm on NASA's Saffire-III fire, our analysis: flame light sensor ${rad} seconds; smoke detector ${lanes[1].label}; second smoke channel ${lanes[2].label}.` },
    h('div', { class: 'tc-head' }, h('span', {}, 'After ignition'), controls, clock),
    rows.map(r => r.el),
    h('figcaption', {}, 'Our analysis of NASA Saffire-III telemetry (PSI-100), played at 10× speed. Alarm rule: ours, stated on the Find it page.'));

  draw(T); setBtn();   // final state: what a detached render, a missing ctx or Calm shows
  if (ctx && !ctx.detached) {
    ctx.onMount(() => {
      if (calm()) return;                                   // no autoplay in Calm
      draw(0); setBtn();
      if (typeof IntersectionObserver !== 'function') return play(false);
      io = new IntersectionObserver(([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect(); io = null;
        if (!playing && t === 0) play(false);
      }, { threshold: 0.4 });
      io.observe(box);
    });
    ctx.onLeave(() => { stop(); if (io) { io.disconnect(); io = null; } });
  }
  return box;
}
