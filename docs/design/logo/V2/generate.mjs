import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const source = await readFile(new URL('../V1/reference/original.svg', root), 'utf8');
const points = [...source.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
  .map((m) => ({ x: +m[1], y: +m[2], r: +m[3] }));
const palette = (t) => t === 'dark'
  ? ['oklch(0.73 0.17 300)', 'oklch(0.68 0.17 260)', 'oklch(0.83 0.10 302)', 'oklch(0.60 0.17 275)']
  : ['oklch(0.49 0.23 300)', 'oklch(0.48 0.20 260)', 'oklch(0.61 0.21 302)', 'oklch(0.40 0.17 275)'];
const n = (v) => Number(v.toFixed(2));
const particle = (x, y, r, fill, square, angle = 0) => square
  ? `<rect x="${n(x - r)}" y="${n(y - r)}" width="${n(r * 2)}" height="${n(r * 2)}" rx="${n(r * .269)}" fill="${fill}" transform="rotate(${n(angle)} ${n(x)} ${n(y)})"/>`
  : `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"/>`;

// Interpolate displacement from study 03. The stem and 64×64 canvas never scale.
// Satellites keep a minimum separation from the arms as their travel shortens.
const draw = (s, t) => {
  const colors = palette(t);
  const shape = points.map((p, i) => {
    const baseX = s.square ? 14 + Math.round((p.x - 14) / 6) * 6 : p.x;
    const baseY = s.square ? 8 + Math.round((p.y - 8) / 6) * 6 : p.y;
    const a = Math.max(0, (baseX - s.start) / (50 - s.start));
    const x = baseX + a * (i % 2 ? 5 : 1) * s.spread;
    const y = baseY + a * (i % 2 ? 3 : -3) * s.spread;
    const r = (s.square ? 2.6 : p.r) * (1 - a * s.taper);
    return particle(x, y, r, colors[i % 4], s.square, s.rotate ? a * (i % 2 ? 18 : -14) : 0);
  }).join('');
  const satellites = [
    [50, 8, 58, 7, 1], [50, 14, 59, 19, .7],
    [44, 32, 55, 29, 1.2], [44, 38, 51, 42, .9], [44, 38, 58, 37, .65],
  ];
  return shape + satellites.map(([ax, ay, x, y, r], i) => {
    if (!s.fullCloud && (i === 1 || i === 4)) return '';
    return particle(ax + 4 + (x - ax - 4) * s.spread, ay + (y - ay) * s.spread,
      r * (s.square ? 1.12 : .9), colors[i % 4], s.square, s.rotate ? (i % 2 ? 24 : -20) : 0);
  }).join('');
};

const studies = [
  { id: '03', slug: 'reference-circles', name: 'Coming apart', axis: 'V1 reference', ref: '03-release',
    note: 'The selected circle study, unchanged. Its furthest particles establish the original spread.', trade: 'Compare the four tighter versions below.' },
  { id: '06', slug: 'reference-pixels', name: 'Before the particle', axis: 'V1 reference', ref: '06-pixels',
    note: 'The selected pixel study, unchanged. Rounded squares sit on a regular F-shaped grid.', trade: 'Compare the four dispersing versions below.' },
  { id: '03A', slug: 'close-circles', name: 'Close to home', axis: 'Tightest spread', spread: .25, start: 25, taper: .24,
    note: 'Pull the particles close to the arms. Short travel, three nearby fragments, and fuller tips.', trade: 'The most compact circle option; the breakup stays subtle.' },
  { id: '06A', slug: 'close-pixels', name: 'Pixels, loosening', axis: 'Subtle release', square: true, spread: .4, start: 25, taper: .32,
    note: 'The grid starts to loosen at the arms. Pixel size tapers gently into three close fragments.', trade: 'Keeps most of 06’s structure, with a small amount of motion.' },
  { id: '03B', slug: 'balanced-circles', name: 'A shorter escape', axis: 'Balanced spread', spread: .5, start: 25, taper: .38, fullCloud: true,
    note: 'Retain the full five-particle cloud from 03, but halve the displacement from the F.', trade: 'Closest to the selected study’s energy, in a tighter footprint.' },
  { id: '06B', slug: 'balanced-pixels', name: 'Pixels in flight', axis: 'Balanced release', square: true, spread: .7, start: 25, taper: .38, fullCloud: true,
    note: 'Apply 03’s breakup to rounded squares. Both arms feather outward into five small fragments.', trade: 'The most direct combination of the two selected directions.' },
  { id: '03C', slug: 'tip-circles', name: 'Only at the edges', axis: 'Localized spread', spread: .55, start: 37, taper: .4,
    note: 'Hold the inner arms together. Only the final columns separate and shrink into fragments.', trade: 'A firmer F silhouette, with the motion concentrated at the tips.' },
  { id: '06C', slug: 'open-pixels', name: 'Pixels coming apart', axis: 'Full release', square: true, spread: 1, start: 25, taper: .38, fullCloud: true,
    note: 'Use the original 03 displacement and cloud positions with the square particles from 06.', trade: 'The widest pixel study, included to compare the full treatment.' },
  { id: '03D', slug: 'dense-circles', name: 'More body, less drift', axis: 'Fuller particles', spread: .45, start: 25, taper: .16,
    note: 'Keep more of each particle’s weight as it leaves the grid. A short trail with less thinning.', trade: 'The densest circle option, with a stronger small-size presence.' },
  { id: '06D', slug: 'turning-pixels', name: 'A slight tumble', axis: 'Rotating tips', square: true, spread: .7, start: 31, taper: .34, fullCloud: true, rotate: true,
    note: 'Give the escaping pixels a slight turn. The stem stays square while the tips start to tumble.', trade: 'Adds directional motion without extending the cloud as far as 06C.' },
];
await mkdir(new URL('studies/', root), { recursive: true });
for (const s of studies) {
  s.svg = {};
  for (const t of ['light', 'dark']) {
    s.svg[t] = s.ref
      ? await readFile(new URL(`../V1/studies/${s.ref}-${t}.svg`, root), 'utf8')
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${s.id}: ${s.name}, for ${t} backgrounds">${draw(s, t)}</svg>\n`;
    await writeFile(new URL(`studies/${s.id}-${s.slug}-${t}.svg`, root), s.svg[t]);
  }
}
const sample = (s, t) => `<div class="sample ${t}"><span class="theme-label">${t}</span><div class="large">${s.svg[t]}</div><div class="sizes">${[16, 24, 32].map((size) => `<div><img src="studies/${s.id}-${s.slug}-${t}.svg" width="${size}" height="${size}" alt="${s.id} at ${size} pixels"><span>${size}</span></div>`).join('')}<a href="studies/${s.id}-${s.slug}-${t}.svg" download aria-label="Download ${s.id} for ${t} backgrounds">SVG ↗</a></div></div>`;
// Reuse the first board's presentation so only the logo experiments change.
const previous = await readFile(new URL('../V1/index.html', root), 'utf8');
const css = previous.match(/<style>([\s\S]*?)<\/style>/)[1];
await writeFile(new URL('index.html', root), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NyxFission · Logo studies V2</title><style>${css}
.large svg{width:174px;height:174px}.large{height:200px}.family{font-size:13px;font-weight:700;letter-spacing:.03em;color:var(--accent);margin:0}.families{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}@media(max-width:950px){.families{display:none}}@media(max-width:520px){.large{height:154px}.large svg{width:136px;height:136px}}
</style></head><body><main>
<header><div><p class="eyebrow">NyxFission / Identity exploration / V2</p><h1>Closer. Still coming apart.</h1><p class="intro">03 with less distance between particles. 06 with its arms breaking into pixels. Two selected directions, eight new studies.</p></div><div class="edition">Logo studies · V2<br>14 September 2026<br>2 references + 8 experiments<div class="swatches">${palette('light').map((c) => `<i style="background:${c}"></i>`).join('')}</div></div></header>
<div class="toolbar"><p>Same F scale · Paired backgrounds · 16 / 24 / 32 px checks</p><a href="../V1/index.html">V1 ↗</a><a href="moodboard.png">PNG overview ↗</a><a href="README.md">Study notes ↗</a></div>
<div class="families"><p class="family">03 / Tighter particle dispersal</p><p class="family">06 / Pixels breaking away</p></div>
<div class="board">${studies.map((s) => `<article class="study" id="study-${s.id}"><div class="study-heading"><span class="number">${s.id}</span><h2>${s.name}</h2><span class="axis">${s.axis}</span></div><div class="pair">${sample(s, 'light')}${sample(s, 'dark')}</div><p class="note">${s.note}</p><p class="trade">${s.trade}</p></article>`).join('\n')}</div>
<footer><p><strong>Start with 03B and 06B</strong><br>03B keeps the original cloud but shortens its travel. 06B brings that same behavior to pixels. 03A and 06A offer quieter alternatives.</p><p><strong>What stays fixed</strong><br>The F’s stem, canvas, color sequence, and display scale. Compactness comes from shorter particle travel. Each light/dark pair uses identical geometry.</p></footer>
</main></body></html>\n`);
console.log('Generated V2: 2 references, 8 experiments, 20 SVGs.');
