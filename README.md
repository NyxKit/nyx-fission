# NyxFission

NyxFission turns browser media into a GPU-rendered particle field. The library owns the render loop, media sampling, resize handling, and resource cleanup, so the integration stays small and framework-agnostic.

## Install

```sh
pnpm add nyx-fission three
```

`three` is a peer dependency because NyxFission uses it internally but does not expose Three.js objects in its public API.

## Quick start

```ts
import { MediaType, NyxFission, ThemeName } from 'nyx-fission'

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

## Events and lifecycle

Use `ready` as a promise or subscribe to lifecycle events. `on` and `off` use the same listener reference.

```ts
import { NyxEventName } from 'nyx-fission'

const onReady = () => console.log('particle field ready')
particles.on(NyxEventName.Ready, onReady)
particles.on(NyxEventName.Error, ({ error, stage }) => console.error(stage, error))
particles.off(NyxEventName.Ready, onReady)

await particles.ready
particles.destroy()
```

The event names are `loading`, `ready`, `error`, and `destroy`. A failed `ready` promise contains the same error reported by the `error` event.

## Supported inputs

- `image`: an image URL, including same-origin relative URLs.
- `video`: a video URL that the browser can load and sample.
- `usermedia`: an opt-in webcam stream, configured with `{ type: MediaType.Usermedia }`.

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

Open the printed local URL. The local SVG and WebM fixtures are deterministic and same-origin, so the image and video controls work without a third-party request. Use a same-origin video URL to test production behavior. The webcam button is opt-in and only works from `localhost` or HTTPS.

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
