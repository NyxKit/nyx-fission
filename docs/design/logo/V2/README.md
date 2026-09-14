# Logo studies, V2

[Open the moodboard](index.html) · [PNG overview](moodboard.png) · [V1](../V1/index.html)

This version develops the two selected studies:

- **03:** bring the dispersing circles closer to the arms, keeping the F at the same scale.
- **06:** apply the dispersal of 03 to the rounded pixel grid, so the two arms break apart toward their tips.

The first row reproduces 03 and 06 exactly. Below it, the left column develops
circles and the right column develops pixels. All studies appear on light and
dark backgrounds, with 16, 24, and 32 px previews and downloadable SVGs.

| Study | Treatment |
| --- | --- |
| 03A · Close to home | Shortest travel, fuller tips, three nearby fragments |
| 03B · A shorter escape | Half the arm displacement, all five cloud particles retained |
| 03C · Only at the edges | Displacement restricted to the final columns |
| 03D · More body, less drift | Short travel with less reduction in particle size |
| 06A · Pixels, loosening | Gentle displacement and three nearby pixel fragments |
| 06B · Pixels in flight | Moderate displacement and the full five-pixel cloud |
| 06C · Pixels coming apart | Original 03 displacement and satellite positions, translated to pixels |
| 06D · A slight tumble | Moderate displacement with subtle rotation toward the tips |

**03B and 06B** are the most direct next steps from the selections. **03A and
06A** explore a quieter breakup. These are visual directions, not a final selection.

The stem and the 64×64 canvas stay fixed. For tighter studies, small satellites
retain a minimum gap from the arms as their travel shortens, so they do not
collapse into the main particles. The blue/violet palette and theme-specific
inks are inherited from V1. Geometry is identical across each light/dark pair.

## Regenerate

```sh
node docs/design/logo/V2/generate.mjs
```

The generator reads the first board's original-logo snapshot, selected SVGs,
and presentation styles. It writes this version's HTML and 20 transparent SVGs
in `studies/`; it does not modify the first moodboard.

The PNG is a Chromium full-page screenshot at a 1600 px viewport, 1× device
scale. Refresh it after changing the studies. The HTML works directly from disk
and uses no network resources. Render the OKLCH colors in a current browser.

Checked in Chromium at 1600 px and 390 px: 10 studies, 20 background samples,
all 60 small previews loaded, no page errors or horizontal overflow.
