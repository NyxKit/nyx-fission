# V5 · A steadier particle field

[Open the moodboard](index.html) · [PNG overview](moodboard.png) · [V4](../V4/index.html)

V5 addresses the abrupt size changes and scattered structure of V4's 06E2.
V1's study 09 supplies the reference: gradual changes in particle size on a
shared grid. The new studies keep rounded pixels, an intact top arm, and a
predominantly rightward release.

| Study | Treatment | Light | Dark |
| --- | --- | --- | --- |
| 06E2 · Reference | V4's last iteration, unchanged | [SVG](studies/06E2-V4-reference-light.svg) | [SVG](studies/06E2-V4-reference-dark.svg) |
| 09 · Reference | V1's monochrome circle taper, unchanged | [SVG](studies/09-V1-reference-light.svg) | [SVG](studies/09-V1-reference-dark.svg) |
| 06E3 | A gradual pixel taper on a regular grid | [SVG](studies/06E3-steady-grid-light.svg) | [SVG](studies/06E3-steady-grid-dark.svg) |
| 06E4 | The same taper with a slight rightward release | [SVG](studies/06E4-gentle-release-light.svg) | [SVG](studies/06E4-gentle-release-dark.svg) |
| 06E5 | Exactly 06E4's geometry, in one ink | [SVG](studies/06E5-one-ink-light.svg) | [SVG](studies/06E5-one-ink-dark.svg) |
| 06E06 | 06E4 with its complete far-left column removed | [SVG](studies/06E06-slimmer-stem-light.svg) | [SVG](studies/06E06-slimmer-stem-dark.svg) |
| 06E07 | 06E06's fuller particles with visible scatter inspired by 06E2 | [SVG](studies/06E07-coherent-scatter-light.svg) | [SVG](studies/06E07-coherent-scatter-dark.svg) |

## What changes

- Particle sizes decrease in steady steps. The stem's added columns subtract
  0.95 units at each step; the middle arm subtracts 0.45 units per column.
- The smallest new pixel is 2.65 units wide on a 64×64 canvas. No particle
  collapses into the tiny specks produced by repeated halving in V4.
- Two added columns remain beside the stem. The loose rows beneath the middle
  arm are folded into the shared grid; a full-size terminal column extends the
  middle arm to the right instead. 06E3–06E5 each contain 48 pixels.
- 06E4 and 06E5 add at most 0.8 units of rightward drift and 0.28 units of
  downward drift. Their particle sizes are identical to 06E3.
- In 06E3–06E5, the top-arm geometry and left stem edge remain intact. The colored studies
  preserve the original top-arm fills too. Every new particle stays within the
  top arm's right edge at x=52.6.

06E06 removes all nine pixels centered at x=14 from 06E4, including the two
that belong to the top arm. The other 39 pixels are unchanged, with no recentering
or resizing, so the thinner stem can be compared directly with 06E4.
06E5 remains a monochrome comparison of the wider 06E4 geometry.

06E07 starts from all 39 pixels of 06E06. Its top arm stays exactly intact;
the stem and middle arm receive seeded size proposals within ±4.5%, with final
sizes constrained to decrease by at least 0.14 units along each rightward row.
Sizes also decrease by at least 0.04 units downward within each branch
(upper stem, middle arm, lower stem), while respecting the 2.65-unit minimum.
The constraints can reduce a proposed size further to preserve this order.
Position scatter takes more direction from 06E2: the outer columns have a
visible right/down release and more irregular spacing, while the left stem
edge stays firmer. Jitter increases toward the outer particles, reaching
±0.85 units horizontally and ±0.9 vertically around the directional offsets.
The two terminal middle-arm pixels drift down slightly. Placement is rejected
if particles overlap or approach within a 0.18-unit clearance; the top-arm
width remains the right boundary.
The fixed seed produces identical geometry on light and dark backgrounds and
on every regeneration. Colors, pixel count, and the overall grid are preserved.

## Regenerate

```sh
node docs/design/logo/V5/generate.mjs
```

The generator reads V1's pixel mark and study 09, V4's 06E2, and V3's board
styles. It writes this version's HTML and fourteen SVGs without changing V1–V4.
Both backgrounds include large marks and 16, 24, and 32 px previews.

Open the HTML directly from disk. The PNG overview is a Chromium full-page
screenshot at a 1800 px viewport and 1× device scale; refresh it after edits.

Validated with seven studies, fourteen background samples, and 42 small-size
previews across desktop, tablet, and mobile widths. 06E07's size ordering,
particle clearance, matching theme geometry, and deterministic regeneration
are checked; all previously exported studies remain unchanged.
