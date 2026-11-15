// Telugu and Hindi for the Home short answer and the India card (spec Part C #25, site/REBUILD_PLAN.md §2.11, §3.2).
// Strings live in data/i18n.json (status "team", reviewed:false). Each entry keeps the English it translates, and a
// translation is shown only while that English, filled with the SAME numbers, still equals the English the page would
// print. So a change to the English wording (js/facts.js, data/india.json) falls back to English instead of showing a
// stale translation, and the numbers always come from the computed values (js/facts.js `vars`), never retyped.
// Language choice is kept in prefs 'lang' (this browser only). Changing it fires 'vo:prefs', which every live switch
// listens to, so the switches on one page stay in step. Text that stays English carries lang="en".
import { h, load, isMissing, seg, announce } from './lib.js';
import { prefs } from './prefs.js';

export const LANGS = [['en', 'English'], ['te', 'తెలుగు'], ['hi', 'हिन्दी']];
const NAME_EN = { en: 'English', te: 'Telugu', hi: 'Hindi' };
export const DRAFT_NOTE = 'Draft translation, not yet checked by a native speaker.';

let D = null;
const ready = () => !!(D && !isMissing(D) && D.strings && typeof D.strings === 'object');

/** Load data/i18n.json once (lib.load caches it). A missing file → {status:'missing'}; every lookup then gives English. */
export async function loadI18n() { D = await load('i18n'); return D; }

/** The visitor's language: prefs 'lang' if it is one we have strings for, else English. */
export function currentLang() {
  const l = prefs.get('lang');
  return l !== 'en' && ready() && LANGS.some(([v]) => v === l) ? l : 'en';
}

// Fill {name} placeholders. A null, undefined or non-finite number makes the whole string unusable (→ null),
// so a sentence never shows a blank where a number should be.
function fill(tpl, vars = {}) {
  if (typeof tpl !== 'string') return null;
  let bad = false;
  const s = tpl.replace(/\{([\w ]+)\}/g, (_, k) => {
    const v = vars[k];
    if (v == null || (typeof v === 'number' && !Number.isFinite(v))) { bad = true; return ''; }
    return String(v);
  });
  return bad ? null : s;
}

/** Frozen interface (§2.11): the string for `key` in `lang`, with vars filled; null when there is none. */
export function t(key, vars = {}, lang = currentLang()) {
  return ready() ? fill(D.strings[key]?.[lang], vars) : null;
}

/** The text to show for `key`, given the English the page prints (`enLive`) and the vars that filled it.
 *  → {text, lang}. English is returned (lang 'en') when `lang` is English, when the entry or the translation is
 *  missing, or when the entry's English, filled with `vars`, no longer equals `enLive` (stale translation). */
export function tr(key, enLive, vars = {}, lang = currentLang()) {
  if (lang === 'en' || !ready()) return { text: enLive, lang: 'en' };
  const e = D.strings[key];
  if (!e || fill(e.en, vars) !== enLive) return { text: enLive, lang: 'en', stale: !!e };
  const s = fill(e[lang], vars);
  return s == null ? { text: enLive, lang: 'en' } : { text: s, lang };
}

/** The Home short answer in `lang`, line by line, from detectFacts() output. The keys follow the same conditions
 *  facts.js uses to build `en`, so line i of the result translates facts.en[i]; if the counts ever disagree,
 *  the English lines are returned as they are. → [{text, lang}] */
export function shortLines(facts, lang = currentLang()) {
  const v = facts?.vars || {}, en = Array.isArray(facts?.en) ? facts.en : [];
  const keys = [];
  if (v.n_fires == null) keys.push(['short.missing_latency', { file: 'saffire_latency' }]);
  else {
    if (v.n_fires > 0 && v.smoke_min_s != null) keys.push(['short.s1', v]);
    if (v.obs_never === true) keys.push(['short.s2', v]);
  }
  keys.push(v.co_tests == null ? ['short.missing_gas', { file: 'saffire_gas' }] : ['short.s3', v]);
  if (keys.length !== en.length) return en.map(text => ({ text, lang: 'en' }));
  return keys.map(([k, vars], i) => tr(k, en[i], vars, lang));
}

/** "Draft translation, not yet checked by a native speaker." until the team sets reviewed:true in data/i18n.json. */
export function draftNote(reviewed = D?.reviewed === true) {
  if (reviewed === true) return null;
  return h('p', { class: 'draft-note', lang: 'en' }, DRAFT_NOTE, ' The తెలుగు and हिन्दी text was drafted with an AI assistant.');
}

/** English / తెలుగు / हिन्दी buttons (aria-pressed). Sets `lang` on `scope` and calls onChange(lang) on every change,
 *  including changes made by another switch on the page. `ctx` (the page ctx, optional) removes the listener on leave;
 *  a detached render (site map) adds no listener. With data/i18n.json missing it returns a one-line notice instead. */
export function langSwitch({ scope, onChange, ctx, id } = {}) {
  if (!ready()) {
    return h('p', { class: 'lang-missing', lang: 'en' }, 'తెలుగు and हिन्दी are not available yet (data/i18n.json missing).');
  }
  const cur = currentLang();
  if (scope) scope.setAttribute('lang', cur);
  const row = seg({
    id, label: 'Language', options: LANGS, value: cur,
    onChange: v => {
      prefs.set('lang', v);   // fires vo:prefs → apply() on every live switch on the page
      apply(currentLang());   // and this one, also when no listener was added (detached) or the value was unchanged
      if (!ctx?.detached) announce(v === 'en' ? 'Showing English.' : `Showing ${NAME_EN[v]}. ${DRAFT_NOTE}`);
    },
  });
  row.classList.add('lang-switch');
  row.setAttribute('lang', 'en');
  row.querySelectorAll('button').forEach(b => b.setAttribute('lang', b.dataset.v));
  let shown = cur;
  function apply(l) {
    if (l === shown) return;
    shown = l; row.set(l);
    if (scope) scope.setAttribute('lang', l);
    onChange?.(l);
  }
  if (!ctx?.detached) {
    let seen = false;
    const onPrefs = e => {
      if (e.detail?.key !== 'lang') return;
      if (!ctx && seen && !row.isConnected) { removeEventListener('vo:prefs', onPrefs); return; }
      if (row.isConnected) seen = true;
      apply(currentLang());
    };
    addEventListener('vo:prefs', onPrefs);
    if (typeof ctx?.onLeave === 'function') ctx.onLeave(() => removeEventListener('vo:prefs', onPrefs));
  }
  return row;
}
