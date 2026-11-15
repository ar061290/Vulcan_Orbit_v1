// The project status, shown as the v3 data status pill in the top bar (renderPill; #demo-banner is now its popover).
// statusBanner()/renderBanner() are kept for the old full-width strip and for tests. Counts manifest files whose status is 'demo' or 'missing'.
// The scrapped list lives in js/overlays.js (SCRAPPED). Files on it are left out of the counts ONLY when
// SCRAPPED.approved is true (human checkpoint Q1/H3); optional files are then named separately, never
// as "still to come". Main's "mostly from our bench rig" is dropped (spec C7).

const plural = (n, one, many) => (n === 1 ? one : many);
const shortWhat = (f, what) => String((what && what[f.name]) || f.what || f.name).replace(/\s*\(optional\)\s*$/i, '');

/** Banner text for a manifest, or '' when nothing is placeholder or missing. Pure: no DOM. */
export function statusBanner(manifest, SCRAPPED = {}, MANIFEST_WHAT = {}) {
  const files = (manifest && Array.isArray(manifest.files)) ? manifest.files : [];
  const approved = SCRAPPED.approved === true;
  const scrapped = new Set(approved ? (SCRAPPED.files || []) : []);
  const optional = new Set(approved ? (SCRAPPED.optional || []) : []);
  const live = files.filter(f => !scrapped.has(f.name));
  const demo = live.filter(f => f.status === 'demo').length;
  const missing = live.filter(f => f.status === 'missing' && !optional.has(f.name)).length;
  const opt = live.filter(f => f.status === 'missing' && optional.has(f.name));
  if (!demo && !missing && !opt.length) return '';
  return [
    demo ? `${demo} data file${plural(demo, ' holds', 's hold')} placeholder numbers.` : '',
    missing ? `${missing} data file${plural(missing, ' is', 's are')} still to come.` : '',
    opt.length ? `Optional, not completed: ${opt.map(f => shortWhat(f, MANIFEST_WHAT)).join('; ')}.` : '',
    // main's sentence, kept verbatim when only missing files are counted; a demo file's panel says "Demo data" instead
    demo && (missing || opt.length) ? 'Affected panels are labelled “Demo data” or “No data yet”.'
      : demo ? 'Every affected panel is labelled “Demo data”.' : 'Every affected panel is labelled “No data yet”.',
  ].filter(Boolean).join(' ');
}

/** Fill and show (or hide) the banner element. */
export function renderBanner(el, manifest, SCRAPPED, MANIFEST_WHAT) {
  if (!el) return '';
  const text = statusBanner(manifest, SCRAPPED, MANIFEST_WHAT);
  el.textContent = text; el.hidden = !text;
  return text;
}

// ---------- v3: the data status pill in the top bar (replaces the full-width banner) ----------
// Same counting rule as statusBanner(), file by file, except data/cv_example.json: it is a deliberate worked example for
// the Assess "Load example camera reading" button, so it is never counted as unfinished (site/DECISIONS.md, v3).
export const PILL_SKIP = ['cv_example'];
/** Pure: the files behind the pill, [{name, status, what, optional}]. */
export function statusItems(manifest, SCRAPPED = {}, MANIFEST_WHAT = {}) {
  const files = (manifest && Array.isArray(manifest.files)) ? manifest.files : [];
  const approved = SCRAPPED.approved === true;
  const scrapped = new Set(approved ? (SCRAPPED.files || []) : []);
  const optional = new Set(approved ? (SCRAPPED.optional || []) : []);
  return files.filter(f => !scrapped.has(f.name) && !PILL_SKIP.includes(f.name) && (f.status === 'demo' || f.status === 'missing'))
    .map(f => ({ name: f.name, status: f.status, what: shortWhat(f, MANIFEST_WHAT), optional: optional.has(f.name) }));
}
/** Fill the pill button and its popover list. badge = lib.js badge(). Returns the items. */
export function renderPill(btn, pop, manifest, SCRAPPED, MANIFEST_WHAT, badge) {
  if (!btn || !pop) return [];
  const items = statusItems(manifest, SCRAPPED, MANIFEST_WHAT);
  const n = items.length;
  const short = n ? `${n} file${plural(n, '', 's')} pending` : 'All data in';
  btn.querySelector('.pill-n').textContent = short;
  // merge: on narrow screens only the square and the count show (css/shell-merge.css); the full words stay in aria-label
  const c = btn.querySelector('.pill-c'); if (c) c.textContent = n ? String(n) : '✓';
  btn.classList.toggle('ok', !n);
  btn.setAttribute('aria-label', `Data status: ${short}. Show the list`);
  const doc = pop.ownerDocument;
  const ul = doc.createElement('ul');
  for (const it of items) {
    const li = doc.createElement('li');
    const code = doc.createElement('code'); code.textContent = `data/${it.name}.json`;
    const p = doc.createElement('span'); p.textContent = it.what + (it.optional ? ' (optional)' : '');
    li.append(badge(it.status), code, p); ul.append(li);
  }
  const head = doc.createElement('p'); head.className = 'pop-h';
  const nm = items.filter(i => i.status === 'missing').length, nd = items.filter(i => i.status === 'demo').length;
  head.textContent = [nm ? `${nm} data file${plural(nm, ' is', 's are')} still to come` : '', nd ? `${nd} hold${plural(nd, 's', '')} placeholder numbers` : ''].filter(Boolean).join('; ') || 'Data status';
  const note = doc.createElement('p'); note.className = 'pop-note';
  const demo = items.some(i => i.status === 'demo'), miss = items.some(i => i.status === 'missing');
  note.textContent = (n ? (demo && miss ? 'Affected panels are labelled “Demo data” or “No data yet”.' : demo ? 'Every affected panel is labelled “Demo data”.' : 'Every affected panel is labelled “No data yet”.')
    : 'Every data file the site reads is in.') + ' The worked camera example (data/cv_example.json) is a deliberate example and is not counted.';
  pop.replaceChildren(head, ...(n ? [ul] : []), note);
  return items;
}
