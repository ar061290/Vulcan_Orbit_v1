// Runs the M6b growth port off the main thread.
// runGrowth({flameState, fuel, conditions, C, opts}) -> Promise<Output | DropletPointer>
//   Uses one shared module Worker (js/growth_worker.js) when the browser can start one; otherwise (Node, a browser without
//   module workers, or a worker that fails to load) it runs js/growth.js synchronously. Either way it rejects with the same
//   Error message simulateGrowth throws (e.g. "material 'Nomex' is not modelled (PMMA, SIBAL, cotton)").
// Pages start runs only in ctx.onMount / after user input, never while rendering detached (REBUILD_PLAN §0 rule 6).
import { simulateGrowth } from './growth.js';

let worker = null;
let broken = false;
let seq = 0;
const pending = new Map();          // id -> {args, resolve, reject}

function runSync(args) {
  return new Promise((resolve, reject) => {
    try { resolve(simulateGrowth(args.flameState, args.fuel, args.conditions, args.C, args.opts || {})); }
    catch (err) { reject(err instanceof Error ? err : new Error(String(err))); }
  });
}

function fallBack() {
  broken = true;
  if (worker) { try { worker.terminate(); } catch { /* already gone */ } }
  worker = null;
  const jobs = [...pending.values()];
  pending.clear();
  for (const j of jobs) runSync(j.args).then(j.resolve, j.reject);
}

function getWorker() {
  if (broken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./growth_worker.js', import.meta.url), { type: 'module' });
  } catch {
    broken = true;
    return null;
  }
  worker.onmessage = (ev) => {
    const { id, ok, out, error } = ev.data || {};
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (ok) job.resolve(out);
    else job.reject(new Error(error));
  };
  worker.onerror = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); fallBack(); };   // failed to load: run here
  worker.onmessageerror = () => fallBack();
  return worker;
}

export function runGrowth({ flameState, fuel, conditions, C, opts = {} }) {
  const args = { flameState, fuel, conditions, C, opts };
  const w = getWorker();
  if (!w) return runSync(args);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { args, resolve, reject });
    try {
      w.postMessage({ id, flameState, fuel, conditions, C, opts: { dxCm: opts.dxCm, nSamples: opts.nSamples } });
    } catch {
      pending.delete(id);
      runSync(args).then(resolve, reject);
    }
  });
}

// 'worker' while the shared worker is usable, else 'sync'. For the page's own notes and checks.
export function growthMode() {
  return !broken && typeof Worker !== 'undefined' ? 'worker' : 'sync';
}

// Stops the shared worker (e.g. from ctx.onLeave). Runs still waiting reject with an Error named 'AbortError';
// the next runGrowth starts a fresh worker.
export function stopGrowth() {
  if (worker) { try { worker.terminate(); } catch { /* already gone */ } }
  worker = null;
  const jobs = [...pending.values()];
  pending.clear();
  for (const j of jobs) { const e = new Error('growth run stopped'); e.name = 'AbortError'; j.reject(e); }
}
