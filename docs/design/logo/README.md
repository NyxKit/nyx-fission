# NyxFission logo studies

Final selection: **V1 · 06, Before the particle**. The original rounded-pixel F
is the production [logo](../../../demo/public/logo.svg) and
[favicon](../../../demo/public/favicon.svg). The logo uses the original palette
for dark backgrounds; the favicon switches between the original light and dark
palettes with the browser color scheme. Geometry is unchanged.

Each numbered folder contains one comparison board, its PNG overview, editable
SVGs in `studies/`, study notes, and a `generate.mjs` script.

| Version | Exploration | Moodboard | PNG |
| --- | --- | --- | --- |
| V1 | Original logo and nine initial directions | [Open](V1/index.html) | [Overview](V1/moodboard.png) |
| V2 | Compact circles and dispersing pixels, developing 03 and 06 | [Open](V2/index.html) | [Overview](V2/moodboard.png) |
| V3 | Pixel shortlist: 06, 06A, 06B, 06C, and 06E | [Open](V3/index.html) | [Overview](V3/moodboard.png) |
| V4 | E derivatives, including the rightward breakup in 06E2 | [Open](V4/index.html) | [Overview](V4/moodboard.png) |
| V5 | A gradual pixel taper inspired by V1 study 09 | [Open](V5/index.html) | [Overview](V5/moodboard.png) |
| V6 | Horizontal breakup restricted to the middle arm, starting at the stem junction | [Open](V6/index.html) | [Overview](V6/moodboard.png) |
| V7 | Denser, more or less randomized variations on 06E12's shorter trail | [Open](V7/index.html) | [Overview](V7/moodboard.png) |

**Latest: [V7](V7/index.html).** All boards show light and dark backgrounds plus
small-size previews. Open the HTML files directly in a browser; no server is needed.

Version numbers identify comparison boards. Study identifiers such as `06E2`
identify the individual logo within a board and stay consistent across versions.
Use the next `V<number>` folder for a new comparison board.

## Regenerate

Run in dependency order from the repository root:

```sh
node docs/design/logo/V1/generate.mjs
node docs/design/logo/V2/generate.mjs
node docs/design/logo/V3/generate.mjs
node docs/design/logo/V4/generate.mjs
node docs/design/logo/V5/generate.mjs
node docs/design/logo/V6/generate.mjs
node docs/design/logo/V7/generate.mjs
```

V1 reads its preserved `reference/original.svg`. Later versions reuse earlier vectors and board
styles. Generators rebuild HTML and SVGs; refresh PNG screenshots separately
at the viewport size documented in each version's README.
