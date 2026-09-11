# NyxFission

NyxFission turns browser media into a GPU-rendered particle field. The library owns the render loop, media sampling, resize handling, and resource cleanup, so the integration stays small and framework-agnostic.

## Install

```sh
pnpm add nyx-fission three
```

`three` is a peer dependency because NyxFission uses it internally but does not expose Three.js objects in its public API.

## Quick start

```ts
import { LumaKeyMode, MediaType, NyxFission, ThemeName } from 'nyx-fission'

const particles = new NyxFission({
  source: './portrait.jpg',
  type: MediaType.Image,
  theme: ThemeName.Nyx,
})

const target = document.querySelector<HTMLCanvasElement>('#particles-canvas')
if (!target) throw new Error('Expected #particles-canvas to exist')
particles.mount(target)
await particles.ready
```

An explicit canvas reference is also supported:

```ts
const canvas = document.querySelector<HTMLCanvasElement>('#particles-canvas')
if (!canvas) throw new Error('Expected #particles-canvas to exist')
const particles = new NyxFission({ source: './portrait.jpg' })
particles.mount(canvas)
```

The selector form can observe late insertion while the document is still loading. It performs one final lookup at `DOMContentLoaded`; if the document is already ready and no matching canvas exists, it fails immediately:

```ts
const particles = new NyxFission({
  source: './portrait.jpg',
  querySelector: '#particles-canvas',
})
```

`mount()` is single-use per instance. When replacing a source, theme, or target, call `destroy()` and create a new instance.

### Particle depth

`depth` defaults to `0.35` and accepts finite signed values from `-1,000,000` through `1,000,000`. This internal magnitude bound keeps the value safely representable for the renderer's `Float32` data. Each particle's normalized luminance is mapped to depth with `z = luminance * depth`; positive depth moves it toward positive Z, negative depth reverses that direction, and `depth: 0` produces a flat plane. Depth is fixed when an instance is created, so destroy and recreate the instance to change it. The render loop and performance controls remain internal to NyxFission.

### Luma keying

`lumaKey` is optional. Omitting it disables luma-key filtering and defaults to `LumaKeyMode.None`. When provided, the nested object must include `mode`; use `LumaKeyMode.Dark` to discard particles at or below `threshold`, or `LumaKeyMode.Light` to discard particles at or above `1 - threshold`. `threshold` defaults to `0.1` and `coherence` to `0`:

```ts
new NyxFission({
  type: MediaType.Video,
  source: './field.webm',
  lumaKey: {
    mode: LumaKeyMode.Dark,
    threshold: 0.1,
    coherence: 0.1,
  },
})
```

Both normalized values accept finite numbers from `0` through `1`, inclusive. Luma-key comparisons are inclusive: dark filtering discards luminance `<= threshold`, and light filtering discards luminance `>= 1 - threshold`.

When `coherence` is greater than zero, a qualifying particle must have local support from the immediately adjacent samples in the sampled grid's fixed 3x3 neighborhood. Support is the number of qualifying neighbors divided by the number of available neighbors; image borders do not receive an artificial edge penalty. A particle is discarded when support is strictly less than `coherence`, so an exact match remains visible. `coherence: 0` disables neighborhood cleanup and preserves the existing behavior.

Luma-key settings are immutable after construction. Destroy and recreate the instance to change them. The old flat `lumaKey` enum value and top-level `lumaKeyThreshold` option are not supported.

### Entrance animations

New in `1.1.0`: configure how the particle field appears with the optional nested
`entrance` object. `None` is the default and preserves immediate display.

```ts
import { EntranceAnimationType, MediaType, NyxFission } from 'nyx-fission'

const particles = new NyxFission({
  source: './portrait.jpg',
  type: MediaType.Image,
  querySelector: '#particles-canvas',
  entrance: {
    type: EntranceAnimationType.Gather,
    autoStart: true,
    duration: 1200,
    delay: 200,
  },
})
```

| Property             | Default                      | Behavior                                                                |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| `entrance.type`      | `EntranceAnimationType.None` | Choose one of the presets below                                         |
| `entrance.autoStart` | `true`                       | Set `false` to keep the field hidden until `playEntrance()`             |
| `entrance.duration`  | `1000`                       | Total animation duration in milliseconds, including particle staggering |
| `entrance.delay`     | `0`                          | Hidden wait before the reveal, in milliseconds                          |

| Preset            | Effect                                                          |
| ----------------- | --------------------------------------------------------------- |
| `None`            | Immediate display                                               |
| `Gather`          | Particles converge from outside the canvas                      |
| `Depth`           | A distant compact cloud streams forward on varied, curved paths |
| `Fade`            | Particles reveal gently in place                                |
| `Vortex`          | An outer cloud spirals inward and unwinds into the image        |
| `ScanLeftToRight` | Assembles from the left edge toward the right                   |
| `ScanRightToLeft` | Assembles from the right edge toward the left                   |
| `ScanTopToBottom` | Assembles from the top edge downward                            |
| `ScanBottomToTop` | Assembles from the bottom edge upward                           |
| `Scatter`         | Loose 3D dust assembles with individual timing and drift        |

Depth, Vortex, and Scatter use deterministic variation in particle departure,
travel time, and speed. Replay repeats the same paths for the same sampled grid;
all presets settle into the normal particle output.

Timings must be finite nonnegative numbers with a finite sum. Zero duration
reveals immediately after the delay. `None` ignores both timings. Configuration
is copied at construction; recreate the instance to change it.

For a manual reveal, set `entrance.autoStart: false` at construction, then call:

```ts
await particles.ready // Media is prepared; a manual field stays hidden.
// In your button handler or section-visibility callback:
await particles.playEntrance()
```

Calls made before `ready` queue until initialization; they do not implicitly mount
the instance. Calls during a delay or entrance join the same completion promise.
After completion, another call replays the entrance from its starting state.
With `None`, a manual call reveals immediately; calls on an already visible field
do nothing. Completion means the final draw was submitted successfully. Loading
or rendering failure rejects the promise; destruction rejects with `DESTROYED`.

The library respects reduced motion by revealing instantly, while preserving the
manual trigger. Entrance time pauses in background tabs. Video playback and webcam
capture continue while waiting; the entrance reveals current media, not necessarily
video timestamp zero. Manual mode does not defer loading or webcam permission.

### Pointer interaction

Use `interaction` to respond to a pointer over the canvas. Omitting it preserves
the normal field with `NyxInteraction.None`.

```ts
import { NyxFission, NyxInteraction } from 'nyx-fission'

const particles = new NyxFission({
  source: './portrait.jpg',
  querySelector: '#particles-canvas',
  interaction: {
    type: NyxInteraction.Attract,
    radius: 100, // CSS pixels around the pointer
    strength: 1, // 0 = no displacement, 1 = full effect
    delay: 200, // ms to hold old displacements after pointer movement
    duration: 300, // ms to transition toward the effect and back to rest
  },
})
```

| Property | Default | Behavior |
| -------- | ------- | -------- |
| `interaction.type` | `NyxInteraction.None` | Select a pointer effect |
| `interaction.radius` | `100` | Affected screen radius, from `1` through `1000` CSS pixels |
| `interaction.strength` | `1` | Displacement amount, from `0` (none) through `1` (full effect) |
| `interaction.delay` | `0` | Hold displaced particles before returning after pointer movement or exit, in milliseconds |
| `interaction.duration` | `300` | Per-particle transition and return time, in milliseconds |

| Type | Effect |
| ---- | ------ |
| `None` | No pointer effect or pointer listeners |
| `Attract` | Draw nearby particles toward the pointer across the image |
| `Repel` | Move nearby particles away from the pointer across the image |
| `Push` | Move nearby particles away from the camera in depth |
| `Pull` | Move nearby particles toward the camera in depth |

`radius` describes an area, not a particle count or particle size. Its soft falloff
keeps the boundary smooth, and its screen measurement stays consistent across
canvas sizes, CSS scaling, device pixel ratios, and signed particle depths.
The number of affected particles depends on the visible field's density.
`strength` scales attraction/repulsion across the image and push/pull distance in
depth without changing the radius or timings. It accepts finite values from `0`
through `1`; `0` disables pointer displacement.
Repel uses its full radial displacement at `1`. Attract, Push, and Pull offer a
stronger upper range: `0.5` gives a moderate effect, and `1` doubles that
displacement. Attraction stops at the pointer; Push/Pull are bounded to keep
particles in front of the camera.

Timings accept finite nonnegative numbers with a finite sum. Each particle has its
own transition: newly affected particles move toward the effect over `duration`.
When the pointer moves away, the old particles hold their displacement for
`delay`, then return over `duration`, even while other particles respond to the
new pointer position. For example, `delay: 500, duration: 300` holds the old effect
for 500 ms, then returns those particles over 300 ms. This also applies when the
pointer leaves the canvas. Returning to a particle interrupts its return smoothly.
`duration: 0` makes transitions immediate but still preserves the return delay.
Mouse and pen hover are supported; touch starts on contact and ends
on release or cancellation. Native scrolling and gestures remain available.

Interaction is applied after the entrance completes, using the current pointer
state. Replaying an entrance temporarily suppresses it. With reduced motion,
pointer effects are disabled. Window blur and document visibility changes clear
the pointer state. Destruction removes all listeners. Settings are copied at
construction; destroy and recreate the instance to change them.

## Events and lifecycle

Use `ready` as a promise or subscribe to lifecycle events. `on` and `off` use the same listener reference.

```ts
import { NyxEvent } from 'nyx-fission'

const onReady = () => console.log('particle field ready')
particles.on(NyxEvent.Ready, onReady)
particles.on(NyxEvent.Error, ({ error, stage }) => console.error(stage, error))
particles.off(NyxEvent.Ready, onReady)

await particles.ready
particles.destroy()
```

The event names are `loading`, `ready`, `entrance-start`, `entrance-complete`,
`error`, and `destroy`. A failed `ready` promise contains the same error reported
by the `error` event. `ready` means media and renderer preparation, not entrance
completion. Subscribe before mounting to observe automatic entrance completion:

```ts
particles.on(NyxEvent.EntranceStart, ({ type, animated }) => {
  console.log('entrance started', type, animated)
})
particles.on(NyxEvent.EntranceComplete, ({ type, animated }) => {
  console.log('entrance complete', type, animated)
})
```

These events occur after `Ready`, once each per reveal or replay. `animated` is
false for instant reveals (including reduced motion). The default automatic `None`
path emits neither entrance event. A failed or destroyed run never emits Complete.

## Supported inputs

- `image`: an image URL, including same-origin relative URLs.
- `video`: a video URL that the browser can load and sample.
- `usermedia`: an opt-in webcam stream, configured with `{ type: MediaType.Usermedia }`.

Available themes are `nyx`, `grayscale`, `discodip`, and `pastel`. The `nyx` theme reads the `primary`, `secondary`, `tertiary`, and `neutral` Nyx CSS color tokens, with each token independently falling back to the package palette when it is missing or invalid in a consumer stylesheet.

Relative URLs resolve against `document.baseURI`, not the JavaScript bundle URL. This keeps sources correct when the application is hosted under a base path or nested deployment URL.

## Browser requirements

The browser must be allowed to load and read the media. Same-origin files are the simplest option. Cross-origin images and videos need a CORS response header such as `Access-Control-Allow-Origin`; setting an element's `crossOrigin` attribute alone cannot fix a server that does not opt in. A blocked or tainted source emits an `error` event.

Webcam access requires a secure context, HTTPS or `localhost`, and explicit user permission. NyxFission never requests a camera until a `usermedia` instance is created. The stream stays in the browser and is stopped by `destroy()`.

## Demo

The demo is a Vue-based showcase only. Vue and NyxKit are dev dependencies and are not part of NyxFission's runtime or public API.

```sh
pnpm install
pnpm dev
```

Open the printed local URL. The demo uses explicit canvas mounting, and its deterministic same-origin WebM fixture loops automatically from the beginning. The local SVG and video controls work without a third-party request. Use a same-origin video URL to test production behavior. The webcam button is opt-in and only works from `localhost` or HTTPS.

The playground uses Basic, LumaKey, Entrance, and Interaction tabs. Switching tabs preserves
configuration and playback. Entrance controls select a preset, automatic or manual start, duration, and
delay. Play/Replay reuses the current media instance. Configuration edits recreate
the playground and update the copyable example; the decorative hero stays independent.
Interaction controls select the pointer effect, radius, strength, delay, and duration.

To build the demo separately:

```sh
pnpm build:demo
```

The default `pnpm build` remains the library build. The demo supports keyboard navigation, visible focus, live status text, reduced decorative motion, and a mobile layout. There is no browser automation suite in this MVP; manually verify the image, video, webcam permission, four themes, destroy/recreate behavior, nested URL paths, and the copy button with `pnpm dev`.

## MVP non-goals

- No non-browser renderers.
- No custom appearance controls beyond the supported themes.
- No consumer-managed render loop or optimization controls.
- No framework adapter or Vue dependency in the library package.
