import { mkdir, readFile, writeFile } from 'node:fs/promises';

// No dependencies. Run from any directory: node docs/design/logo/V1/generate.mjs
const root = new URL('./', import.meta.url);
const source = await readFile(new URL('reference/original.svg', root), 'utf8');
const original = source.match(/<g[\s\S]*<\/g>/)[0];
const points = [...source.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
  .map((m) => ({ x: +m[1], y: +m[2], r: +m[3] }));
const n = (v) => Number(v.toFixed(2));
const circle = (x, y, r, fill, extra = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, fill, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const colors = (theme) => theme === 'dark'
  ? ['oklch(0.73 0.17 300)', 'oklch(0.68 0.17 260)', 'oklch(0.83 0.10 302)', 'oklch(0.60 0.17 275)']
  : ['oklch(0.49 0.23 300)', 'oklch(0.48 0.20 260)', 'oklch(0.61 0.21 302)', 'oklch(0.40 0.17 275)'];
const ink = (t) => t === 'dark' ? 'oklch(0.94 0.008 285)' : 'oklch(0.25 0.008 285)';
const f = 'M12 7H53V19H25V28H46V40H25V57H12Z';
const studies = [
  { id: '00', slug: 'original', name: 'The starting point', axis: 'Existing mark',
    note: 'The current 36-particle F. Jittered spacing, mixed Nyx colors, fine white outlines.',
    trade: 'Reference: the darker blue particles recede on charcoal.', draw: () => original },
  { id: '01', slug: 'ordered', name: 'In formation', axis: 'Precision',
    note: 'Snap the original particles to a strict grid. Equal radii and a deliberate color rhythm.',
    trade: 'Closest evolution. More consistent at navigation sizes.',
    draw: (t) => points.map((p, i) => circle(14 + Math.round((p.x - 14) / 6) * 6, 8 + Math.round((p.y - 8) / 6) * 6, 2.5, colors(t)[i % 4])).join('') },
  { id: '02', slug: 'bold', name: 'Fewer, louder', axis: 'Reduction',
    note: 'Reduce to 18 oversized particles. A simpler silhouette with a softer, playful rhythm.',
    trade: 'Strong candidate for a compact app or package mark.',
    draw: (t) => Array.from({ length: 7 }, (_, y) => Array.from({ length: y === 0 || y === 1 ? 5 : y === 3 ? 4 : 1 }, (_, x) => circle(15 + x * 8.5, 8 + y * 8, 3.6, colors(t)[(x + y) % 3])).join('')).join('') },
  { id: '03', slug: 'release', name: 'Coming apart', axis: 'Motion',
    note: 'Keep the stem anchored while the arms loosen into a small cloud of escaping particles.',
    trade: 'Most literal expression of fission. Best with room to breathe.',
    draw: (t) => points.map((p, i) => {
      const a = Math.max(0, (p.x - 25) / 25);
      return circle(p.x + a * (i % 2 ? 5 : 1), p.y + a * (i % 2 ? 3 : -3), p.r * (1 - a * .38), colors(t)[i % 4]);
    }).join('') + [[58, 7, 1], [59, 19, .7], [55, 29, 1.2], [51, 42, .9], [58, 37, .65]].map((p, i) => circle(...p, colors(t)[i % 4])).join('') },
  { id: '04', slug: 'fused', name: 'Almost liquid', axis: 'Coalescence',
    note: 'Merge neighboring particles into rounded strokes, leaving two free dots at the ends.',
    trade: 'A clear F at small sizes, with a trace of the particle origin.',
    draw: (t) => path('M18 53V12H40M18 33H34', 'none', `stroke="${colors(t)[0]}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"`) + circle(52, 12, 4.5, colors(t)[1]) + circle(46, 33, 4.5, colors(t)[2]) },
  { id: '05', slug: 'fracture', name: 'The split second', axis: 'Fracture',
    note: 'A solid F interrupted by a diagonal fault. Detached fragments carry the break forward.',
    trade: 'Bolder departure. The cut needs at least 24 px to stay open.',
    draw: (t) => path('M12 7H51V19H25V25L12 33Z M12 38L25 30V30H43V41H25V57H12Z', colors(t)[0]) + rect(47, 28, 7, 7, colors(t)[1], 1) + circle(58, 27, 1.8, colors(t)[2]) },
  { id: '06', slug: 'pixels', name: 'Before the particle', axis: 'Source pixels',
    note: 'Exchange circles for rounded pixels. The same F shifts toward the media it samples.',
    trade: 'Crisp and systematic; less organic than the original.',
    draw: (t) => points.map((p, i) => rect(11.4 + Math.round((p.x - 14) / 6) * 6, 5.4 + Math.round((p.y - 8) / 6) * 6, 5.2, 5.2, colors(t)[i % 4], .7)).join('') },
  { id: '07', slug: 'constellation', name: 'Held together', axis: 'Connection',
    note: 'Stretch the grid into a network of nodes. Fine links hold a sparse particle skeleton.',
    trade: 'An expressive large mark; fine connections fade at favicon size.',
    draw: (t) => {
      const nodes = [[16, 9], [33, 9], [51, 9], [16, 32], [33, 32], [45, 32], [16, 55]];
      return path('M16 55V9H51M16 32H45M16 9L33 32L33 9M16 32L33 9M16 55L33 32', 'none', `stroke="${colors(t)[1]}" stroke-width="1.1"`) + nodes.map((p, i) => circle(...p, i === 0 || i === 3 ? 4 : 3, colors(t)[i % 3])).join('');
    } },
  { id: '08', slug: 'depth', name: 'Out of plane', axis: 'Dimension',
    note: 'Offset two F silhouettes to expose a second plane. Particles emerge at the front edge.',
    trade: 'Connects to the depth effect. More emblematic than particle-led.',
    draw: (t) => `<g transform="translate(5 4)">${path(f, 'none', `stroke="${colors(t)[1]}" stroke-width="1.2"`)}</g>` + path(f, colors(t)[0]) + circle(47, 13, 2.5, colors(t)[2]) + circle(40, 34, 2.5, colors(t)[2]) },
  { id: '09', slug: 'mono', name: 'One ink, many weights', axis: 'Monochrome',
    note: 'Remove color and let particle size carry the energy, tapering toward the open edges.',
    trade: 'A useful one-color direction for stamps, docs, and restrained UI.',
    draw: (t) => points.map((p) => circle(14 + Math.round((p.x - 14) / 6) * 6, 8 + Math.round((p.y - 8) / 6) * 6, 2.85 - Math.max(0, p.x - 20) / 30 * 1.5, ink(t))).join('') },
];
const svg = (s, t) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${s.name}, for ${t} backgrounds">${s.draw(t)}</svg>`;
await mkdir(new URL('studies/', root), { recursive: true });
await mkdir(new URL('reference/', root), { recursive: true });
await writeFile(new URL('reference/original.svg', root), source);
for (const s of studies) for (const t of ['light', 'dark']) {
  await writeFile(new URL(`studies/${s.id}-${s.slug}-${t}.svg`, root), svg(s, t) + '\n');
}
const sample = (s, t) => `<div class="sample ${t}"><span class="theme-label">${t}</span><div class="large">${svg(s, t)}</div><div class="sizes">${[16, 24, 32].map((size) => `<div><img src="studies/${s.id}-${s.slug}-${t}.svg" width="${size}" height="${size}" alt="${s.name} at ${size} pixels"><span>${size}</span></div>`).join('')}<a href="studies/${s.id}-${s.slug}-${t}.svg" download aria-label="Download ${s.name} SVG for ${t} backgrounds">SVG ↗</a></div></div>`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NyxFission · Logo studies V1</title>
<style>
:root{color-scheme:light;--paper:oklch(.965 .006 285);--ink:oklch(.24 .008 285);--muted:oklch(.47 .008 285);--line:oklch(.84 .008 285);--accent:oklch(.49 .23 300)}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}main{max-width:1680px;margin:auto;padding:52px 56px 32px}header{display:grid;grid-template-columns:1fr auto;gap:24px;padding-bottom:32px}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;margin:0 0 20px;color:var(--accent)}h1{font-size:clamp(40px,5vw,76px);line-height:1;letter-spacing:-.055em;margin:0 0 20px;font-weight:700}.intro{font-size:16px;line-height:1.55;max-width:65ch;margin:0;color:var(--muted)}.edition{text-align:right;font-size:12px;line-height:1.8;color:var(--muted);padding-top:3px}.swatches{display:flex;gap:6px;justify-content:flex-end;margin-top:20px}.swatches i{display:block;width:18px;height:18px;border-radius:50%}.toolbar{display:flex;align-items:center;gap:20px;border-top:1px solid var(--line);padding:18px 0 26px;font-size:12px}.toolbar p{margin:0;flex:1;color:var(--muted)}a{color:inherit;text-underline-offset:3px}a:hover{color:var(--accent)}a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}.board{display:grid;grid-template-columns:1fr 1fr;gap:32px 24px}.study{min-width:0;break-inside:avoid}.study-heading{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}.number{font-size:13px;color:var(--accent);font-weight:700}h2{font-size:21px;letter-spacing:-.035em;margin:0;line-height:1.2}.axis{font-size:11px;color:var(--muted);margin-left:auto}.pair{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line)}.sample{padding:16px 20px 12px;min-width:0}.light{background:oklch(.985 .005 285);color:oklch(.25 .008 285)}.dark{background:oklch(.19 .008 285);color:oklch(.94 .008 285)}.theme-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.65}.large{height:175px;display:grid;place-items:center}.large svg{width:142px;height:142px;overflow:visible}.sizes{display:flex;align-items:flex-end;gap:18px;min-height:49px}.sizes>div{display:flex;align-items:center;flex-direction:column;gap:7px}.sizes span{font-size:9px;opacity:.6}.sizes a{margin-left:auto;font-size:10px;align-self:center;opacity:.8}.note{font-size:13px;line-height:1.5;margin:12px 0 4px;max-width:70ch}.trade{font-size:12px;line-height:1.5;color:var(--muted);margin:0;max-width:75ch}footer{border-top:1px solid var(--line);margin-top:36px;padding-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:32px;font-size:12px;line-height:1.6;color:var(--muted)}footer p{margin:0}footer strong{color:var(--ink)}
@media(min-width:1500px){.large{height:190px}.large svg{width:154px;height:154px}}@media(max-width:950px){main{padding:32px 24px}.board{grid-template-columns:1fr}.large{height:190px}.large svg{width:154px;height:154px}}@media(max-width:520px){main{padding:28px 16px}header{display:block}.edition{display:none}.toolbar{align-items:flex-start;flex-wrap:wrap;gap:12px}.toolbar p{flex-basis:100%}.study-heading{gap:8px;flex-wrap:wrap}h2{font-size:20px}.axis{font-size:10px}.sample{padding:12px 10px}.large{height:150px}.large svg{width:124px;height:124px}.sizes{gap:10px}.sizes a{font-size:9px}footer{grid-template-columns:1fr;gap:16px}}@media print{main{padding:0}.toolbar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.board{grid-template-columns:1fr 1fr;gap:24px 18px}.large{height:140px}.large svg{width:120px;height:120px}.sizes a{display:none}footer{break-inside:avoid}}
</style></head><body><main>
<header><div><p class="eyebrow">NyxFission / Identity exploration / V1</p><h1>A little less together.</h1><p class="intro">One particle F, nine ways to push it. Studies in order, density, connection, and release, each on light and dark ground.</p></div><div class="edition">Logo studies · V1<br>14 September 2026<br>Original + 9 experiments<div class="swatches">${colors('light').map((c) => `<i style="background:${c}"></i>`).join('')}</div></div></header>
<div class="toolbar"><p>Paired backgrounds · Large marks + 16 / 24 / 32 px checks · Editable vectors</p><a href="moodboard.png">PNG overview ↗</a><a href="README.md">Study notes ↗</a></div>
<div class="board">${studies.map((s) => `<article class="study" id="study-${s.id}"><div class="study-heading"><span class="number">${s.id}</span><h2>${s.name}</h2><span class="axis">${s.axis}</span></div><div class="pair">${sample(s, 'light')}${sample(s, 'dark')}</div><p class="note">${s.note}</p><p class="trade">${s.trade}</p></article>`).join('\n')}</div>
<footer><p><strong>Promising next passes</strong><br>01 for continuity. 02 for a stronger small mark. 03 for a more expressive identity. 04 for a compact symbol with a particle signature.</p><p><strong>How to compare</strong><br>Geometry is identical across each pair. Experiments adjust ink lightness for the background; 00 preserves the original exactly. Judge the silhouette first, then the small-size behavior.</p></footer>
</main></body></html>`;
await writeFile(new URL('index.html', root), html);
console.log(`Generated ${studies.length} paired studies and index.html in docs/design/logo/V1.`);
