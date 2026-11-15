// The ticking clock: how long each sensor took to alarm on NASA's real Saffire-III fire.
// Numbers come from data/saffire_latency.json (our stated alarm rule, not the vehicle's).
// PHASE 1: the static final state only. Phase 6 (P6-C) adds the 10× playback with Play/Pause/Replay and no autoplay
// in Calm. The interface stays: ticking(lat, {dark, ctx}) → figure.tick, with the same aria-label.
import { h, isMissing } from './lib.js';

export function ticking(lat, opts = {}) {
  const fires = isMissing(lat) || !Array.isArray(lat.burns) ? [] : lat.burns.filter(b => b.channels.some(c => /radiometer/i.test(c.name) && c.alarm_s != null));
  if (!fires.length) {
    return h('figure', { class: `tick ${opts.dark ? 'dark' : ''}`, 'aria-label': 'Time to alarm on NASA\'s Saffire-III fire: no data yet.' },
      h('div', { class: 'tc-head' }, h('span', {}, 'After ignition')),
      h('p', {}, 'No data yet: data/saffire_latency.json is missing or has no burn with a flame light sensor alarm.'));
  }
  const pick = re => fires.map(b => b.channels.find(c => re.test(c.name))?.alarm_s).filter(v => v != null);
  const rad = Math.max(...pick(/radiometer/i)), sc = pick(/scatter/i), obsNever = lat.burns.every(b => b.channels.find(c => /obscuration/i.test(c.name))?.alarm_s == null);
  const T = Math.max(rad, ...sc) + 13;   // main: 13 s of track after the last alarm
  const lanes = [
    { name: 'Flame light sensor', at: rad, label: `${rad} s` },
    sc.length ? { name: 'Smoke detector', at: Math.min(...sc), upto: Math.max(...sc), label: `${Math.min(...sc)}–${Math.max(...sc)} s` } : { name: 'Smoke detector', at: null, label: '—' },
    { name: 'Smoke detector, second channel', at: null, label: obsNever ? 'never' : '—' },
  ];
  const rows = lanes.map((l, i) => {
    const end = l.at ?? T, hit = l.at != null;
    return h('div', { class: `tc-row lane${i}${hit ? ' hit' : ''}` }, h('span', {}, l.name),
      h('div', { class: 'tc-track' }, h('i', { style: `width:${end / T * 100}%` }), l.upto ? h('em', { style: `left:${l.at / T * 100}%;width:${(l.upto - l.at) / T * 100}%` }) : null),
      h('b', {}, l.label));
  });
  return h('figure', { class: `tick ${opts.dark ? 'dark' : ''}`, 'aria-label': `Time to alarm on NASA's Saffire-III fire, our analysis: flame light sensor ${rad} seconds; smoke detector ${lanes[1].label}; second smoke channel ${lanes[2].label}.` },
    h('div', { class: 'tc-head' }, h('span', {}, 'After ignition'), h('div', { class: 'tc-time', 'aria-hidden': 'true' }, `${Math.floor(T)} s`)),
    rows,
    h('figcaption', {}, 'Our analysis of NASA Saffire-III telemetry (PSI-100). Alarm rule: ours, stated on the Find it page.'));
}
