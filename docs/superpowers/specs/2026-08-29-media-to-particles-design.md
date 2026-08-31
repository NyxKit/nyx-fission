# NyxFission Media-to-Particles MVP

## Goal

Create a browser-only, framework-agnostic TypeScript library that transforms
image, video, and webcam media into a GPU-rendered particle field. Consumers
should be able to construct one instance and mount it without managing an
animation loop, resize handling, media frame extraction, or particle cleanup.

The internal renderer will use Three.js, provided by the consumer as a peer
dependency. Three.js objects and implementation details are not part of the
stable public API.

## Public API

Explicit mounting:

```ts
import { MediaType, NyxFission, ThemeName } from 'nyx-fission'

const particles = new NyxFission({
  source: '/media/portrait.jpg',
  type: MediaType.Image,
  theme: ThemeName.Grayscale,
})

particles.mount(canvas)
```

Automatic mounting:

```ts
import { MediaType, NyxFission, ThemeName } from 'nyx-fission'

const particles = new NyxFission({
  source: '/media/loop.mp4',
  type: MediaType.Video,
  querySelector: '#canvas',
  theme: ThemeName.Nyx,
})
```

`querySelector` is passed to `document.querySelector`. The resolved element
must be an `HTMLCanvasElement`.

The instance exposes:

- `mount(canvas)` for explicit mounting.
- `ready: Promise<void>` for one-time initialization.
- `on(event, handler)` and `off(event, handler)` for lifecycle observation.
- `destroy()` for complete resource disposal.

The MVP does not expose consumer-controlled frame rendering, resize handling,
animation-loop control, or performance/optimization settings.

## Configuration

The initial configuration is intentionally small:

- `source`: a browser URL string for image or video media. It is omitted for
  `usermedia`.
- `type`: optional `image | video | usermedia`. Image/video type is inferred
  from the URL when omitted; explicit type overrides inference. `usermedia`
  must be explicit because it has no URL to inspect.
- `theme`: a named theme. Initial themes are `grayscale`, `discodip`,
  `pastel`, and `nyx`.
- `querySelector`: optional CSS selector for automatic mounting.
- `depth`: optional signed particle depth amplitude. It defaults to `0.35`;
  `0` produces a flat plane and negative values reverse the relief direction.

Detailed custom controls for particle colors, spacing, size, density, and
related appearance settings are deferred until the core renderer is proven.

## Mount Resolution

When `querySelector` is configured while the document is still loading, the
library:

1. Attempts to resolve the selector immediately.
2. Watches for the matching element if it is not present.
3. Performs a final lookup on `DOMContentLoaded`.
4. Reports a typed error if no valid canvas appears after that final lookup.

If the document is already ready, the library performs the initial lookup and
reports failure immediately when the target is absent or invalid.

An invalid selector or a selector resolving to a non-canvas element is an
error. Explicit `mount` validates the supplied canvas before initialization.

## Media URLs and Deployment

`source` is a browser URL, not a filesystem path. The library resolves it with:

```ts
new URL(source, document.baseURI).href
```

This makes relative URLs resolve against the consumer document rather than the
installed library bundle. Relative, root-relative, and absolute URLs are
supported. Localhost and deployed applications use the same rules as long as
the asset is served at the corresponding deployed URL. Consumers deploying
under a nested base path should use a base-aware relative URL or an absolute
URL; root-relative URLs intentionally resolve from the domain root.

Same-origin media is supported. Cross-origin image and video media is also
supported when the source server sends appropriate CORS headers. The media
element must be configured for cross-origin loading before its source is set;
canvas pixel reads that fail due to CORS produce a lifecycle error. Webcam
access follows browser permission and secure-context requirements, with
localhost accepted as a development secure context.

## Runtime Architecture

The implementation is split into focused internal responsibilities:

- **Target resolver**: resolves and validates the canvas, including late DOM
  insertion and `DOMContentLoaded` retry behavior.
- **Source loader**: resolves URLs, infers media types, configures CORS, loads
  image/video elements, and requests webcam access.
- **Frame sampler**: draws the current source frame to an internal offscreen
  canvas and extracts `ImageData`.
- **Particle field**: samples pixels into a stable grid and maps luminance and
  source color data to particle positions and colors.
- **Three runtime**: owns the renderer, scene, camera, geometry, shader
  material, animation loop, `ResizeObserver`, and disposal.
- **Lifecycle emitter**: provides `ready` and `on/off` event behavior with
  structured errors.

The particle grid is rebuilt when source dimensions or theme require it. Per
frame updates modify the existing particle data where possible. The library
owns all listeners, observers, media elements, WebGL resources, and animation
handles and releases them from `destroy()`.

## Themes

`grayscale`, `discodip`, and `pastel` carry the existing audio-visualiser
palette concepts. `nyx` uses four semantic Nyx particle color tokens: primary,
secondary, tertiary, and neutral.

The `nyx` theme reads corresponding CSS custom properties from the document so
consumer overrides are respected. If `nyx-kit` styles are not installed or a
token is unavailable, the library uses stable fallback values matching the
current Nyx palette. `nyx-kit` is not a required runtime dependency for
NyxFission.

## Lifecycle and Errors

`ready` resolves only after the canvas, source, and initial particle field are
valid. Lifecycle events cover initialization and runtime failures, including
loading, playback, webcam permission, CORS, invalid targets, rendering
context, and destruction.

Errors are typed and actionable. They must identify the failed stage and avoid
silently rendering an empty particle field. Event delivery must not prevent
resource cleanup.

## Testing and Demo

Tests will cover:

- URL resolution against localhost and nested production-like document bases.
- Image/video inference and explicit type overrides.
- Target resolution before and after DOM readiness.
- Theme token lookup and fallback behavior.
- Media loading, CORS, and webcam error mapping.
- Pixel sampling and particle field updates.
- Lifecycle events, resize handling, and complete disposal.

A browser demo will exercise explicit mounting, automatic `querySelector`
mounting, image/video sources, webcam input, all initial themes, and a nested
base-path deployment scenario.

## Out of Scope

- Framework-specific adapters.
- Non-browser renderers.
- Consumer-driven render loops or manual optimization controls.
- Existing `HTMLImageElement`, `HTMLVideoElement`, or `MediaStream` inputs.
- Arbitrary custom theme palettes and detailed particle appearance overrides.
- Audio-reactive behavior from the audio-visualiser project.

## Signed Particle Depth

Add an optional numeric `depth` configuration value. It represents the maximum
signed Z amplitude of the particle field, with an omitted value defaulting to a
subtle positive `0.35`:

```ts
z = luminance * depth
```

This gives the following contract:

- `depth: 0` produces a flat plane.
- Positive depth maps normalized luminance from `0` to positive depth.
- Negative depth maps normalized luminance from `0` to negative depth,
  reversing the relief direction.
- Non-finite values are rejected as `INVALID_CONFIG`.

The particle field stores normalized luminance as a GPU attribute, while the
runtime passes the configured depth to the vertex shader as an initialization
uniform. The shader applies `z = luminance * depth`, so image, video, and
webcam frames use identical displacement semantics without recalculating Z on
every CPU-side frame update. The runtime uses perspective framing to make Z
displacement visually apparent while preserving the existing aspect-fit
composition. Changing depth follows the existing instance lifecycle:
consumers destroy and recreate an instance rather than manually changing
renderer state or exposing a runtime depth setter.

The demo exposes a simple signed depth control and displays the active value in
its integration example. It does not expose render-loop or performance
controls. Tests cover default, zero, positive, negative, invalid, and dynamic
frame-update behavior, plus perspective framing.

## Follow-up Demo and Particle Refinements

The particle field uses an internal normalized-luminance update threshold of
`0.03`. During frame updates, a particle's luminance attribute changes only
when the absolute difference from its last accepted value meets or exceeds
that threshold. This suppresses small background noise from causing visible
depth jitter while preserving larger motion. The threshold is not part of the
public configuration and does not alter palette color updates.

The `nyx` palette contains four particle colors sourced in this order from
`--nyx-c-primary`, `--nyx-c-secondary`, `--nyx-c-tertiary`, and
`--nyx-c-neutral`, with stable package fallbacks for missing or invalid values.
Lifecycle status colors remain controlled by NyxKit and are unrelated to the
particle palette.

URL video sources in the demo and library start at time zero and use native
forward looping with autoplay enabled. Ping-pong playback is intentionally
deferred because it requires additional playback state and is not needed for
the initial automatic-loop behavior.

The interactive demo removes the mount-target selector control. It keeps one
direct mounting path, presents the live lifecycle state in the playground
heading as `<status> live`, and does not repeat a separate `LIVE OUTPUT` title.
