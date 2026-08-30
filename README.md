# NyxFission

NyxFission turns browser media into a GPU-rendered particle field. The library owns the render loop, media sampling, resize handling, and resource cleanup, so the integration stays small and framework-agnostic.

## Install

```sh
pnpm add nyx-fission three
```

`three` is a peer dependency because NyxFission uses it internally but does not expose Three.js objects in its public API.

## Quick start

```ts
import { NyxFission } from 'nyx-fission'

const particles = new NyxFission({
  source: './portrait.jpg',
  theme: 'nyx',
})

const target = document.querySelector<HTMLCanvasElement>('#nyx-canvas')
if (!target) throw new Error('Expected #nyx-canvas to exist')
particles.mount(target)
await particles.ready
```

An explicit canvas reference is also supported:

```ts
const canvas = document.querySelector<HTMLCanvasElement>('#nyx-canvas')
if (!canvas) throw new Error('Expected #nyx-canvas to exist')
const particles = new NyxFission({ source: './portrait.jpg' })
particles.mount(canvas)
```

The selector form mounts when the matching canvas appears:

```ts
const particles = new NyxFission({
  source: './portrait.jpg',
  querySelector: '#nyx-canvas',
})
```

`mount()` is single-use per instance. When replacing a source, theme, or target, call `destroy()` and create a new instance.

## Events and lifecycle

Use `ready` as a promise or subscribe to lifecycle events. `on` and `off` use the same listener reference.

```ts
const onReady = () => console.log('particle field ready')
particles.on('ready', onReady)
particles.on('error', ({ error, stage }) => console.error(stage, error))
particles.off('ready', onReady)

await particles.ready
particles.destroy()
```

The event names are `loading`, `ready`, `error`, and `destroy`. A failed `ready` promise contains the same error reported by the `error` event.

## Supported inputs

- `image`: an image URL, including same-origin relative URLs.
- `video`: a video URL that the browser can load and sample.
- `usermedia`: an opt-in webcam stream, configured with `{ type: 'usermedia' }`.

Available themes are `nyx`, `grayscale`, `discodip`, and `pastel`. The `nyx` theme reads Nyx semantic CSS colors when available and falls back to the package palette.

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

Open the printed local URL. The initial local SVG fixture is deterministic and same-origin. The video control uses a public demonstration URL and may fail where that host does not return CORS headers. Use a same-origin video URL to test production behavior. The webcam button is opt-in and only works from `localhost` or HTTPS.

To build the demo separately:

```sh
pnpm build:demo
```

The default `pnpm build` remains the library build. The demo supports keyboard navigation, visible focus, live status text, reduced decorative motion, and a mobile layout. There is no browser automation suite in this MVP; manually verify the image, video, webcam permission, four themes, both mount modes, destroy/recreate behavior, nested URL paths, and the copy button with `pnpm dev`.

## MVP non-goals

- No non-browser renderers.
- No custom appearance controls beyond the supported themes.
- No consumer-managed render loop or optimization controls.
- No framework adapter or Vue dependency in the library package.
