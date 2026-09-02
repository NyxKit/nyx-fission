# Floating Hero Preview Refinement

## Goal

Refine the demo hero so the NyxFission particle example feels like a floating visual layer rather than a framed panel, while using dark luma-key filtering to produce a cleaner orbit silhouette.

## Visual Changes

- Remove the `LIVE / NYX-ORBIT.MP4` preview title.
- Remove the preview border and background.
- Remove the hero's section divider and the preview's column divider.
- Allow the transparent particle canvas to extend beyond its grid column and overlap the hero copy slightly through a negative inline margin and a modest downward offset.
- Reset the overlap on mobile so the canvas remains contained below the copy.
- Keep the existing headline, lede, CTA, and independent playground unchanged.

## Hero Renderer

Change only the hero instance configuration to:

```ts
new NyxFission({
  type: MediaType.Video,
  source: videoUrl,
  lumaKey: { mode: LumaKeyMode.Dark },
})
```

Threshold and coherence remain omitted so their library defaults apply. The playground continues to use its own user-selected luma configuration.

## Accessibility and Responsive Behavior

The hero canvas remains decorative and `aria-hidden`. The playground remains the accessible interactive demonstration. Existing reduced-motion behavior continues to omit the decorative hero renderer for users who request reduced motion. On narrow screens, the canvas returns to normal flow with no horizontal overlap.

## Testing

Update demo source assertions to verify that the hero uses `LumaKeyMode.Dark`, no longer includes the preview title, and retains no preview or hero divider styles. Preserve assertions for the hero lifecycle and interactive playground. Run the full unit, type, lint, build, demo, packaging, and diff checks.

## Scope Exclusions

This refinement does not change the playground, public API, particle renderer, video asset, reduced-motion policy, or hero lifecycle architecture.
