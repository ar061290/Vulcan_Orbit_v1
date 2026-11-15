// Module Worker for the M6b growth port. Started by js/growth_run.js as new Worker(url, {type: 'module'}).
// Message in: {id, flameState, fuel, conditions, C, opts}. Message out: {id, ok: true, out} or {id, ok: false, error}.
import { simulateGrowth } from './growth.js';

self.onmessage = (ev) => {
  const { id, flameState, fuel, conditions, C, opts } = ev.data || {};
  try {
    const out = simulateGrowth(flameState, fuel, conditions, C, opts || {});
    self.postMessage({ id, ok: true, out });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) });
  }
};
