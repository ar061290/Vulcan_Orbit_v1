// The project status banner (#demo-banner). Counts manifest files whose status is 'demo' or 'missing'.
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
