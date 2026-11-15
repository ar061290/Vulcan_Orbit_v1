// Dev check: opens every page in headless Chrome (calm motion), runs axe-core and reports errors.
// Needs: npm i puppeteer-core axe-core, and the site served on localhost:8137. Usage: node tests/site_audit.mjs day|night [pages]
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const axe = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const theme = process.argv[2] || 'day', pages = (process.argv[3] || 'overview,flame,explorer,detect,locate,predict,respond,evidence,ask,about,design').split(',');
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'], headless: 'new', protocolTimeout: 240000 });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:8137/', { waitUntil: 'domcontentloaded' }); await p.evaluate(t => { localStorage.setItem('vo.theme', t); localStorage.setItem('vo.motion', 'calm'); }, theme);
for (const pg of pages) {
  await p.goto(`http://localhost:8137/?t=${Date.now()}#/${pg}`, { waitUntil: 'domcontentloaded' }); await new Promise(r => setTimeout(r, 3500));
  if (process.argv[4]) await p.screenshot({ path: `/tmp/${theme}_${pg}.png`, fullPage: true });
  await p.evaluate(axe);
  const r = await p.evaluate(async () => { const res = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] });
    return { h1: document.querySelectorAll('h1').length, terms: document.querySelectorAll('.term').length,
      v: res.violations.map(v => `${v.impact} ${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ').slice(0, 160)}`) }; });
  console.log(`\n## ${pg} h1=${r.h1} terms=${r.terms}`); r.v.forEach(x => console.log('  ' + x));
}
console.log('errors', errs); await b.close();
