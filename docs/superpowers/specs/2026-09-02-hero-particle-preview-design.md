# Hero Particle Preview Design

## Goal

Make the demo hero demonstrate the actual NyxFission effect immediately by replacing its decorative badge and vertical signal with an autoplaying particle preview of `nyx-orbit.mp4`.

## Hero Composition

Remove the `browser particle engine` badge and the vertical `GPU / MEDIA / FIELD` signal. Keep the existing headline, lede, and call-to-action link. Place a dedicated particle canvas on the right side of the hero with a restrained technical frame treatment and no controls or status text.

On narrow screens, stack the particle preview below the hero copy while preserving the existing compact spacing and responsive behavior.

The hero preview is decorative and non-interactive. The playground remains the only interactive source, theme, depth, and luma-key control surface.

## Rendering and Lifecycle

Create a second independent `NyxFission` instance for the hero using only:

```ts
new NyxFission({
  type: MediaType.Video,
  source: videoUrl,
})
```

Omit theme, depth, and luma-key settings so library defaults remain authoritative. Mount the instance after the hero canvas exists. Keep its refs and lifecycle separate from the playground instance so source changes and playground recreation cannot interrupt the hero preview.

Dispose the hero instance during component teardown and if initialization fails. A hero failure must not prevent the playground from loading; it may use the existing status mechanism for visibility without replacing successful playground state unnecessarily.

## Testing

Update demo source tests to assert:

- The badge text is absent.
- The vertical signal markup is absent.
- A hero canvas and dedicated hero instance are present.
- The hero config uses `MediaType.Video` and `videoUrl` without non-default config values.
- Hero initialization and teardown are wired.
- The existing playground canvas and controls remain present.

Run unit tests, type-check, lint, demo build, and demo smoke verification.

## Scope Exclusions

This change does not replace the playground renderer, add hero controls, add a public API option, alter particle rendering, change the video fixture, or introduce a separate video element.
