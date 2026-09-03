# Fullscreen Particle Hero Experiment

## Goal

Explore a fullscreen hero treatment where a local hero video fixture is
converted into particles by NyxFission and used as the visual background of
the hero section. The experiment lives on `experiment/fullscreen-hero`; the
deployed `main` design remains the rollback baseline.

## Experience

The hero keeps its existing copy, navigation, CTA, and content hierarchy. The
current right-side particle preview becomes a full-bleed particle canvas inside
the hero section. `hero0.mp4` is the initial source. The source is kept as one
obvious constant beside the existing media URLs so manually trying `hero1.mp4`
through `hero6.mp4` requires changing one line.

The layer order is:

1. Solid hero background fallback.
2. Fullscreen NyxFission particle canvas.
3. Dark tinted scrim for text contrast.
4. Existing hero copy and CTA.

The browser never displays the source video directly. NyxFission owns media
sampling, particle rendering, lifecycle, resizing, and cleanup through the
existing `createHeroPreviewLifecycle` integration.

## Layout And Responsive Behavior

The existing `.hero` becomes a positioned, clipped stage. The existing
`.hero-preview` wrapper is positioned absolutely at the hero bounds, and its
canvas fills that wrapper with a cover-like responsive aspect ratio. The copy
gets an explicit higher stacking order and remains readable across desktop and
mobile widths. The lower playground and all other sections remain unchanged.

The scrim uses the existing visual language rather than introducing a separate
decorative panel or glass effect. It must preserve enough particle contrast to
make the transformation visible while ensuring the text and CTA meet the
existing accessibility contrast target.

## Accessibility And Motion

The canvas remains decorative and is marked accordingly; all meaningful hero
information remains in the existing semantic text and link. The existing
lifecycle error handling remains in place so a failed hero media load cleans up
the instance without affecting the playground.

For `prefers-reduced-motion`, the decorative hero particle layer is reduced or
hidden and the solid fallback background remains visible. The rest of the demo,
including the interactive playground, remains usable.

## Source And Asset Constraints

The `hero*.mp4` files are intentionally ignored because they are large local
fixtures. This branch supports local comparison when those files are present in
the workspace. They are not added to Git, published to npm, or assumed to be
available in the GitHub Pages deployment.

## Validation

- Focused demo tests verify the hero uses `hero0.mp4`, still constructs a
  NyxFission video instance, and preserves lifecycle cleanup.
- `pnpm test:unit` passes.
- `pnpm lint` passes.
- `pnpm build:demo` passes.
- Manual browser review confirms the particle canvas fills the hero, copy and
  CTA remain legible, the existing sections are unchanged, and changing the
  source constant selects another local hero fixture.
