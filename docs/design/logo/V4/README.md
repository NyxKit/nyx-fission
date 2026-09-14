# V4 · E derivatives

[Open the moodboard](index.html) · [PNG overview](moodboard.png) · [V3](../V3/index.html)

| Study | Change | Light | Dark |
| --- | --- | --- | --- |
| 06E | Original E, copied exactly | [SVG](studies/06E-original-light.svg) | [SVG](studies/06E-original-dark.svg) |
| 06E1 | Less middle-arm fragmentation, contained inside the top arm's width | [SVG](studies/06E1-contained-light.svg) | [SVG](studies/06E1-contained-dark.svg) |
| 06E2 | Two halving layers with wider rightward spread and less downward drift | [SVG](studies/06E2-subtle-stem-light.svg) | [SVG](studies/06E2-subtle-stem-dark.svg) |

All studies have an identical intact top arm, matching light/dark geometry,
and the same 64×64 canvas. Both backgrounds include 16, 24, and 32 px previews.

06E1 shortens the middle-arm displacement to 45% of E's displacement and
retains more pixel weight. Two nearby fragments replace E's three. The top
arm ends at x=52.6; the compact middle arm, including detached pixels, ends at
x=50.9. This limit applies to the full pixel edges, not just their centers.

06E2 now uses a directional breakup, replacing the earlier tiny stem shifts:

- Two new columns sit to the right of the stem. At each height, their particle
  widths and heights are half and one quarter of the source edge particle.
- The source stem edge tapers from 5.2 units near the top to 3.6 at the bottom;
  the two added columns inherit that downward reduction. They resume below the
  arm junctions, where the arm itself occupies the space beside the stem.
- The middle arm tapers toward the right, with its lower row smaller than its
  upper row. Two additional rows beneath it are half and one quarter of that
  lower row's particle size.
- The added stem columns sit about 7 and 11 units to the right of the source
  edge, with less than one unit of downward drift. The middle arm's added rows
  move 3–7.1 units right and sit about 3.3–5.7 units below their source row,
  keeping the breakup shallower. Small deterministic offsets provide scatter.
  The top arm and left stem edge remain intact, and every particle stays inside
  the top arm's horizontal extent.

The `06E2-subtle-stem` filenames are retained so existing links keep working.

The optional **Show top-arm edge** checkbox adds a boundary guide only to the
large previews. Guides are not included in the downloadable SVGs.

## Regenerate

```sh
node docs/design/logo/V4/generate.mjs
```

The generator reads the earlier SVGs and board styles, and writes this board's
HTML and six transparent SVGs. It checks that the compact variants stay within
the top arm's right edge. Earlier moodboards and production assets are unchanged.

The HTML opens directly from disk without network access. `moodboard.png` is a
Chromium full-page screenshot at a 1500 px viewport and 1× device scale, with
the optional guides hidden. Refresh the screenshot after changing the studies.

Checked in Chromium at 1500 px and 390 px: all six background samples and
18 small previews load, with no page errors or horizontal overflow. The edge
guide toggle was checked in both states. SVG checks cover the unchanged top arm,
matching light/dark geometry, horizontal bounds, and the half-size progression.
