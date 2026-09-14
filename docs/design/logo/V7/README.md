# V7 · More particles in the shorter trail

[Open the moodboard](index.html) · [PNG overview](moodboard.png) · [V6](../V6/index.html)

V7 develops the selected **06E12**. It explores whether a denser, more dissolved
trail can read shorter, while comparing different degrees of randomness.
The reference is copied exactly. V1–V6 remain unchanged.

| Study | Middle-arm particles | Treatment | Light | Dark |
| --- | --- | --- | --- | --- |
| 06E12 · Reference | 12 | The selected short trail | [SVG](studies/06E12-short-reference-light.svg) | [SVG](studies/06E12-short-reference-dark.svg) |
| 06E13 | 16 | More particles, low size and gap variation | [SVG](studies/06E13-ordered-density-light.svg) | [SVG](studies/06E13-ordered-density-dark.svg) |
| 06E14 | 16 | Same size targets, more random scale and scatter | [SVG](studies/06E14-looser-density-light.svg) | [SVG](studies/06E14-looser-density-dark.svg) |
| 06E15 | 20 | A finer, more dissolved ending at the original width | [SVG](studies/06E15-dissolved-tip-light.svg) | [SVG](studies/06E15-dissolved-tip-dark.svg) |
| 06E16 | 20 | A finer trail packed into a shorter width | [SVG](studies/06E16-tucked-trail-light.svg) | [SVG](studies/06E16-tucked-trail-dark.svg) |

## What to compare

- **06E13 versus 06E14:** the same density and nominal particle sizes, with
  less versus more randomness. Their shared seed makes this a controlled pair.
- **06E14 versus 06E15:** more particles and a finer ending, with the same
  physical right boundary. The question is whether the finer tip reads shorter.
- **06E15 versus 06E16:** a finer tip at the original width versus one packed
  into a physically shorter trail.

06E12's middle arm ends at **x=46.319** on the 64×64 canvas. 06E13–06E15 use
that same right boundary; 06E16 ends at **x=44.3**. The optional **Show 06E12
tip** guide helps separate physical length from perceived length. The guide
appears only in the HTML's large previews, never in exported SVGs.

## Geometry and variation

All proposals copy the 24 top-arm and non-junction stem particles, plus the
four already-tapered junction particles, directly from 06E12. Only the trail
beyond those anchors is rebuilt. The resulting logos have 40 or 44 particles
in total, versus the reference's 36.

Particle sizes decrease toward the right, with a minimum 0.1-unit reduction
per step. Fixed seeds produce the same geometry in light and dark versions.

| Proposal | Size variation around targets | Gap weight variation | Maximum y scatter |
| --- | --- | --- | --- |
| 06E13 | ±3% | ±8% | ±0.28 units |
| 06E14 | ±14% | ±50% | ±0.85 units |
| 06E15 | ±16% | ±55% | ±0.95 units |
| 06E16 | ±9% | ±30% | ±0.55 units |

Size-order constraints can reduce individual proposals. Gaps are distributed
within the fixed width, with at least 0.3 units between adjacent trail pixels.
The finer studies deliberately allow smaller terminal particles than V6;
the 0.6-unit floor prevents arbitrarily tiny specks. This tests greater
disintegration while keeping the larger particles near the junction.

Y offsets are balanced across the middle-arm rows, including the unchanged
junction anchors, so each row keeps zero net vertical drift. Placement rejects
overlapping particles and keeps a 0.15-unit clearance.

All studies appear on light and dark backgrounds, with 16, 24, and 32 px
previews to assess how the fine tips hold up at small sizes.

## Regenerate

```sh
node docs/design/logo/V7/generate.mjs
```

The generator reads V6's 06E12 and V3's board styles. It writes this version's
HTML and ten SVGs. The HTML opens directly from disk without network requests.
Refresh `moodboard.png` after changes using a Chromium full-page screenshot
at a 1800 px viewport and 1× device scale, with the optional guide hidden.
