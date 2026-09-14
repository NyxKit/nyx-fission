import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const n = (v) => Number(v.toFixed(3));
const rects = (svg) => svg.match(/<rect\b[^>]*\/>/g) ?? [];
const attr = (rect, key) => rect.match(new RegExp(`\\b${key}="([^"]+)"`))[1];
const value = (rect, key) => Number(attr(rect, key));
const cx = (r) => value(r, 'x') + value(r, 'width') / 2;
const cy = (r) => value(r, 'y') + value(r, 'height') / 2;
const pixel = (x, y, size, fill) => `<rect x="${n(x - size / 2)}" y="${n(y - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${n(size * .1346)}" fill="${fill}"/>`;
const mix = (a, b, amount) => a + (b - a) * amount;
const studies = [
  { id: '06E', slug: 'original', name: 'Original E', note: 'The selected E, unchanged. Three trailing fragments, with the outermost extending beyond the top arm’s right edge.' },
  { id: '06E1', slug: 'contained', name: 'A closer breakup', note: 'Less displacement, fuller pixels, and two close fragments. Everything stays inside the top arm’s width.' },
  { id: '06E2', slug: 'subtle-stem', name: 'Drifting to the right', note: 'Two halving layers spread farther right, with a shallower downward drift. The middle arm stays compact vertically while the stem opens sideways.' },
];
await mkdir(new URL('studies/', root), { recursive: true });
let topEdge;
for (const theme of ['light', 'dark']) {
  const intact = rects(await readFile(new URL(`../V1/studies/06-pixels-${theme}.svg`, root), 'utf8'));
  const original = await readFile(new URL(`../V3/studies/06E-middle-only-${theme}.svg`, root), 'utf8');
  const e = rects(original);
  if (intact.length !== 36 || e.length !== 39) throw new Error('Reference structure changed; review the derivatives.');
  topEdge = Math.max(...intact.filter((r) => cy(r) < 17).map((r) => value(r, 'x') + value(r, 'width')));
  const compact = intact.map((r, i) => {
    if (cy(r) < 30 || cy(r) > 40 || cx(r) <= 20) return r;
    return pixel(mix(cx(r), cx(e[i]), .45), mix(cy(r), cy(e[i]), .45),
      mix(value(r, 'width'), value(e[i], 'width'), .55), attr(r, 'fill'));
  });
  const fragments = [pixel(50, 31, 1.8, attr(e[36], 'fill')), pixel(48.8, 39.8, 1.25, attr(e[37], 'fill'))];
  // Two half-size columns to the right of the stem. The source edge itself
  // tapers downward, so every horizontal sequence is exactly 1 : 1/2 : 1/4.
  const stemRows = [20, 26, 44, 50, 56];
  const stemSizes = [5.2, 4.9, 4.2, 3.9, 3.6];
  const stemScatter = [[0, .2], [.25, -.15], [-.2, .1], [.3, -.1], [.1, .25]];
  const stemParticles = [];
  const armParticles = [];
  const directional = intact.map((r) => {
    const x = cx(r), y = cy(r);
    const stemRow = stemRows.indexOf(Math.round(y));
    if (x === 20 && stemRow !== -1) {
      const size = stemSizes[stemRow];
      const [jitterX, jitterY] = stemScatter[stemRow];
      const drift = stemRow * .15;
      stemParticles.push(
        pixel(27 + drift + jitterX, y + .35 + jitterY * .4, size / 2, attr(intact[(stemRow + 2) % 14], 'fill')),
        pixel(31 + drift + jitterX * .6, y + .8 + jitterY * .4, size / 4, attr(intact[(stemRow + 3) % 14], 'fill')),
      );
      return pixel(x, y, size, attr(r, 'fill'));
    }
    // The middle arm also decreases rightward and downward. Its two new
    // lower rows halve the lower source row, then halve again.
    if (x > 20 && y >= 30 && y <= 40) {
      const column = Math.round((x - 26) / 6);
      const upperSize = 5.2 - column * .55;
      const lowerSize = upperSize * .9;
      const driftX = [0, .15, .3, .45][column];
      const driftY = [0, .15, -.05, .3][column];
      if (y > 35) {
        armParticles.push(
          pixel(x + 3 + column * .6, 41.85 + column * .1 + driftY * .2, lowerSize / 2, attr(intact[(column + 2) % 14], 'fill')),
          pixel(x + 6.5 + column * .2, 43.95 + column * .12 + driftY * .2, lowerSize / 4, attr(intact[(column + 3) % 14], 'fill')),
        );
      }
      return pixel(x + driftX, y + (y > 35 ? .3 + column * .2 : driftY), y > 35 ? lowerSize : upperSize, attr(r, 'fill'));
    }
    return r;
  });
  const shapes = [null, [...compact, ...fragments], [...directional, ...stemParticles, ...armParticles]];
  for (let i = 0; i < studies.length; i++) {
    const s = studies[i];
    s.svg ??= {};
    if (i === 0) s.svg[theme] = original;
    else {
      if (shapes[i].some((r) => value(r, 'x') + value(r, 'width') > topEdge + .001)) {
        throw new Error(`${s.id} extends beyond the top arm.`);
      }
      s.svg[theme] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${s.id}: ${s.name}, for ${theme} backgrounds">${shapes[i].join('')}</svg>\n`;
    }
    await writeFile(new URL(`studies/${s.id}-${s.slug}-${theme}.svg`, root), s.svg[theme]);
  }
}
const large = (svg) => svg.replace('</svg>', `<path class="edge-guide" d="M${n(topEdge)} 3V61" fill="none" stroke="currentColor" stroke-width=".3" stroke-dasharray="1 1.3" aria-hidden="true"/></svg>`);
const sample = (s, theme) => `<div class="sample ${theme}"><span class="theme-label">${theme}</span><div class="large">${large(s.svg[theme])}</div><div class="sizes">${[16, 24, 32].map((size) => `<div><img src="studies/${s.id}-${s.slug}-${theme}.svg" width="${size}" height="${size}" alt="${s.id} at ${size} pixels"><span>${size}</span></div>`).join('')}<a href="studies/${s.id}-${s.slug}-${theme}.svg" download aria-label="Download ${s.id} for ${theme} backgrounds">SVG ↗</a></div></div>`;
const previous = await readFile(new URL('../V3/index.html', root), 'utf8');
const css = previous.match(/<style>([\s\S]*?)<\/style>/)[1];
await writeFile(new URL('index.html', root), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NyxFission · Logo studies V4</title><style>${css}
main{max-width:1500px}.board{grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.large{height:210px}.large svg{width:192px;height:192px}.edge-guide{opacity:0;pointer-events:none}body:has(#show-guides:checked) .edge-guide{opacity:.5}.guide-control{display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;white-space:nowrap}.guide-control input{accent-color:var(--accent);width:15px;height:15px;margin:0}.guide-control input:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.toolbar{flex-wrap:wrap;gap:16px}.toolbar p{min-width:240px}@media(max-width:1100px){.board{grid-template-columns:1fr}.pair{grid-template-columns:1fr 1fr}.large{height:180px}.large svg{width:164px;height:164px}}@media(min-width:1101px){.pair{grid-template-columns:1fr}.study-heading{min-height:66px}.number{display:block}}@media(max-width:520px){.large{height:154px}.large svg{width:136px;height:136px}}@media print{.board{grid-template-columns:repeat(3,minmax(0,1fr))}.pair{grid-template-columns:1fr}}
</style></head><body><main>
<header><div><p class="eyebrow">NyxFission / E derivatives / V4</p><h1>A quieter kind of fission.</h1><p class="intro">Original E, a compact middle arm, and a revised E2 with progressively smaller particles spreading mostly rightward.</p></div><div class="edition">3 directions · 2 backgrounds<br>14 September 2026<br>Same scale throughout</div></header>
<div class="toolbar"><p>Paired light / dark · 16 / 24 / 32 px checks</p><label class="guide-control"><input id="show-guides" type="checkbox">Show top-arm edge</label><a href="../V3/index.html">V3 ↗</a><a href="moodboard.png">PNG overview ↗</a><a href="README.md">Study notes ↗</a></div>
<div class="board">${studies.map((s) => `<article class="study" id="study-${s.id}"><div class="study-heading"><span class="number">${s.id}</span><h2>${s.name}</h2></div><div class="pair">${sample(s, 'light')}${sample(s, 'dark')}</div><p class="note">${s.note}</p></article>`).join('\n')}</div>
<footer><p><strong>Compact means contained</strong><br>In 06E1 and 06E2, even the outer edges of the detached pixels stay inside the top arm’s right boundary. The top arm remains unchanged.</p><p><strong>06E2: more right, less down</strong><br>The two added layers still halve in particle size. Wider horizontal offsets and tighter vertical spacing give the breakup a shallower direction, with larger particles above.</p></footer>
</main></body></html>\n`);
console.log(`Generated 3 E studies, 6 SVGs. Top arm boundary: x=${n(topEdge)}.`);
