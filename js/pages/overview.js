import { h, load, page, card, badge, fmt } from '../lib.js';
import { flameLab } from '../flame.js';
export default async function (root) {
  const [man, inv, sm] = await Promise.all([load('manifest'), load('investigations'), load('smoke_sizes')]);
  const fine = (sm.materials || []).filter(m => m.Dg_nm != null).sort((a, b) => a.Dg_nm - b.Dg_nm)[0];
  const st = n => (man.files || []).find(f => f.name === n)?.status || 'missing';
  const stage = (n, id, title, text, files) => h('a', { class: 'card stage', href: `#/${id}` }, h('div', { class: 'n' }, n), h('h2', {}, title), h('p', {}, text),
    h('div', {}, ...files.map(f => h('div', { style: 'margin-top:6px;font-size:13px;color:var(--ink2)' }, badge(st(f[0])), ' ', f[1]))));
  const n = (inv.items || []).length, det = (inv.items || []).filter(i => i.focus === 'detection').length;
  root.append(page('A fire in orbit does not rise. It hides.',
    'Vulcan Orbit turns NASA\'s microgravity combustion experiments into three answers a mission designer needs: where is the fire, what will it do next, and what puts it out. A bench rig tests the same questions with real sensors.',
    card('See it: the same flame, with and without gravity', null, 'Switch gravity off and watch where the heat and smoke go. Then change the airflow.', flameLab(), h('p', { style: 'margin:10px 0 0' }, h('small', {}, 'This is an illustration. For the physics model with real fuels, oxygen levels and checks against NASA data, open the '), h('a', { href: '#/flame' }, 'flame simulator →'))),
    h('div', { class: 'grid g3', style: 'margin-top:14px' },
      stage('01', 'detect', 'Detect and locate', 'When each kind of sensor would have alarmed in real orbital burns, which smoke the detector misses, and where the source is.', [['saffire_latency', 'Alarm timing from Saffire'], ['smoke_sizes', 'Smoke sizes from SAME'], ['dome_locator', 'Dome locator']]),
      stage('02', 'predict', 'Predict', 'How fast flame spreads, whether it goes out, and where smoke drifts when nothing rises.', [['flame_static', 'Flame simulator'], ['flame_spread', 'Flame spread and survival'], ['drift', 'Smoke drift, tuned on Saffire-III'], ['drift_lbm', 'Cabin air model with racks']]),
      stage('03', 'respond', 'Respond', 'What the evidence says about suppression, next to our bench trials of ion wind and fine mist.', [['flex_suppression', 'Suppressant gases from FLEX'], ['efield', 'NASA electric-field flames'], ['response_trials', 'Bench trials']])),
    h('div', { class: 'grid g4', style: 'margin-top:14px' },
      card('Investigations', inv.status, 'NASA experiments indexed', h('div', { class: 'stat' }, fmt(n, 0))),
      card('On detection', inv.status, 'Smoke and dust studies', h('div', { class: 'stat' }, fmt(det, 0))),
      card('Station airflow', 'reported', 'ISS aisleway requirement, 4.6–12.2 m/min (NASA NTRS 20150009509)', h('div', { class: 'stat' }, '0.08–0.2', h('small', {}, 'm/s'))),
      card('Finest smoke', sm.status, fine ? `${fine.name}, geometric mean size, NASA SAME-2 (AIAA 2012-3536)` : 'Waiting for smoke sizes', h('div', { class: 'stat' }, fine ? String(fine.Dg_nm) : '—', h('small', {}, 'nm')))),
    h('div', { class: 'grid g2', style: 'margin-top:14px' },
      card('Why this is hard', null, null,
        h('p', {}, 'On Earth, hot gas rises. Flames flicker, smoke collects at the ceiling, and detectors are built around both. In orbit there is no "up": a flame becomes a dim blue ball fed by slow diffusion, and smoke goes wherever the ventilation takes it.'),
        h('p', {}, 'So the questions change. Not "is there smoke at the ceiling" but "which sensor sees this fire first, and how late".')),
      card('How to read this site', null, null,
        h('p', {}, 'Every panel carries a label saying where its numbers come from: ', badge('real'), ' ', badge('dome'), ' ', badge('reported'), ' ', badge('demo'), ' ', badge('missing')),
        h('p', {}, 'Nothing labelled demo or missing is a result. The ', h('a', { href: '#/evidence' }, 'Evidence'), ' page lists every check and its pass limit.')))));
}
