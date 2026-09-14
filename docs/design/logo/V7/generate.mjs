import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const n = (v) => Number(v.toFixed(3));
const rects = (svg) => svg.match(/<rect\b[^>]*\/>/g) ?? [];
const attr = (r, key) => r.match(new RegExp(`\\b${key}="([^"]+)"`))[1];
const width = (r) => Number(attr(r, 'width'));
const center = (r, axis) => Number(attr(r, axis)) + width(r) / 2;
const pixel = (x, y, size, fill) => `<rect x="${n(x - size / 2)}" y="${n(y - size / 2)}" width="${n(size)}" height="${n(size)}" rx="${n(size * .1346)}" fill="${fill}"/>`;
const studies = [
  { id: '06E12', slug: 'short-reference', name: 'The shorter trail', count: 12,
    spec: 'Reference', note: 'The selected V6 study, unchanged. Six particles in each row of the middle arm.' },
  { id: '06E13', slug: 'ordered-density', name: 'More, still ordered', count: 16,
    profile: [3.9, 3.35, 2.8, 2.3, 1.85, 1.45], sizeRandom: .03, gapRandom: .08, yLimit: .28, seed: 0x0713,
    spec: 'Low variation · Same width', note: 'More particles fit within the short trail. A measured size progression and even gaps keep the breakup controlled.' },
  { id: '06E14', slug: 'looser-density', name: 'Let it loosen', count: 16,
    profile: [3.9, 3.35, 2.8, 2.3, 1.85, 1.45], sizeRandom: .14, gapRandom: .5, yLimit: .85, seed: 0x0713,
    spec: 'More variation · Same width', note: 'The same particle count and size targets as 06E13, with more randomness in size, gaps, and vertical placement.' },
  { id: '06E15', slug: 'dissolved-tip', name: 'Dissolve the ending', count: 20,
    profile: [3.75, 3.1, 2.5, 2, 1.6, 1.25, 1, .78], sizeRandom: .16, gapRandom: .55, yLimit: .95, seed: 0x0715,
    spec: 'Finer tip · Same width', note: 'More of the ending becomes small fragments. The outer edge stays fixed, testing whether the arm reads shorter as its tip dissolves.' },
  { id: '06E16', slug: 'tucked-trail', name: 'Tuck it closer', count: 20,
    profile: [3.85, 3.15, 2.55, 2.05, 1.6, 1.25, .96, .72], sizeRandom: .09, gapRandom: .3, yLimit: .55, seed: 0x0715, end: 44.3,
    spec: 'Finer tip · Shorter width', note: 'A dense, finer breakup packed into a physically shorter trail. Less positional randomness keeps the small fragments together.' },
];

const generateTrail = (s, source, theme, referenceEdge) => {
  const fixed = source.slice(0, 24);
  const middle = source.slice(24);
  const palette = source.slice(0, 4).map((r) => attr(r, 'fill'));
  const end = s.end ?? referenceEdge;
  let seed = s.seed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let attempt = 0; attempt < 128; attempt++) {
    const changed = [];
    for (const [rowIndex, y] of [32, 38].entries()) {
      // Keep E12's already-tapered junction exactly; reshape only its trail.
      const anchors = middle.slice(rowIndex * 6, rowIndex * 6 + 2);
      const count = s.profile.length;
      let previous = width(anchors[1]);
      const sizes = s.profile.map((nominal) => {
        const proposed = nominal * (1 - rowIndex * .035) * (1 - s.sizeRandom + random() * s.sizeRandom * 2);
        const size = Math.max(.6, Math.min(proposed, previous - .1));
        previous = size;
        return size;
      });
      const weights = sizes.map(() => 1 + (random() - .5) * 2 * s.gapRandom);
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const start = Number(attr(anchors[1], 'x')) + width(anchors[1]);
      const minimumGap = .3;
      const freeSpace = end - start - sizes.reduce((a, b) => a + b, 0) - count * minimumGap;
      if (freeSpace < 0) throw new Error(`${s.id} has too many large particles for its width.`);
      const offsets = sizes.map((_, i) => (random() - .5) * 2 * s.yLimit * (.35 + .65 * i / (count - 1)));
      const mean = offsets.reduce((a, b) => a + b, 0) / count;
      const anchorOffset = anchors.reduce((sum, r) => sum + center(r, 'y') - y, 0);
      const desiredMean = -anchorOffset / count;
      const maxOffset = Math.max(...offsets.map((v) => Math.abs(v - mean)));
      const scale = Math.min(1, (s.yLimit - Math.abs(desiredMean)) / (maxOffset || 1));
      let cursor = start;
      const trail = sizes.map((size, i) => {
        const gap = minimumGap + freeSpace * weights[i] / weightSum;
        const x = cursor + gap + size / 2;
        cursor += gap + size;
        return pixel(x, y + (offsets[i] - mean) * scale + desiredMean, size, palette[(i + rowIndex * 2) % 4]);
      });
      changed.push(...anchors, ...trail);
    }
    const body = [...fixed, ...changed];
    const boxes = body.map((r) => ({ x: Number(attr(r, 'x')), y: Number(attr(r, 'y')), size: width(r) }));
    if (boxes.some((a, i) => boxes.slice(i + 1).some((b) =>
      a.x < b.x + b.size + .15 && b.x < a.x + a.size + .15 &&
      a.y < b.y + b.size + .15 && b.y < a.y + a.size + .15))) continue;
    if (changed.some((r) => Number(attr(r, 'x')) + width(r) > referenceEdge + .001)) throw new Error('Trail exceeds the selected short reference.');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${s.id}: ${s.name}, for ${theme} backgrounds">${body.join('')}</svg>\n`;
  }
  throw new Error(`Could not find a separated particle placement for ${s.id}.`);
};

await mkdir(new URL('studies/', root), { recursive: true });
let referenceEdge;
for (const theme of ['light', 'dark']) {
  const original = await readFile(new URL(`../V6/studies/06E12-short-trail-${theme}.svg`, root), 'utf8');
  const source = rects(original);
  if (source.length !== 36) throw new Error('Review the 06E12 source structure.');
  referenceEdge = Math.max(...source.slice(24).map((r) => Number(attr(r, 'x')) + width(r)));
  for (const [i, s] of studies.entries()) {
    s.svg ??= {};
    s.svg[theme] = i === 0 ? original : generateTrail(s, source, theme, referenceEdge);
    await writeFile(new URL(`studies/${s.id}-${s.slug}-${theme}.svg`, root), s.svg[theme]);
  }
}
const large = (svg) => svg.replace('</svg>', `<path class="tip-guide" d="M${n(referenceEdge)} 27V43" fill="none" stroke="currentColor" stroke-width=".3" stroke-dasharray=".8 1.2" aria-hidden="true"/></svg>`);
const sample = (s, theme) => `<div class="sample ${theme}"><span class="theme-label">${theme}</span><div class="large">${large(s.svg[theme])}</div><div class="sizes">${[16, 24, 32].map((size) => `<div><img src="studies/${s.id}-${s.slug}-${theme}.svg" width="${size}" height="${size}" alt="${s.id} at ${size} pixels"><span>${size}</span></div>`).join('')}<a href="studies/${s.id}-${s.slug}-${theme}.svg" download aria-label="Download ${s.id} for ${theme} backgrounds">SVG ↗</a></div></div>`;
const previous = await readFile(new URL('../V3/index.html', root), 'utf8');
const css = previous.match(/<style>([\s\S]*?)<\/style>/)[1];
await writeFile(new URL('index.html', root), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NyxFission · Logo studies V7</title><style>${css}
.large{height:220px}.large svg{width:min(196px,100%);height:auto}.study-heading{min-height:88px}.spec{display:block;font-size:11px;color:var(--muted);margin-top:8px}.particle-count{font-size:11px;color:var(--muted);margin:10px 0 0}.tip-guide{opacity:0;pointer-events:none}body:has(#show-tip:checked) .tip-guide{opacity:.55}.guide-control{display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;white-space:nowrap}.guide-control input{accent-color:var(--accent);width:15px;height:15px;margin:0}.guide-control input:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.toolbar{flex-wrap:wrap;gap:16px}.toolbar p{min-width:220px}@media(max-width:1199px){.study-heading{min-height:0}.spec{margin-top:5px}}@media(max-width:520px){.large{height:154px}.large svg{width:136px;height:136px}}
</style></head><body><main>
<header><div><p class="eyebrow">NyxFission / The shorter trail / V7</p><h1>More pieces. A shorter read.</h1><p class="intro">Start with 06E12’s short trail. Add particles, vary the randomness, and test how a dissolving tip changes the perceived length.</p></div><div class="edition">1 reference + 4 proposals<br>14 September 2026<br>Same scale throughout</div></header>
<div class="toolbar"><p>Paired light / dark · 16 / 24 / 32 px checks</p><label class="guide-control"><input id="show-tip" type="checkbox">Show 06E12 tip</label><a href="../V6/index.html">V6 ↗</a><a href="moodboard.png">PNG overview ↗</a><a href="README.md">Study notes ↗</a></div>
<div class="board">${studies.map((s) => `<article class="study" id="study-${s.id}"><div class="study-heading"><span class="number">${s.id}</span><h2>${s.name}</h2><span class="spec">${s.spec}</span></div><div class="pair">${sample(s, 'light')}${sample(s, 'dark')}</div><p class="particle-count">${s.count} middle-arm particles</p><p class="note">${s.note}</p></article>`).join('\n')}</div>
<footer><p><strong>Actual width versus perceived length</strong><br>06E13–06E15 end at the same boundary as 06E12. Only 06E16 is physically shorter. Compare the small-size previews to judge how much the finer tips disappear.</p><p><strong>The same F underneath</strong><br>The top arm, remaining stem, and four junction particles come directly from 06E12. Extra particles stay in the middle-arm trail, with no net downward drift.</p></footer>
</main></body></html>\n`);
console.log(`Generated V7: 1 reference, 4 proposals, 10 SVGs. Reference trail ends at x=${n(referenceEdge)}.`);
