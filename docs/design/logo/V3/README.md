# V3 · Pixel comparison

[Open the moodboard](index.html) · [PNG overview](moodboard.png) · [V2](../V2/index.html)

Five options at the same scale, each on light and dark backgrounds, with
16, 24, and 32 px previews and editable SVGs.

| Study | Treatment | Light | Dark |
| --- | --- | --- | --- |
| 06 | Original intact pixel grid | [SVG](studies/06-pixels-light.svg) | [SVG](studies/06-pixels-dark.svg) |
| 06A | Subtle release on both arms | [SVG](studies/06A-close-pixels-light.svg) | [SVG](studies/06A-close-pixels-dark.svg) |
| 06B | Balanced release on both arms | [SVG](studies/06B-balanced-pixels-light.svg) | [SVG](studies/06B-balanced-pixels-dark.svg) |
| 06C | Full release on both arms | [SVG](studies/06C-open-pixels-light.svg) | [SVG](studies/06C-open-pixels-dark.svg) |
| 06E · New | Intact top arm; only the middle arm fragments | [SVG](studies/06E-middle-only-light.svg) | [SVG](studies/06E-middle-only-dark.svg) |

06E combines the original 06 top arm and stem with the middle arm and three
nearby fragments from 06B. Both pixel rows making up the top arm remain intact;
there are no detached pixels around that arm. 06E follows 06D because 06D already
identifies the rotating-pixel experiment in V2.

The existing four studies are copied byte-for-byte. SVGs are transparent with
inks tuned for the named background. This is the V3 comparison board, not a
declaration that one logo has been selected for production.

## Regenerate

```sh
node docs/design/logo/V3/generate.mjs
```

The generator reads existing SVGs and the first board's presentation styles.
It writes this board's HTML and 10 SVGs without modifying the earlier boards.
The HTML works directly from disk without a server or network access.

`moodboard.png` is a Chromium full-page screenshot at a 1800 px viewport and
1× device scale. Refresh the screenshot after regenerating changed studies.

Validated in Chromium at 1800 px and 390 px: five studies, ten background
samples, all 30 small previews loaded, no page errors or horizontal overflow.
06E's top-arm shapes match 06 exactly; its middle-arm shapes match 06B exactly.
