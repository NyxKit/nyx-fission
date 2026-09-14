import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const n = (v) => Number(v.toFixed(3));
const rects = (svg) => svg.match(/<rect\b[^>]*\/>/g) ?? [];
const attr = (r, key) => r.match(new RegExp(`\\b${key}="([^"]+)"`))[1];
const center = (r, axis) => Number(attr(r, axis)) + Number(attr(r, axis === 'x' ? 'width' : 'height')) / 2;
const pixel = (x, y, size, fill) => `<rect x="${n(x - size / 2)}" y="${n(y - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${n(size * .1346)}" fill="${fill}"/>`;
const studies = [
  { id: '06', slug: 'intact-reference', name: 'The clean pixel F',
    note: 'The intact V1 pixel mark. A fixed top arm and a two-column stem establish the reference.' },
  { id: '06E08', slug: 'junction-release', name: 'Start at the junction',
    note: 'Only the middle arm changes, starting inside the stem intersection. Pixels gradually get smaller to the right, with subtle irregularity in size and spacing.' },
  { id: '06E09', slug: 'fuller-trail', name: 'Keep more weight', seed: 0x0609, startSize: 5.05, taper: .28, variation: .025, drift: .04, yLimit: .3,
    note: 'A gentler taper keeps the outer particles fuller. Less scatter gives the arm a quieter, more substantial presence.' },
  { id: '06E10', slug: 'early-release', name: 'Release a little sooner', seed: 0x0610, curve: true, variation: .03, drift: .12,
    note: 'Size drops more noticeably at the junction, then eases into a gradual trail. The breakup reads earlier along the arm.' },
  { id: '06E11', slug: 'loose-rhythm', name: 'Loosen the spacing', seed: 0x0611, variation: .05, drift: .13, xJitter: .6, xJitterGrowth: .12, yJitter: 1.3, yLimit: .65,
    note: 'More variation in spacing and size, while every next pixel remains smaller. A livelier horizontal release without a downward trend.' },
  { id: '06E12', slug: 'short-trail', name: 'A shorter trail', seed: 0x0612, columns: 6, taper: .4, drift: .12, yLimit: .45,
    note: 'Six particles per row keep the arm shorter. The taper starts at the same junction but finishes well inside the top arm’s width.' },
];

const generateStudy = (s, source, theme) => {
  const fixed = source.filter((r) => center(r, 'y') < 30 || center(r, 'y') > 40);
  const palette = source.slice(0, 4).map((r) => attr(r, 'fill'));
  let seed = s.seed ?? 0x0608;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const columns = s.columns ?? 7;
  const variation = s.variation ?? .04;
  const yLimit = s.yLimit ?? .4;
  // Retry the seeded proposal if the looser study puts two pixels too close.
  for (let attempt = 0; attempt < 128; attempt++) {
  const changed = [];
  for (const [rowIndex, y] of [32, 38].entries()) {
    const originals = source.filter((r) => Math.abs(center(r, 'y') - y) < .001);
    const row = [];
    let previous = 5.2;
    for (let column = 0; column < columns; column++) {
      const nominal = s.curve
        ? 5 - 2.15 * Math.pow(column / (columns - 1), .65) - rowIndex * .06
        : (s.startSize ?? 5) - column * (s.taper ?? .35) - rowIndex * .06;
      const proposed = nominal * (1 - variation + random() * variation * 2);
      const size = Math.max(2.65, Math.min(proposed, column === 0 ? 5.2 : previous - .18));
      // Start at x=14, inside the stem, rather than after the protruding arm.
      const x = Math.min(52.6 - size / 2, 14 + column * 6 + column * (s.drift ?? .1) + (random() - .5) * ((s.xJitter ?? .36) + column * (s.xJitterGrowth ?? .1)));
      row.push({ x, y: (random() - .5) * (s.yJitter ?? .7), size,
        fill: column < originals.length ? attr(originals[column], 'fill') : palette[rowIndex ? 1 : 2] });
      previous = size;
    }
    // Scatter around the horizontal centerline, with exactly zero net drift.
    const mean = row.reduce((sum, p) => sum + p.y, 0) / row.length;
    const maxOffset = Math.max(...row.map((p) => Math.abs(p.y - mean)));
    const scale = maxOffset > yLimit ? yLimit / maxOffset : 1;
    changed.push(...row.map((p) => pixel(p.x, y + (p.y - mean) * scale, p.size, p.fill)));
  }
  const body = [...fixed, ...changed];
  const boxes = body.map((r) => ({ x: Number(attr(r, 'x')), y: Number(attr(r, 'y')), size: Number(attr(r, 'width')) }));
  if (boxes.some((p) => p.x + p.size > 52.601 || p.size < 2.649)) throw new Error('Particle exceeds size or width bounds.');
  if (boxes.some((a, i) => boxes.slice(i + 1).some((b) =>
    a.x < b.x + b.size + .15 && b.x < a.x + a.size + .15 &&
    a.y < b.y + b.size + .15 && b.y < a.y + a.size + .15))) continue;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${s.id}: horizontal middle-arm disintegration starting at the stem junction, for ${theme} backgrounds">${body.join('')}</svg>\n`;
  }
  throw new Error(`Could not find a clear placement for ${s.id}.`);
};

await mkdir(new URL('studies/', root), { recursive: true });
for (const theme of ['light', 'dark']) {
  const original = await readFile(new URL(`../V1/studies/06-pixels-${theme}.svg`, root), 'utf8');
  const source = rects(original);
  if (source.length !== 36) throw new Error('Review the source grid before regenerating.');
  for (const [i, s] of studies.entries()) {
    s.svg ??= {};
    s.svg[theme] = i === 0 ? original : generateStudy(s, source, theme);
    await writeFile(new URL(`studies/${s.id}-${s.slug}-${theme}.svg`, root), s.svg[theme]);
  }
}
const sample = (s, theme) => `<div class="sample ${theme}"><span class="theme-label">${theme}</span><div class="large">${s.svg[theme]}</div><div class="sizes">${[16, 24, 32].map((size) => `<div><img src="studies/${s.id}-${s.slug}-${theme}.svg" width="${size}" height="${size}" alt="${s.id} at ${size} pixels"><span>${size}</span></div>`).join('')}<a href="studies/${s.id}-${s.slug}-${theme}.svg" download aria-label="Download ${s.id} for ${theme} backgrounds">SVG ↗</a></div></div>`;
const previous = await readFile(new URL('../V3/index.html', root), 'utf8');
const css = previous.match(/<style>([\s\S]*?)<\/style>/)[1];
await writeFile(new URL('index.html', root), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NyxFission · Logo studies V6</title><style>${css}
main{max-width:1800px}.board{grid-template-columns:repeat(6,minmax(0,1fr));gap:18px}.pair{grid-template-columns:1fr}.large{height:205px}.large svg{width:min(184px,100%);height:auto}.study-heading{min-height:76px}h2{font-size:19px}@media(max-width:1499px) and (min-width:1200px){.board{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:1199px){.board{grid-template-columns:1fr}.pair{grid-template-columns:1fr 1fr}.study-heading{min-height:0}}@media(max-width:520px){.large{height:154px}.large svg{width:136px;height:136px}h2{font-size:20px}}@media print{.large{height:150px}.large svg{width:136px;height:136px}}
</style></head><body><main>
<header><div><p class="eyebrow">NyxFission / Back to one arm / V6</p><h1>From the junction, outward.</h1><p class="intro">An intact top arm and stem. Five ways to break up the middle arm horizontally, starting at the junction: gradual, fuller, earlier, looser, or shorter.</p></div><div class="edition">1 reference + 5 studies<br>14 September 2026<br>Same scale throughout</div></header>
<div class="toolbar"><p>Paired light / dark · 16 / 24 / 32 px checks</p><a href="../V5/index.html">V5 ↗</a><a href="moodboard.png">PNG overview ↗</a><a href="README.md">Study notes ↗</a></div>
<div class="board">${studies.map((s) => `<article class="study" id="study-${s.id}"><div class="study-heading"><span class="number">${s.id}</span><h2>${s.name}</h2></div><div class="pair">${sample(s, 'light')}${sample(s, 'dark')}</div><p class="note">${s.note}</p></article>`).join('\n')}</div>
<footer><p><strong>The junction is part of the breakup</strong><br>Both pixel rows of the middle arm taper from their first column inside the stem. All pixels outside those two rows are copied unchanged from the reference.</p><p><strong>Horizontal, with a little irregularity</strong><br>Size variation preserves a smaller-next-particle progression. Position scatter stays close to the two horizontal centerlines, with no downward drift.</p></footer>
</main></body></html>\n`);
console.log('Generated V6: intact reference and five proposals, twelve SVGs.');
