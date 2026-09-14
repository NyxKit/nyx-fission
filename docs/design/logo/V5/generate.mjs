import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const n = (v) => Number(v.toFixed(3));
const rects = (svg) => svg.match(/<rect\b[^>]*\/>/g) ?? [];
const attr = (r, key) => r.match(new RegExp(`\\b${key}="([^"]+)"`))[1];
const center = (r, axis) => Number(attr(r, axis)) + Number(attr(r, axis === 'x' ? 'width' : 'height')) / 2;
const pixel = (x, y, size, fill) => `<rect x="${n(x - size / 2)}" y="${n(y - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${n(size * .1346)}" fill="${fill}"/>`;
const coherentVariation = (original) => {
  // Reset the seed for each theme: geometry must match across backgrounds.
  let seed = 0x06e07;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const body = [...original];
  const entries = original.map((r, index) => ({
    r, index, x: center(r, 'x'), y: center(r, 'y'),
    row: Math.round((center(r, 'y') - 8) / 6),
    column: Math.round((center(r, 'x') - 20) / 6),
  })).filter((e) => e.y >= 17).sort((a, b) => a.row - b.row || a.x - b.x);
  const left = new Map();
  const above = new Map();
  for (const e of entries) {
    const segment = e.row < 4 ? 'upper-stem' : e.row < 6 ? 'middle-arm' : 'lower-stem';
    const remainingRows = ({ 2: 1, 3: 0, 4: 1, 5: 0, 6: 2, 7: 1, 8: 0 })[e.row];
    const floor = 2.65 + remainingRows * .04;
    const proposed = Number(attr(e.r, 'width')) * (.955 + random() * .09);
    const horizontalLimit = left.has(e.row) ? left.get(e.row) - .14 : 5.2;
    const key = `${segment}:${e.column}`;
    const verticalLimit = above.has(key) ? above.get(key) - .04 : 5.2;
    const limit = Math.min(5.2, horizontalLimit, verticalLimit);
    if (limit < floor - .001) throw new Error('No room for the constrained size taper.');
    const size = Math.min(limit, Math.max(floor, proposed));
    e.size = size;
    e.segment = segment;
    left.set(e.row, size);
    above.set(key, size);
  }
  // Echo E2's visible, right/down breakup. Keep a firmer left edge, give the
  // outer columns more freedom, and reject placements that merge particles.
  for (let attempt = 0; attempt < 256; attempt++) {
    for (const e of entries) {
      const reach = Math.min(1, e.column / 3);
      const stem = e.segment !== 'middle-arm';
      const yProgress = Math.max(0, (e.y - 20) / 36);
      const outward = stem ? e.column * (.35 + yProgress * .25) : reach * .25;
      const downward = stem ? e.column * .2 : reach * .4;
      const jitterX = (random() - .5) * (e.column === 0 ? .28 : .9 + reach * .8);
      const jitterY = (random() - .5) * (e.column === 0 ? .24 : .7 + reach * 1.1);
      // The outer tip has the diagonal release of E2, without its tiny dust.
      const targetY = e.column === 5 ? (e.row === 4 ? 33.1 : 39.8) : e.y + downward;
      const x = Math.min(52.6 - e.size / 2, e.x + outward + jitterX);
      const y = targetY + jitterY;
      body[e.index] = pixel(x, y, e.size, attr(e.r, 'fill'));
    }
    const boxes = body.map((r) => ({ x: Number(attr(r, 'x')), y: Number(attr(r, 'y')), size: Number(attr(r, 'width')) }));
    const overlaps = boxes.some((a, i) => boxes.slice(i + 1).some((b) =>
      a.x < b.x + b.size + .18 && b.x < a.x + a.size + .18 &&
      a.y < b.y + b.size + .18 && b.y < a.y + a.size + .18));
    if (!overlaps) return body;
  }
  throw new Error('Could not place the scattered particles without overlap.');
};
const studies = [
  { id: '06E2', slug: 'V4-reference', name: 'Where we left off', ref: '../V4/studies/06E2-subtle-stem',
    note: 'V4 reference. Repeated halving leaves very small particles at the outside of the field.' },
  { id: '09', slug: 'V1-reference', name: 'The useful reference', ref: '../V1/studies/09-mono',
    note: 'V1 reference. A shared grid and a gradual change in size keep the particles reading as one form.' },
  { id: '06E3', slug: 'steady-grid', name: 'A steady taper',
    note: 'Rounded pixels on a shared grid. Sizes decrease in small steps, with substantial particles at the edges.' },
  { id: '06E4', slug: 'gentle-release', name: 'A little movement', scatter: true,
    note: 'The same size progression, with a small rightward release. Enough movement to loosen the grid without losing its rhythm.' },
  { id: '06E5', slug: 'one-ink', name: 'One ink, same rhythm', scatter: true, mono: true,
    note: 'Exactly the geometry of 06E4 in one ink, borrowing 09’s restraint to show the shape and taper clearly.' },
  { id: '06E06', slug: 'slimmer-stem', name: 'A slimmer stem', derive: '06E4',
    note: '06E4 with the entire far-left column removed. A narrower stem with the same particle sizes, colors, and rightward taper.' },
  { id: '06E07', slug: 'coherent-scatter', name: 'A little irregularity', derive: '06E06', jitter: true,
    note: '06E06’s slimmer stem and fuller particles, with a more visible breakup inspired by 06E2. Irregular spacing keeps a smaller-next-particle progression.' },
];

await mkdir(new URL('studies/', root), { recursive: true });
for (const theme of ['light', 'dark']) {
  const source = rects(await readFile(new URL(`../V1/studies/06-pixels-${theme}.svg`, root), 'utf8'));
  if (source.length !== 36) throw new Error('Review the source grid before regenerating.');
  const palette = source.slice(0, 4).map((r) => attr(r, 'fill'));
  const monoInk = theme === 'dark' ? 'oklch(0.94 0.008 285)' : 'oklch(0.25 0.008 285)';
  for (const s of studies) {
    s.svg ??= {};
    if (s.ref) s.svg[theme] = await readFile(new URL(`${s.ref}-${theme}.svg`, root), 'utf8');
    else if (s.derive) {
      const original = rects(studies.find((item) => item.id === s.derive).svg[theme]);
      let body;
      if (s.jitter) body = coherentVariation(original);
      else {
        const leftmost = Math.min(...original.map((r) => center(r, 'x')));
        body = original.filter((r) => Math.abs(center(r, 'x') - leftmost) > .001);
        if (original.length - body.length !== 9) throw new Error('Expected to remove one complete nine-pixel column.');
      }
      s.svg[theme] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${s.id}: ${s.name}, for ${theme} backgrounds">${body.join('')}</svg>\n`;
    }
    else {
      const shapes = [];
      const additions = [];
      const emit = (x, y, size, fill, step = 0) => {
        // Mild displacement follows the same grid, with no isolated dust.
        const dx = s.scatter ? step * .2 : 0;
        const dy = s.scatter ? step * .055 + (Math.round(y) % 4 === 0 ? .06 : -.04) * Math.min(step, 1) : 0;
        return pixel(x + dx, y + dy, size, s.mono ? monoInk : fill);
      };
      for (const [i, r] of source.entries()) {
        const x = center(r, 'x'), y = center(r, 'y');
        // Preserve the complete top arm and the left edge of the stem.
        if (y < 17 || x === 14) {
          shapes.push(s.mono ? r.replace(/fill="[^"]+"/, `fill="${monoInk}"`) : r);
          continue;
        }
        if (y >= 30 && y <= 40) {
          if (x === 20) shapes.push(s.mono ? r.replace(/fill="[^"]+"/, `fill="${monoInk}"`) : r);
          else {
            const step = Math.round((x - 26) / 6);
            const size = 5 - step * .45 - (y > 35 ? .15 : 0);
            shapes.push(emit(x, y, size, attr(r, 'fill'), step));
          }
          continue;
        }
        // Four columns read as a continuous field: original left/right stem,
        // then two added columns with an equal 0.95-unit size reduction.
        const size = 5 - (y - 20) * .0125;
        shapes.push(emit(x, y, size, attr(r, 'fill')));
        additions.push(
          emit(26, y, size - .95, palette[(i + 1) % 4], 1),
          emit(32, y, size - 1.9, palette[(i + 2) % 4], 2),
        );
      }
      // A single well-sized terminal column carries the middle arm rightward.
      // The two lower fragment rows from V4 are deliberately folded into the
      // shared grid instead of extending the form downward.
      additions.push(emit(50, 32, 3.2, palette[2], 4), emit(50, 38, 3.05, palette[1], 4));
      const body = [...shapes, ...additions];
      for (const r of body) {
        if (Number(attr(r, 'width')) < 2.65 - .001) throw new Error('Particle below the minimum size.');
        if (Number(attr(r, 'x')) + Number(attr(r, 'width')) > 52.6 + .001) throw new Error('Particle exceeds the top-arm width.');
      }
      s.svg[theme] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${s.id}: ${s.name}, for ${theme} backgrounds">${body.join('')}</svg>\n`;
    }
    await writeFile(new URL(`studies/${s.id}-${s.slug}-${theme}.svg`, root), s.svg[theme]);
  }
}
const sample = (s, theme) => `<div class="sample ${theme}"><span class="theme-label">${theme}</span><div class="large">${s.svg[theme]}</div><div class="sizes">${[16, 24, 32].map((size) => `<div><img src="studies/${s.id}-${s.slug}-${theme}.svg" width="${size}" height="${size}" alt="${s.id} at ${size} pixels"><span>${size}</span></div>`).join('')}<a href="studies/${s.id}-${s.slug}-${theme}.svg" download aria-label="Download ${s.id} for ${theme} backgrounds">SVG ↗</a></div></div>`;
const previous = await readFile(new URL('../V3/index.html', root), 'utf8');
const css = previous.match(/<style>([\s\S]*?)<\/style>/)[1];
await writeFile(new URL('index.html', root), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NyxFission · Logo studies V5</title><style>${css}
.board{grid-template-columns:repeat(7,minmax(0,1fr))}.large{height:205px}.large svg{width:184px;height:184px}.study-heading{min-height:76px}.reference{font-size:10px;font-weight:400;color:var(--muted);margin-left:8px}@media(max-width:1759px) and (min-width:1200px){.board{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:1199px){.board{grid-template-columns:1fr}.study-heading{min-height:0}}@media(max-width:520px){.large{height:154px}.large svg{width:136px;height:136px}}
</style></head><body><main>
<header><div><p class="eyebrow">NyxFission / A steadier particle field / V5</p><h1>A steadier rhythm.</h1><p class="intro">Take the gradual taper of 09 and bring it into E. Larger edge particles, a shared grid, and a more coherent rightward release.</p></div><div class="edition">2 references + 5 studies<br>14 September 2026<br>Same scale throughout</div></header>
<div class="toolbar"><p>Paired light / dark · 16 / 24 / 32 px checks</p><a href="../V4/index.html">V4 ↗</a><a href="moodboard.png">PNG overview ↗</a><a href="README.md">Study notes ↗</a></div>
<div class="board">${studies.map((s) => `<article class="study" id="study-${s.id}"><div class="study-heading"><span class="number">${s.id}${s.ref ? '<span class="reference">REFERENCE</span>' : ''}</span><h2>${s.name}</h2></div><div class="pair">${sample(s, 'light')}${sample(s, 'dark')}</div><p class="note">${s.note}</p></article>`).join('\n')}</div>
<footer><p><strong>A slower change in weight</strong><br>New studies keep every pixel at least 2.65 units wide on the 64-unit canvas. The size decreases gradually instead of halving repeatedly.</p><p><strong>06E07: bring back some breakup</strong><br>Start from 06E06’s 39 pixels and borrow the visible scatter of 06E2. The top arm stays intact; the outer particles loosen down and right, with their size order preserved.</p></footer>
</main></body></html>\n`);
console.log('Generated V5: 2 references, 5 new studies, 14 SVGs.');
