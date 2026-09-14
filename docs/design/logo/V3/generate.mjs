import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const studies = [
  { id: '06', slug: 'pixels', name: 'Intact grid', ref: '../V1/studies/06-pixels',
    note: 'Both arms intact. The original rounded pixel F.' },
  { id: '06A', slug: 'close-pixels', name: 'Subtle release', ref: '../V2/studies/06A-close-pixels',
    note: 'Both arms loosen gently into a few nearby fragments.' },
  { id: '06B', slug: 'balanced-pixels', name: 'Balanced release', ref: '../V2/studies/06B-balanced-pixels',
    note: 'Both arms disperse with moderate travel and a fuller cloud.' },
  { id: '06C', slug: 'open-pixels', name: 'Full release', ref: '../V2/studies/06C-open-pixels',
    note: 'Both arms spread farther, using the full breakup of 03.' },
  { id: '06E', slug: 'middle-only', name: 'One arm in motion',
    note: 'The top arm stays intact. Only the middle arm fragments, using 06B’s treatment.' },
];
const rectangles = (svg) => svg.match(/<rect\b[^>]*\/>/g) ?? [];
const attr = (rect, key) => Number(rect.match(new RegExp(`\\b${key}="([^"]+)"`))[1]);
const centerY = (rect) => attr(rect, 'y') + attr(rect, 'height') / 2;

await mkdir(new URL('studies/', root), { recursive: true });
for (const s of studies) {
  s.svg = {};
  for (const theme of ['light', 'dark']) {
    if (s.ref) {
      s.svg[theme] = await readFile(new URL(`${s.ref}-${theme}.svg`, root), 'utf8');
    } else {
      const intact = rectangles(studies[0].svg[theme]);
      const dispersed = rectangles(studies[2].svg[theme]);
      if (intact.length !== 36 || dispersed.length !== 41) {
        throw new Error('The reference particle structure changed; review the middle-arm composition.');
      }
      // Copy actual source shapes: 06 supplies the top and stem, 06B the middle.
      const body = intact.map((rect, i) => {
        const y = centerY(rect);
        return y >= 30 && y <= 40 ? dispersed[i] : rect;
      }).join('');
      const fragments = dispersed.slice(intact.length).filter((rect) => centerY(rect) > 24).join('');
      s.svg[theme] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="06E: intact top arm and fragmented middle arm, for ${theme} backgrounds">${body}${fragments}</svg>\n`;
    }
    await writeFile(new URL(`studies/${s.id}-${s.slug}-${theme}.svg`, root), s.svg[theme]);
  }
}
const sample = (s, theme) => `<div class="sample ${theme}"><span class="theme-label">${theme}</span><div class="large">${s.svg[theme]}</div><div class="sizes">${[16, 24, 32].map((size) => `<div><img src="studies/${s.id}-${s.slug}-${theme}.svg" width="${size}" height="${size}" alt="${s.id} at ${size} pixels"><span>${size}</span></div>`).join('')}<a href="studies/${s.id}-${s.slug}-${theme}.svg" download aria-label="Download ${s.id} for ${theme} backgrounds">SVG ↗</a></div></div>`;
const previous = await readFile(new URL('../V1/index.html', root), 'utf8');
const css = previous.match(/<style>([\s\S]*?)<\/style>/)[1];
await writeFile(new URL('index.html', root), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NyxFission · V3 · Pixel comparison</title><style>${css}
main{max-width:1800px;padding:44px 40px 28px}h1{font-size:clamp(38px,4.6vw,72px)}.board{grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}.study-heading{display:block;min-height:66px;margin-bottom:12px}.number{display:block;margin-bottom:10px;font-size:14px}h2{font-size:19px;letter-spacing:-.025em}.pair{grid-template-columns:1fr}.sample{padding:14px 16px 12px}.large{height:195px}.large svg{width:176px;height:176px}.sizes{gap:16px}.note{font-size:13px;margin-top:14px}.new{font-size:10px;letter-spacing:.05em;margin-left:8px;color:var(--muted);font-weight:400}footer{margin-top:30px}
@media(max-width:1199px){main{padding:32px 24px}.board{grid-template-columns:1fr}.study-heading{min-height:0}.number{display:inline;margin-right:10px}h2{display:inline}.pair{grid-template-columns:1fr 1fr}.large{height:180px}.large svg{width:164px;height:164px}.note{margin-top:10px}.board{gap:28px}}
@media(max-width:520px){main{padding:28px 16px}.sample{padding:12px 10px}.large{height:154px}.large svg{width:136px;height:136px}.sizes{gap:10px}h2{font-size:20px}.study-heading{line-height:1.6}.note{font-size:13px}}@media print{.board{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.pair{grid-template-columns:1fr}.sample{padding:10px}.large{height:140px}.large svg{width:120px;height:120px}.sizes{gap:10px}.study-heading{min-height:65px}.number{display:block}h2{font-size:16px}.note{font-size:11px}}
</style></head><body><main>
<header><div><p class="eyebrow">NyxFission / V3 · Pixel comparison</p><h1>The pixel shortlist.</h1><p class="intro">06, 06A, 06B, 06C, and a new study with an intact top arm and a fragmented middle arm.</p></div><div class="edition">5 directions · 2 backgrounds<br>14 September 2026<br>Same scale throughout</div></header>
<div class="toolbar"><p>Paired light / dark · 16 / 24 / 32 px checks</p><a href="../V2/index.html">V2 ↗</a><a href="moodboard.png">PNG overview ↗</a><a href="README.md">Study notes ↗</a></div>
<div class="board">${studies.map((s) => `<article class="study" id="study-${s.id}"><div class="study-heading"><span class="number">${s.id}${s.id === '06E' ? '<span class="new">NEW</span>' : ''}</span><h2>${s.name}</h2></div><div class="pair">${sample(s, 'light')}${sample(s, 'dark')}</div><p class="note">${s.note}</p></article>`).join('\n')}</div>
<footer><p><strong>06E: one controlled change</strong><br>The top arm and stem come directly from 06. The middle arm and its three escaping pixels come directly from 06B.</p><p><strong>Compare like for like</strong><br>06 through 06C are unchanged from the earlier boards. All five use the same 64×64 canvas, display scale, and blue/violet inks.</p></footer>
</main></body></html>\n`);
console.log('Generated V3 comparison: 5 studies, 10 SVGs.');
