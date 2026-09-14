# V1 · Initial logo studies

Open [the moodboard](index.html) in a browser, or view the [rendered PNG overview](moodboard.png).
The HTML works directly from disk, with no server, build, or network requests.

The starting point was the original production logo:
36 blue/violet particles forming an F. A byte-for-byte snapshot lives in
[`reference/original.svg`](reference/original.svg).

## Studies

Each study appears on both a near-white violet ground and a charcoal violet
ground, with large artwork and actual 16, 24, and 32 CSS-pixel previews.
The SVG links below are transparent assets with inks tuned for the named ground.

| Study | Exploration | Light ink | Dark ink |
| --- | --- | --- | --- |
| 00 · The starting point | Original geometry, colors, and white outlines | [SVG](studies/00-original-light.svg) | [SVG](studies/00-original-dark.svg) |
| 01 · In formation | Regular spacing, equal radii, deliberate color rhythm | [SVG](studies/01-ordered-light.svg) | [SVG](studies/01-ordered-dark.svg) |
| 02 · Fewer, louder | 18 larger particles and a simpler silhouette | [SVG](studies/02-bold-light.svg) | [SVG](studies/02-bold-dark.svg) |
| 03 · Coming apart | An anchored stem with dispersing arms | [SVG](studies/03-release-light.svg) | [SVG](studies/03-release-dark.svg) |
| 04 · Almost liquid | Fused strokes with detached terminal dots | [SVG](studies/04-fused-light.svg) | [SVG](studies/04-fused-dark.svg) |
| 05 · The split second | A diagonal fracture through a solid F | [SVG](studies/05-fracture-light.svg) | [SVG](studies/05-fracture-dark.svg) |
| 06 · Before the particle | Rounded pixels on the original grid | [SVG](studies/06-pixels-light.svg) | [SVG](studies/06-pixels-dark.svg) |
| 07 · Held together | A sparse network of connected nodes | [SVG](studies/07-constellation-light.svg) | [SVG](studies/07-constellation-dark.svg) |
| 08 · Out of plane | Offset silhouettes and particle details | [SVG](studies/08-depth-light.svg) | [SVG](studies/08-depth-dark.svg) |
| 09 · One ink, many weights | Monochrome particles with tapering radii | [SVG](studies/09-mono-light.svg) | [SVG](studies/09-mono-dark.svg) |

Geometry stays identical within each pair. Studies 01–08 use darker blue/violet
inks on light backgrounds and lighter inks on dark backgrounds. Study 09 reverses
its monochrome ink. Study 00 preserves the original colors on both backgrounds,
including the dark blue particles that recede on charcoal.

## Direction notes

- **01** is the closest refinement of the existing identity.
- **02** retains the particle idea with fewer details to resolve at small sizes.
- **03** suggests the library's transformation and motion most directly.
- **04** has a strong small-size silhouette and a recognizable particle signature.
- **07** benefits from larger presentation; its fine connections become faint at 16 px.

**Final selection: 06 · Before the particle.** Its original geometry and palettes
are now used by the production logo and favicon. The other studies remain here
as exploration history.
The board uses neutral system typography to keep attention on the symbols;
wordmark design is a separate pass. The existing PRODUCT.md and original logo
provide the brand context. Running `$impeccable document` can capture a broader
DESIGN.md for future identity work.

## Regeneration

```sh
node docs/design/logo/V1/generate.mjs
```

This rebuilds the HTML and all 20 SVGs from the preserved original logo in
`reference/original.svg`. Edit the study definitions in `generate.mjs` before rebuilding;
direct changes to generated files will be overwritten.

`moodboard.png` is a Chromium full-page screenshot at a 1600 px viewport and 1×
device scale. After regenerating, refresh it using a browser full-page screenshot
at those settings. SVG colors use OKLCH, so render in a current browser.

Validation: Chromium at 1600 px and 390 px, 10 studies, 20 background samples,
all 60 small SVG previews loaded, no page errors or horizontal overflow.
