# NyxFission Media-to-Particles MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only, framework-agnostic `NyxFission` TypeScript library that turns image, video, and webcam media into a self-managed Three.js particle field.

**Architecture:** Keep the public class small and isolate target resolution, media loading, frame sampling, theme resolution, particle data, and Three.js lifecycle into focused modules. The library owns its renderer, animation loop, resize observer, media resources, and disposal; Three.js is a peer dependency and no Three.js types leak through the public API.

**Tech Stack:** TypeScript, Vite library mode, Three.js, Vitest, jsdom, browser APIs (`MutationObserver`, `ResizeObserver`, `HTMLCanvasElement`, `ImageData`, `getUserMedia`).

---

## File Map

Create the following focused files:

- `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`: package, build, type-check, lint, and test configuration.
- `src/index.ts`: package exports only.
- `src/types.ts`: public configuration, event, and error types.
- `src/errors.ts`: typed NyxFission errors.
- `src/events.ts`: small typed event emitter.
- `src/media/url.ts`, `src/media/type.ts`, `src/media/source.ts`: URL resolution, media type inference, and browser source loading.
- `src/target.ts`: explicit and selector-based canvas resolution.
- `src/frame-sampler.ts`: offscreen canvas frame extraction.
- `src/themes.ts`: named theme palettes, including CSS-token-backed `nyx`.
- `src/particles.ts`: pixel-grid particle data generation and updates.
- `src/runtime.ts`: internal Three.js scene, shaders, loop, resize, and disposal.
- `src/nyx-fission.ts`: public orchestration and lifecycle state.
- `src/shaders/particles.vert.glsl`, `src/shaders/particles.frag.glsl`: particle shaders.
- `src/__tests__/*.spec.ts`: unit tests for each boundary and public lifecycle behavior.
- `demo/index.html`, `demo/main.ts`, `demo/style.css`: browser integration demo.
- `README.md`: installation, API, URL/CORS, and demo usage.

## Task 1: Scaffold the Package

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`
- Create: `src/index.ts`
- Create: `src/types.ts`
- Test: `src/__tests__/public-api.spec.ts`

- [ ] **Step 1: Write the initial public API test**

```ts
import { describe, expect, it } from 'vitest'
import { NyxFission } from '../index'

describe('public package API', () => {
  it('exports NyxFission as a constructible class', () => {
    expect(typeof NyxFission).toBe('function')
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run src/__tests__/public-api.spec.ts`

Expected: FAIL because the package and export do not exist yet.

- [ ] **Step 3: Add package and TypeScript configuration**

Use an ESM package with these scripts and dependencies:

```json
{
  "name": "nyx-fission",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "run-p type-check build-only",
    "build-only": "vite build",
    "type-check": "tsc --noEmit",
    "test:unit": "vitest run",
    "test": "vitest",
    "lint": "eslint .",
    "dev": "vite --config vite.config.ts"
  },
  "peerDependencies": {
    "three": ">=0.171.0 <1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@typescript-eslint/parser": "^8.18.0",
    "eslint": "^9.14.0",
    "jsdom": "^25.0.1",
    "npm-run-all2": "^7.0.2",
    "three": "^0.171.0",
    "typescript": "~5.6.3",
    "vite": "^6.0.5",
    "vitest": "^2.1.8",
    "vite-plugin-glsl": "^1.3.1"
  }
}
```

Configure `tsconfig.json` for strict DOM TypeScript, `src` as the root, and
`dist` as the output. Configure `vite.config.ts` to use `vite-plugin-glsl`,
build library mode with `src/index.ts` as the entry, emit
`dist/nyx-fission.js`, and externalize `three`. In dev mode, use `demo` as the
Vite root; in build mode, retain library mode.

Add `eslint.config.js` using `@typescript-eslint/parser`, ignore `dist` and
`demo`, and enable parsing/type-syntax checks without requiring a framework
plugin.

- [ ] **Step 4: Define the public configuration types and export placeholder**

`src/types.ts` must define these exact public shapes:

```ts
export enum MediaType {
  Image = 'image',
  Video = 'video',
  Usermedia = 'usermedia',
}
export enum ThemeName {
  Grayscale = 'grayscale',
  Discodip = 'discodip',
  Pastel = 'pastel',
  Nyx = 'nyx',
}

export interface NyxFissionConfig {
  source?: string
  type?: MediaType
  theme?: ThemeName
  querySelector?: string
}

export enum NyxEventName {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
  Destroy = 'destroy',
}

export enum NyxErrorStage {
  Target = 'target',
  Source = 'source',
  Sampling = 'sampling',
  Rendering = 'rendering',
  Lifecycle = 'lifecycle',
}

export interface NyxErrorEvent {
  error: Error
  stage: NyxErrorStage
}

export type NyxEventMap = {
  [NyxEventName.Loading]: void
  [NyxEventName.Ready]: void
  [NyxEventName.Error]: NyxErrorEvent
  [NyxEventName.Destroy]: void
}
```

`src/index.ts` exports `NyxFission` and the public types only. The constructor
may be a placeholder until Task 7, but the export must compile.

- [ ] **Step 5: Run the focused test and type-check**

Run: `pnpm vitest run src/__tests__/public-api.spec.ts && pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit the scaffold**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts src
git commit -m "chore: scaffold NyxFission package"
```

## Task 2: Add Validation, Errors, and Events

**Files:**
- Create: `src/errors.ts`
- Create: `src/events.ts`
- Test: `src/__tests__/events.spec.ts`
- Test: `src/__tests__/errors.spec.ts`

- [ ] **Step 1: Write failing event and error tests**

Test that `NyxError` preserves `code`, `stage`, and `cause`, and that the
emitter supports multiple listeners, `off`, one-shot payload delivery, and
listener exceptions not stopping later listeners.

```ts
import { NyxErrorStage, NyxEventName } from '../types'

it('emits payloads and removes listeners', () => {
  const emitter = new NyxEventEmitter<NyxEventMap>()
  const listener = vi.fn()
  emitter.on(NyxEventName.Error, listener)
  emitter.emit(NyxEventName.Error, { error: new Error('cors'), stage: NyxErrorStage.Source })
  expect(listener).toHaveBeenCalledOnce()
  emitter.off(NyxEventName.Error, listener)
  emitter.emit(NyxEventName.Error, { error: new Error('again'), stage: NyxErrorStage.Source })
  expect(listener).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm vitest run src/__tests__/events.spec.ts src/__tests__/errors.spec.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the minimal typed emitter and error**

Implement `NyxEventEmitter<T extends Record<string, unknown>>` with
`on<K>(event, listener)`, `off<K>(event, listener)`, `emit<K>(event, payload)`,
and `clear()`. Use `Set` per event and catch listener exceptions so lifecycle
cleanup cannot be interrupted. Implement `NyxError` with the codes
`INVALID_CONFIG`, `INVALID_TARGET`, `TARGET_NOT_FOUND`, `MEDIA_LOAD_FAILED`,
`MEDIA_TYPE_UNKNOWN`, `MEDIA_CORS_FAILED`, `WEBCAM_PERMISSION_DENIED`,
`RENDERER_UNAVAILABLE`, and `DESTROYED`.

- [ ] **Step 4: Run tests and type-check**

Run: `pnpm vitest run src/__tests__/events.spec.ts src/__tests__/errors.spec.ts && pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the lifecycle primitives**

```bash
git add src/errors.ts src/events.ts src/__tests__/events.spec.ts src/__tests__/errors.spec.ts
git commit -m "feat: add typed lifecycle primitives"
```

## Task 3: Implement URL Resolution and Media Type Inference

**Files:**
- Create: `src/media/url.ts`
- Create: `src/media/type.ts`
- Test: `src/__tests__/media-url.spec.ts`
- Test: `src/__tests__/media-type.spec.ts`

- [ ] **Step 1: Write URL and inference tests**

Cover `document.baseURI` behavior:

```ts
import { MediaType } from '../types'

it('resolves relative source against the document base', () => {
  expect(resolveMediaUrl('./media/a.jpg', 'https://site.test/app/')).toBe(
    'https://site.test/app/media/a.jpg',
  )
})

it('infers formats case-insensitively and accepts query strings', () => {
  expect(inferMediaType('https://cdn.test/LOOP.MP4?cache=1')).toBe(MediaType.Video)
  expect(inferMediaType('/assets/photo.webp')).toBe(MediaType.Image)
})
```

Also test root-relative and absolute URLs, unsupported extensions, and explicit
type overrides at the caller boundary.

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm vitest run src/__tests__/media-url.spec.ts src/__tests__/media-type.spec.ts`

Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Implement URL and type helpers**

`resolveMediaUrl(source, base = document.baseURI)` must return
`new URL(source, base).href` and convert invalid input into `NyxError` with
`INVALID_CONFIG`. `inferMediaType(url)` must inspect the URL pathname and map
`jpg`, `jpeg`, `png`, `gif`, `webp`, `avif` to `image`; `mp4`, `webm`, `ogg`,
`mov`, `m4v` to `video`; and throw `MEDIA_TYPE_UNKNOWN` otherwise.

- [ ] **Step 4: Run tests and type-check**

Run: `pnpm vitest run src/__tests__/media-url.spec.ts src/__tests__/media-type.spec.ts && pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit URL behavior**

```bash
git add src/media/url.ts src/media/type.ts src/__tests__/media-url.spec.ts src/__tests__/media-type.spec.ts
git commit -m "feat: resolve media URLs and infer source types"
```

## Task 4: Implement Canvas Target Resolution

**Files:**
- Create: `src/target.ts`
- Test: `src/__tests__/target.spec.ts`

- [ ] **Step 1: Write failing target tests**

Cover explicit canvas validation, selector lookup, invalid selectors,
non-canvas results, late insertion before `DOMContentLoaded`, and final failure
after `DOMContentLoaded`.

```ts
it('resolves a canvas inserted before DOMContentLoaded', async () => {
  const promise = resolveCanvas({ querySelector: '#particles' })
  const canvas = document.createElement('canvas')
  canvas.id = 'particles'
  document.body.append(canvas)
  document.dispatchEvent(new Event('DOMContentLoaded'))
  await expect(promise).resolves.toBe(canvas)
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm vitest run src/__tests__/target.spec.ts`

Expected: FAIL because target resolution is not implemented.

- [ ] **Step 3: Implement the target resolver**

Implement `resolveCanvas(config, documentRef = document): TargetResolution`
and `validateCanvas(value)`, where `TargetResolution` is
`{ promise: Promise<HTMLCanvasElement>; cancel: () => void }`. With no selector,
the promise remains pending for the caller to use explicit `mount`; with a selector, resolve immediately when
possible. While `readyState === 'loading'`, use a `MutationObserver` and a
`DOMContentLoaded` listener. Resolve on the first valid match. On
`DOMContentLoaded`, make one final lookup, disconnect the observer, remove the
listener, and reject with `TARGET_NOT_FOUND` or `INVALID_TARGET`. Return
`cancel()` alongside the promise so `destroy()` can cancel pending observation
without leaving listeners or observers attached.

- [ ] **Step 4: Run tests and type-check**

Run: `pnpm vitest run src/__tests__/target.spec.ts && pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit target resolution**

```bash
git add src/target.ts src/__tests__/target.spec.ts
git commit -m "feat: resolve explicit and automatic canvas targets"
```

## Task 5: Implement Media Sources and Frame Sampling

**Files:**
- Create: `src/media/source.ts`
- Create: `src/frame-sampler.ts`
- Test: `src/__tests__/media-source.spec.ts`
- Test: `src/__tests__/frame-sampler.spec.ts`

- [ ] **Step 1: Write failing source and sampler tests**

Test image loading with `crossOrigin = 'anonymous'` set before `src`, video
event readiness, webcam `getUserMedia({ video: true, audio: false })`, cleanup
of tracks/elements, and conversion of load/permission failures into typed
errors. For the sampler, use a mocked 2D context and verify the source is
drawn to an offscreen canvas and `getImageData` is returned.

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm vitest run src/__tests__/media-source.spec.ts src/__tests__/frame-sampler.spec.ts`

Expected: FAIL because source loading and sampling are not implemented.

- [ ] **Step 3: Implement source loading**

Define an internal `LoadedSource` union containing `kind`, `element`,
`width`, `height`, `getFrameSource()`, and `dispose()`. For image/video URLs,
resolve against `document.baseURI`, set `crossOrigin = 'anonymous'` before
assigning `src`, and await `load`/`loadeddata`. For `usermedia`, create a video
element, request the webcam stream, assign it, and await metadata. Map media
events and rejected permissions to `NyxError`; retain a reference to every
element and stream for disposal.

- [ ] **Step 4: Implement the frame sampler**

Create one offscreen canvas per sampler, resize it to proportional working
dimensions capped at 720px on the dominant axis, draw the current frame with
`drawImage`, and return `getImageData(0, 0, width, height)`. Catch
`SecurityError` and map it to `MEDIA_CORS_FAILED`. Reuse the working canvas between frames. The standard
`getImageData()` API has no destination `ImageData` parameter, so a bounded
`ImageData` allocation per sampled dynamic frame is expected.

- [ ] **Step 5: Run tests and type-check**

Run: `pnpm vitest run src/__tests__/media-source.spec.ts src/__tests__/frame-sampler.spec.ts && pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit media handling**

```bash
git add src/media/source.ts src/frame-sampler.ts src/__tests__/media-source.spec.ts src/__tests__/frame-sampler.spec.ts
git commit -m "feat: load browser media and sample frames"
```

## Task 6: Implement Themes and Particle Data

**Files:**
- Create: `src/themes.ts`
- Create: `src/particles.ts`
- Test: `src/__tests__/themes.spec.ts`
- Test: `src/__tests__/particles.spec.ts`

- [ ] **Step 1: Write failing theme and particle tests**

Test all four theme names, grayscale output, deterministic palette selection
when supplied a seeded index, CSS custom-property lookup for `--nyx-c-primary`
and related semantic colors, and fallback values when computed CSS values are
empty. Test that a small `ImageData` produces one point per configured sample
grid location with centered X/Y coordinates and luminance-derived Z values.

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm vitest run src/__tests__/themes.spec.ts src/__tests__/particles.spec.ts`

Expected: FAIL because theme and particle modules do not exist.

- [ ] **Step 3: Implement theme resolution**

Define `resolveTheme(name, documentRef = document): readonly Color[]` and keep
colors as normalized RGB triples for Three.js attributes. Use the existing
audio-visualiser palettes for `grayscale`, `discodip`, and `pastel`. For `nyx`,
read semantic CSS variables in this order: primary, secondary, success,
warning, danger, info. Parse `#rgb`, `#rrggbb`, and `rgb()/rgba()` values;
fallback to the current Nyx literal values when a token is missing or invalid.

- [ ] **Step 4: Implement particle data generation and frame updates**

Define a `ParticleField` containing `positions`, `colors`, and a private pixel
index array. Sample a fixed initial step of three source pixels, center the
grid around the origin, preserve image aspect ratio, and update Z using source
luminance. Assign palette colors deterministically from the sampled luminance
bucket so a frame update does not cause random color flicker. Expose internal
`createParticleField(imageData, theme)` and `updateParticleField(field,
imageData)` functions only.

- [ ] **Step 5: Run tests and type-check**

Run: `pnpm vitest run src/__tests__/themes.spec.ts src/__tests__/particles.spec.ts && pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit themes and particle data**

```bash
git add src/themes.ts src/particles.ts src/__tests__/themes.spec.ts src/__tests__/particles.spec.ts
git commit -m "feat: generate themed media particle fields"
```

## Task 7: Implement the Internal Three.js Runtime

**Files:**
- Create: `src/shaders/particles.vert.glsl`
- Create: `src/shaders/particles.frag.glsl`
- Create: `src/runtime.ts`
- Test: `src/__tests__/runtime.spec.ts`

- [ ] **Step 1: Write failing runtime lifecycle tests**

Mock the Three.js renderer and verify construction creates a scene, orthographic
camera, `Points` geometry, shader material, and renderer attached to the target
canvas. Verify `start()` schedules frames, `ResizeObserver` updates renderer
size and camera bounds, and `dispose()` cancels the frame, disconnects the
observer, disposes geometry/material, and calls renderer disposal.

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm vitest run src/__tests__/runtime.spec.ts`

Expected: FAIL because the runtime does not exist.

- [ ] **Step 3: Add the particle shaders**

The vertex shader must accept `position`, `color`, `uniform float pointSize`,
pass color to the fragment shader, and set `gl_PointSize` and clip-space
position. The fragment shader must render a soft circular point using
`gl_PointCoord`, discard outside the circle, and output the interpolated color.

- [ ] **Step 4: Implement runtime ownership**

Implement `ThreeRuntime` with constructor `(canvas, initialField)`, `setField`,
`start(frameCallback)`, and `dispose`. Use `WebGLRenderer({ canvas,
alpha: true, antialias: true })`, an orthographic camera sized to the canvas,
`BufferGeometry`, `ShaderMaterial`, and `Points`. Use `requestAnimationFrame`
for the internal loop and `ResizeObserver` for the canvas content box. Convert
renderer/context construction failures to `RENDERER_UNAVAILABLE`.

- [ ] **Step 5: Run tests and type-check**

Run: `pnpm vitest run src/__tests__/runtime.spec.ts && pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit the renderer**

```bash
git add src/runtime.ts src/shaders src/__tests__/runtime.spec.ts
git commit -m "feat: add self-managed Three.js particle runtime"
```

## Task 8: Implement `NyxFission` Orchestration

**Files:**
- Create: `src/nyx-fission.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/nyx-fission.spec.ts`

- [ ] **Step 1: Write failing public lifecycle tests**

Cover explicit mount, automatic selector mount, `ready` resolution only after
source and first field are ready, loading and error events, type inference and
explicit override, duplicate mount rejection, and `destroy()` cleanup. Verify
that a destroyed instance rejects future mounting with `DESTROYED`.

```ts
it('resolves ready after explicit image mounting', async () => {
  const particles = new NyxFission({ source: './portrait.jpg' })
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  particles.mount(canvas)
  await expect(particles.ready).resolves.toBeUndefined()
  particles.destroy()
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm vitest run src/__tests__/nyx-fission.spec.ts`

Expected: FAIL because the public class is not implemented.

- [ ] **Step 3: Implement constructor and mount state**

Implement `NyxFission` with constructor validation, a permanently stored
`ready` promise, typed `on/off`, and internal states `created`, `loading`,
`ready`, `failed`, and `destroyed`. Emit `loading` before target/source work.
If `querySelector` is present, start target resolution immediately; otherwise
wait for `mount(canvas)`.

- [ ] **Step 4: Implement source-to-runtime initialization**

After target resolution, load the source, sample the first frame, resolve the
theme, create the particle field and `ThreeRuntime`, then start the internal
loop. Each animation frame samples the source and updates the existing field;
image sources may remain static while video and webcam sources update. Resolve
`ready` and emit `ready` only after the first renderable field exists.

- [ ] **Step 5: Implement errors and destruction**

Reject `ready` with the original `NyxError`, emit one structured `error`
event, and dispose every partially-created resource. `destroy()` must be
idempotent, cancel target observation, dispose the runtime/source/sampler,
clear listeners, and emit `destroy` exactly once.

- [ ] **Step 6: Run tests, type-check, and build**

Run: `pnpm vitest run src/__tests__/nyx-fission.spec.ts && pnpm tsc --noEmit && pnpm run build`

Expected: PASS, with a library bundle in `dist/` and no bundled Three.js copy.

- [ ] **Step 7: Commit the public API**

```bash
git add src/nyx-fission.ts src/index.ts src/__tests__/nyx-fission.spec.ts
git commit -m "feat: expose NyxFission media particle library"
```

## Task 9: Add the Browser Demo and Documentation

**Files:**
- Create: `demo/index.html`
- Create: `demo/main.ts`
- Create: `demo/style.css`
- Create: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add demo fixtures and controls**

Use a local image/video fixture or a clearly documented public media URL,
provide a canvas, buttons for explicit and `querySelector` mounting, a theme
selector for all four themes, a webcam action, and a lifecycle status region.
Do not add consumer render-loop or optimization controls.

- [ ] **Step 2: Add demo scripts and Vite configuration**

Add `demo` (`vite --mode demo --config vite.config.ts`), and configure Vite to
serve `demo/index.html` in demo mode while preserving library mode for the
default production build.
Ensure demo source URLs are relative to `document.baseURI` so a nested path
works in production-like hosting.

- [ ] **Step 3: Document installation and deployment behavior**

README must show peer dependency installation, both mount forms, `ready` and
`on/off`, supported media types/themes, URL resolution examples, same-origin
and CORS requirements, webcam secure-context requirements, `destroy()`, and
the MVP non-goals.

- [ ] **Step 4: Run the complete verification suite**

Run:

```bash
pnpm test:unit
pnpm type-check
pnpm build
pnpm lint
```

Expected: all tests, strict type-checking, build, and lint pass. Inspect the
bundle metadata to confirm Three.js remains external and manually verify the
demo in a browser for explicit mounting, selector mounting, image/video
updates, webcam permission behavior, resize, CORS error reporting, and nested
base-path URLs.

- [ ] **Step 5: Commit the demo and docs**

```bash
git add package.json demo README.md vite.config.ts
git commit -m "docs: add NyxFission demo and usage guide"
```

## Final Plan Review

- Spec coverage: browser-only scope, Three.js peer dependency, both mounting
  modes, selector timing, URL/base resolution, same-origin and CORS media,
  webcam, four themes including `nyx`, lifecycle promise/events, disposal,
  typed errors, tests, demo, and MVP exclusions are covered above.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, or unspecified
  validation steps remain.
- Type consistency: `NyxFissionConfig`, `MediaType`, `ThemeName`, event names,
  error stages, resolver signatures, and public methods are defined once and
  reused consistently across tasks.
