# V6 · Horizontal breakup from the junction

[Open the moodboard](index.html) · [PNG overview](moodboard.png) · [V5](../V5/index.html)

V6 resets the exploration to an intact top arm and stem, with disintegration
restricted to the second horizontal arm of the F. The comparison uses V1's
clean pixel mark as its base, restoring the regular two-column stem.

| Study | Treatment | Light | Dark |
| --- | --- | --- | --- |
| 06 · Reference | The intact pixel F, copied exactly | [SVG](studies/06-intact-reference-light.svg) | [SVG](studies/06-intact-reference-dark.svg) |
| 06E08 | Middle-arm breakup from the stem intersection along the x-axis | [SVG](studies/06E08-junction-release-light.svg) | [SVG](studies/06E08-junction-release-dark.svg) |
| 06E09 | Fuller particles with a slower taper and quieter scatter | [SVG](studies/06E09-fuller-trail-light.svg) | [SVG](studies/06E09-fuller-trail-dark.svg) |
| 06E10 | Earlier size reduction at the junction, easing toward the tip | [SVG](studies/06E10-early-release-light.svg) | [SVG](studies/06E10-early-release-dark.svg) |
| 06E11 | More irregular spacing and size variation | [SVG](studies/06E11-loose-rhythm-light.svg) | [SVG](studies/06E11-loose-rhythm-dark.svg) |
| 06E12 | A shorter, six-particle trail per row | [SVG](studies/06E12-short-trail-light.svg) | [SVG](studies/06E12-short-trail-dark.svg) |

## Geometry

- Disintegration starts at x=14, including both columns at the stem/arm
  intersection. It does not wait until the arm protrudes beyond the stem.
- Only the pixel rows centered at y=32 and y=38 change. The 24 other pixels
  forming the top arm and remaining stem are copied unchanged.
- 06E08–06E11 have seven progressively smaller particles in each changed row,
  including a terminal pixel near x=50, for 38 pixels total. 06E12 uses six
  particles per changed row and has 36 pixels total.
- Sizes taper with seeded variation around each proposal's nominal sizes.
  Each next pixel remains at least 0.18 units smaller, with a minimum width
  of 2.65 units on the shared 64×64 canvas.
- Rightward displacement grows slightly along the arm. Subtle y scatter stays
  within each proposal's specified limit, with its mean offset corrected to zero.
  The breakup has no downward trend.
- Full particle edges remain within the top arm's right boundary, x=52.6.
  Geometry is identical across light and dark versions, and the fixed seed
  makes regeneration reproducible.

| Proposal | Size variation | Maximum y scatter | Main difference |
| --- | --- | --- | --- |
| 06E08 | ±4% | ±0.40 units | Original gradual taper, unchanged |
| 06E09 | ±2.5% | ±0.30 units | Gentler size reduction and fuller tips |
| 06E10 | ±3% | ±0.40 units | Curved taper reduces size earlier |
| 06E11 | ±5% | ±0.65 units | Greater variation in spacing |
| 06E12 | ±4% | ±0.45 units | Shorter overall middle arm |

The size limits and monotonic ordering constrain the randomized proposals.
Placements that bring particles within 0.15 units of one another are retried
deterministically. 06E09 and 06E11 make a useful comparison between a fuller,
quieter arm and a more irregular release.

All studies appear on light and dark backgrounds, with 16, 24, and 32 px
previews and transparent SVG downloads.

## Regenerate

```sh
node docs/design/logo/V6/generate.mjs
```

The generator reads V1's pixel mark and V3's board styles. It writes this
version's HTML and twelve SVGs without changing V1–V5. Open the HTML directly
from disk; no server or network requests are needed.

The PNG is a Chromium full-page screenshot at a 1800 px viewport and 1×
device scale. Refresh it after editing the studies.

Checked across desktop, tablet, and mobile widths: six studies and all 36
small-size previews load without overflow. Geometry checks confirm unchanged
pixels outside the middle arm, taper beginning at the intersection, descending
sizes, zero net vertical drift, matching themes, and reproducible exports.
