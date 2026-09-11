# Particle entrance animations

Status: implemented and verified on 2026-09-11 for version 1.1.0.
Branch: `feature/particle-entrance-animations`.

## Recommendation

Add an optional `entrance` configuration containing an animation enum, an
`autoStart` boolean, and timing options. Default to `None`, preserving immediate
display. With `autoStart: false`, prepare the media and keep the particle layer
hidden until the consumer calls `playEntrance()`.

Ship `None`, `Gather`, `Depth`, `Fade`, `Vortex`, `Scatter`, and four directional scans. Gather and
Depth deliver the two requested effects; the user expanded scope to include all
proposals and requested less predictable, individual particle motion for Depth.
Implement their motion
in the existing shaders, driven by the existing runtime animation loop. No new
animation dependency is needed.

This document records the approved API and implementation contract. Duration and
delay are nested properties of `entrance`, confirmed during approval. Delivery
includes the demo controls and a minor package version bump to `1.1.0`. The
playground uses NyxTabs with Basic (source/theme/depth), LumaKey, and Entrance
panels. Tab switches preserve settings and the particle instance. Use the installed
NyxTabs default appearance and behavior, as requested, without local tab overrides.

## Existing architecture and constraints

Verified against the source on 2026-09-11:

- `src/nyx-fission.ts` loads the source, samples a first frame, creates the runtime,
  starts its render loop, and then resolves `ready` and emits `NyxEvent.Ready`.
  The first WebGL draw happens later, in a `requestAnimationFrame` callback.
- `src/runtime.ts` owns one `Points` object, its shader material, the perspective
  camera, resize observer, and animation loop. The loop also runs for images;
  dynamic media sampling is throttled separately to approximately 30 Hz.
- `src/particles.ts` preserves a regular sample grid. Filtering discards fragments
  rather than removing particles, so particle identity remains stable between
  same-sized video frames. Changed frame dimensions rebuild the field.
- The vertex shader calculates the final position as
  `vec3(position.xy, luminance * depth)`. The camera sits on positive Z looking
  toward the origin: negative Z is farther away, positive Z is closer.
- Point size is currently fixed in screen pixels, with soft circular alpha.
  Sending particles farther away alone will not make their individual dots smaller.
- Camera clipping planes currently accommodate the final depth range. They do
  not accommodate a distant entrance origin automatically.
- Signed depth is supported up to magnitude `1_000_000`. The new feature must
  preserve that validation and normal final framing.

The nested configuration follows the existing `lumaKey` precedent. The current
package version is `1.0.0`; this is an additive API change.

## Public API

```ts
export enum EntranceAnimationType {
  None = 'none',
  Gather = 'gather',
  Depth = 'depth',
  Fade = 'fade',
  Vortex = 'vortex',
  ScanLeftToRight = 'scan-left-to-right',
  ScanRightToLeft = 'scan-right-to-left',
  ScanTopToBottom = 'scan-top-to-bottom',
  ScanBottomToTop = 'scan-bottom-to-top',
  Scatter = 'scatter',
}

export interface EntranceConfig {
  type?: EntranceAnimationType // default: None
  autoStart?: boolean // default: true
  duration?: number // milliseconds; default: 1000
  delay?: number // milliseconds; default: 0
}

// Addition to NyxFissionConfig:
// entrance?: EntranceConfig

// Addition to NyxFission:
// playEntrance(): Promise<void>
```

`autoStart` governs when the particle layer is revealed. It does not control media
loading, video playback, or webcam permission. An extra `hidden` boolean would
duplicate this decision and introduce contradictory combinations, so omit it.

| Type            | autoStart | Behavior after initialization                                 |
| --------------- | --------- | ------------------------------------------------------------- |
| None            | true      | Display normally, exactly as today                            |
| Animated preset | true      | Remain hidden for the delay, then animate automatically       |
| None            | false     | Remain hidden; `playEntrance()` reveals immediately           |
| Animated preset | false     | Remain hidden; `playEntrance()` starts the delay and entrance |

Duration and delay must be finite nonnegative numbers. Validate their sum is also
finite. Reject invalid enum values, nonboolean `autoStart`, null/nonobject config,
and invalid timings synchronously as `INVALID_CONFIG` at the rendering stage.
Resolve and copy the nested config during construction so later consumer mutation
cannot affect an instance.

`duration: 0` means reveal immediately after any configured delay. `None` ignores
both timings. Changing type or timing at runtime is outside the first version;
replay uses the instance's original configuration.

### Automatic entrance

```ts
import { EntranceAnimationType, MediaType, NyxFission } from 'nyx-fission'

const effect = new NyxFission({
  querySelector: '#particles',
  source: '/portrait.webp',
  type: MediaType.Image,
  entrance: {
    type: EntranceAnimationType.Gather,
    duration: 1200,
  },
})

await effect.ready // Media and renderer are prepared; entrance may still be running.
```

### Manual entrance

```ts
const effect = new NyxFission({
  source: '/portrait.webp',
  type: MediaType.Image,
  entrance: {
    type: EntranceAnimationType.Depth,
    autoStart: false,
    duration: 1400,
  },
})

effect.mount(canvas)
await effect.ready // The particle layer is still hidden.

// In a button handler, section-visibility callback, or application sequence:
await effect.playEntrance()
// Final particle output has now been submitted for rendering.
```

The library owns the entrance, while the consumer chooses the trigger. Automatic
on-load behavior does not imply waiting for viewport intersection.

## Lifecycle contract

Keep the existing instance lifecycle and `ready` meaning. Add a separate internal
entrance state: `hidden`, `scheduled`, `playing`, or `settled`.

```text
initialized + None/automatic --------------------------> settled
initialized + animated/automatic -> scheduled -> playing -> settled
initialized + manual -> hidden
hidden + playEntrance() ----------> scheduled -> playing -> settled
settled + playEntrance() ---------> scheduled -> playing -> settled
any state + failure/destroy ------> terminate and reject pending work
```

Zero-duration and `None` runs skip `playing`. The constructor must install the
initial visibility and progress state before any draw; hiding the canvas after
`ready` would permit a flash of the final image.

`playEntrance()` semantics:

1. Before readiness, queue one request and wait for initialization. It does not
   mount implicitly; without a selector or subsequent `mount()`, it waits just as
   `ready` does. This queued request also satisfies automatic startup, preventing
   two simultaneous runs.
2. During a scheduled or playing entrance, join the existing completion promise.
   Repeated calls do not restart the delay, stack animations, or create more loops.
3. After settlement, replay from the preset's starting state. The layer hides
   immediately while any delay runs. This intentional replay is not a smooth
   transition from its current output back to the starting position.
4. For `None`, reveal on the next available draw and resolve. If already visible,
   resolve without replaying or emitting entrance events.
5. Resolve after the final-state `renderer.render()` call succeeds, not when a
   timer merely expires. This indicates draw submission, not a guarantee that the
   browser has presented the pixels on screen.
6. On failure, reject with the existing structured error. On destruction, reject
   with `DESTROYED` at the lifecycle stage. Later calls return rejected promises.
   No completion event may follow disposal.

Automatic runs need an internally handled rejection even if nobody requests
their promise. Expected destruction must not generate an extra `Error` event.

### Observing automatic completion

Add `NyxEvent.EntranceStart` (`entrance-start`) and
`NyxEvent.EntranceComplete` (`entrance-complete`), with typed payloads:

```ts
export interface EntranceEvent {
  type: EntranceAnimationType
  animated: boolean
}
```

Emit Start when the reveal begins, after any delay, and Complete after the final
draw succeeds. Emit each once per run. `animated: false` covers reduced motion,
zero duration, and a manual reveal using `None`. These instant cases emit Start
then Complete in the same frame. The default automatic `None` path emits neither.

Preserve the ordering `Ready`, then `EntranceStart`, then `EntranceComplete`.
Register listeners before mounting or awaiting `ready`. Consumers who need a
promise for an automatic animated run can call `playEntrance()` while it is
pending to join it; calling after completion explicitly requests a replay.

Settle state and the active promise before dispatching Complete so a listener can
start a new run. After every callback, recheck disposal and the current run token:
listeners may destroy the instance or request replay. Test this reentrancy.

## Animation proposals

| Preset  | Appearance                                                    | Technique                                                                 |
| ------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Gather  | A surrounding cloud converges inward                          | Outward starting rays and deterministic staggering                        |
| Depth   | A distant compact cloud streams forward into the media        | Independent start times, durations, ease-out speeds, and curved XY paths  |
| Fade    | Media resolves gently in place                                | Final positions with animated alpha                                       |
| Vortex  | A rotating cloud unwinds into the image                       | Gather with decaying angular offsets and varied travel timing             |
| Scan    | A front assembles the image along the selected axis/direction | Column-based start times with small seeded jitter and short local reveals |
| Scatter | Loose 3D dust assembles into the media                        | Seeded XYZ starting positions, varied timing, and curved drift            |

Use a monotonic ease-out curve, initially quartic: `e = 1 - (1 - u)^4`.
Gather should feel quick to assemble and gently settle. Depth may need a slower
initial reveal to make the distant origin readable. Start visual review around
1000–1400 ms for Gather/Depth and 250–400 ms for Fade, using explicit durations in
the demo. These are tuning proposals, not benchmarked conclusions.

### Shared shader model

Keep the original particle buffers as targets. Every frame, compute:

```glsl
vec3 target = vec3(position.xy, luminance * depth);
float u = clamp((progress - stagger * seed) / (1.0 - stagger), 0.0, 1.0);
float eased = 1.0 - pow(1.0 - u, 4.0);
vec3 animatedPosition = mix(startPosition, target, eased);
```

`progress` is global normalized elapsed time after delay. `seed` is a stable
value in `[0, 1]` derived from the original grid coordinate, never current color,
luminance, or frame time. Use a cheap deterministic shader hash initially; add
one cached seed attribute only if visual or performance evidence warrants it.
Gather uses `stagger = 0.2`; Fade uses zero. Depth, Vortex, and Scatter use
independent seeded start times in the first 32% of the timeline, travel durations
of 38–68% of the total duration, and ease-out exponents of 2–5. The earliest and
latest particles therefore travel at different speeds, with every particle
settled by global progress 1. Scan uses a left-to-right start offset of up to 72%,
an additional seeded delay of up to 8%, and a 20% local travel time. All timing,
including staggering, stays within the configured duration.

At settlement, select the original shader path explicitly. Final positions,
opacity, point size, depth behavior, and filtering must match entrance `None`.
Do not leave an asymptotic easing tail that never reaches the target.

### Gather: outward to inward

For each particle, derive an outward XY direction from its target coordinate.
For the central zero-length vector, use a deterministic seeded direction to avoid
division by zero. Set the starting radius beyond the visible frustum at that
particle's starting Z, with a small seeded variation in radius. Start Z can equal
target Z for this first preset.

Compute a conservative radius from the viewport frustum's corner distance at the
farthest allowed target Z, with an approximately 15% margin, and at least the
field's half-diagonal. A simple `target.xy * 3` would leave center particles in
place and could already be visible in wide or tall canvases. The frustum-derived
radius gives a consistent outside-in entrance across aspect ratios.

Fade particles in over a short initial fraction of their local progress. Maintain
the original final point size. The result should assemble from around the canvas
without drawing a conspicuous bright ring at the edge.

### Depth: distant compact cloud to final field

Let `zMin = min(0, depth)` and choose positive travel distance `D`, initially
`max(2 * fieldDiagonal, camera.position.z)`. The farthest origin is
`vec3(0, 0, zMin - D)`. Give each particle a tiny seeded XY starting offset within
8% of the field radius and a Z starting offset of up to 20% of D toward the field.
This reads as a compact distant cloud, without coincident starting positions.

Interpolate toward each particle's latest target using its independent timing and
easing. Add an XY arc in a seeded direction, with magnitude
`sin(pi * eased) * fieldRadius * amplitude`, where amplitude varies from 0.35 to
0.9. Rotate that direction modestly along its route. The arcs vanish at each
particle's endpoint, breaking up the uniform expanding-image silhouette.

The origin is behind every target even with negative depth. Keep the camera
fixed. At zero local progress, render no fragments. Ramp alpha and point size
through early progress, and thin the initial cluster with a deterministic coverage
mask. These measures avoid an opaque dot from overlapping fixed-size particles.
Use normal blending, never additive blending, and inspect the early and final
frames in a real browser.

### Fade, Vortex, Scan, and Scatter

Fade retains final positions and multiplies soft-edge alpha by eased progress.
Vortex starts from Gather's outer cloud and rotates the interpolated XY position
through an individually seeded angle that decays to zero, producing an unwinding
spiral. Both use the original target Z without extra depth travel.

ScanLeftToRight and ScanRightToLeft normalize sample columns using the actual
field half-width. ScanTopToBottom and ScanBottomToTop normalize rows using the
actual half-height, accounting for positive Y pointing upward in world space.
Reverse variants invert the normalized coordinate. Each column or row has a
little seeded timing and XY positional jitter; the latter decays to zero.
These direction-based names replace the unreleased generic Scan preset, following
the user's request for both axes and their reversals.

Scatter starts particles throughout a bounded cloud: XY coordinates span the
viewport-based entrance radius, and Z ranges from `zMin - D` to `zMin`. Independent
timing and small curved XY drift create dust-like assembly. It shares Depth's
expanded far clipping bounds. Every preset uses the same manual/automatic,
replay, completion, reduced-motion, and dynamic-media contract.

## Runtime integration

Use a small internal entrance controller for resolved settings, run state,
elapsed time, and completion. `NyxFission` coordinates readiness, promises, and
events. `ThreeRuntime` advances the controller and sets uniforms before rendering,
then reports successful start/completion back through internal callbacks.

Three.js supports changing shader uniforms between frames without replacing
geometry. This is the appropriate mechanism for progress, type, opacity, and
travel bounds. [Three.js ShaderMaterial documentation](https://threejs.org/docs/pages/ShaderMaterial.html).

Implementation responsibilities:

- Initialize visibility before the first frame. Use `points.visible = false`
  while hidden or delayed; continue clearing the transparent canvas so a replay
  does not leave the old field visible. Restore visibility only for the reveal.
- Drive entrance timing from RAF timestamps independently of the 30 Hz sampler.
  Establish time zero on the first eligible frame so loading time never consumes
  animation duration. Do not add a separate interval, RAF loop, or animation library.
- Update only a small fixed set of uniforms for motion. Do not rewrite particle
  positions on the CPU each animation frame or rebuild geometry for replay.
- Preserve luma-key and coherence discards, then multiply the existing circular
  alpha by entrance opacity. Discard zero-alpha fragments rather than letting
  invisible points write depth. Review temporary `depthWrite: false` for entrance
  overlap; restore the normal material setting at settlement, and reject a visible
  end-of-animation seam during browser review.
- For Depth and Scatter, expand the far clip plane to include `cameraZ - originZ` plus a margin.
  Recompute it on resize. Preserve camera position, FOV, and the existing near
  plane; restore normal clipping once the entrance settles. Avoid large arbitrary
  clip distances, especially at extreme signed depth values.
- Shader displacement is absent from the CPU geometry bounds. Disable frustum
  culling for this single Points object while animating, restoring its prior
  setting afterward, or explicitly maintain conservative displaced bounds.
- Derive field bounds from the particle field, and viewport bounds from the
  canvas/camera. Do not assume media and canvas aspect ratios match.

### Video, webcam, resize, and visibility

While waiting for a manual trigger or delay, keep the first sample but skip
repeated dynamic sampling. Media playback and webcam capture retain their current
behavior. Refresh dynamic content immediately before the first visible entrance
frame, bypassing the sample throttle once. A manual entrance is not a promise to
reveal video timestamp zero or to defer camera permission.

While playing, continue sampling normally. Interpolate toward the latest target
Z/color/filter values. Do not snapshot a video frame and then jump to live media
on completion. Newly qualifying luma-key particles join at the current progress;
they do not each start their own entrance.

On resize or a changed sample grid, preserve elapsed progress and recompute field
and clipping bounds. New grid coordinates receive deterministic seeds. A layout
change may reposition particles; do not restart the entrance or promise pixel
continuity across a changed media aspect ratio.

Pause delay and entrance time while `document.hidden`; reset the timestamp baseline
on visibility return so the next frame resumes rather than fast-forwards. Browsers
commonly suspend RAF in background tabs, so elapsed-time subtraction alone is
insufficient. Remove the visibility listener on disposal. This policy does not
pause the source video. [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## Reduced motion

Respect `matchMedia('(prefers-reduced-motion: reduce)')` for automatic and manual
entrances. Reveal directly at the normal position, ignoring decorative delay and
duration. Keep manual instances hidden until triggered even under reduced motion.
An active run should settle on the next draw if the preference changes to reduce;
switching it off must not replay a completed entrance. Guard browser API access
and remove the change listener during cleanup.

The preference is intended to minimize nonessential movement. This proposal uses
an immediate reveal rather than forcing a replacement animation.
[MDN reduced-motion guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility).

## Alternatives and scope

- **Top-level animation enum plus manual boolean:** concise initially, but a nested
  `entrance` object groups timing and avoids confusing entrance with future idle
  or exit effects.
- **`trigger: 'load' | 'manual'`:** a reasonable alternative to `autoStart` if more
  built-in trigger modes are expected. For the two requested modes, the boolean is
  sufficient and familiar.
- **Separate `hide()`/`show()` API:** potentially useful for exits and repeatable
  viewport behavior, but unnecessary for the first manual reveal. Defer it.
- **CPU tweening of position arrays:** easy to prototype but adds buffer uploads
  and competes with dynamic sampling. Shader interpolation fits the existing renderer.
- **Physics simulation or custom user shaders:** unnecessary for deterministic
  preset entrances; substantially larger API and performance commitments.

Exclude exits, morphing between media sources, physics, scroll scrubbing, public
pause/seek controls, custom easing callbacks, per-run overrides, and runtime config
setters from the first implementation. Repeated play after settlement is supported.

## Delivery and acceptance

1. Add public types/exports and config resolution, then the lifecycle controller
   and promise/event contract. Implement the default and manual `None` paths first.
2. Add Fade to verify shader visibility and exact settlement; then Gather and
   Depth, Vortex, Scan, and Scatter, including camera bounds and overlap handling.
3. Add reduced motion, background timing, dynamic-media refresh, and lifecycle
   cleanup. Integrate demo controls for preset, automatic start, duration, and
   a Play/Replay button, with a clear “Ready, waiting to play” state.
4. Update README and copyable demo examples. Selecting a new preset recreates the
   demo instance, consistent with immutable library configuration. Keep the hero's
   configuration independent; choose its preset only after visual review.

Meaningful automated checks for implementation:

- Public enum/type exports, defaults, all four config combinations, invalid values,
  immutable config resolution, and default `None` behavior.
- No final-image flash before manual or delayed entrances; zero-duration/None
  handling; ready-before-start ordering and completion only after successful draw.
- Calls before readiness, concurrent calls, repeated automatic/manual requests,
  replay, reentrant listeners, destroy/failure at each phase, and promise cleanup.
- Timing across different RAF cadences, hidden-tab pause/resume, and reduced-motion
  preference changes without accidental automatic reveal of a manual instance.
- Dynamic sampling during play, forced refresh after waiting, unchanged progress
  across grid rebuilds, and no entrance-induced position uploads or geometry churn.
- Clipping calculations for both depth signs, zero depth, supported extremes, and
  portrait/landscape canvas and source combinations.

Browser acceptance must supplement mocked Three.js tests: inspect image, video,
and webcam output at start, midpoint, and completion; compare settled captures
with `None`; inspect Gather edges and Depth's initial overlap on desktop/mobile.
Confirm animated shaders compile, clipping remains stable, and resize does not
restart motion. Measure frame time during Depth's clustered start and compare
with the existing effect on the same device/media. Record results before claiming
a performance target.

For implementation, run the existing unit, type-check, lint, library build,
declaration, and demo checks. This proposal itself needs document/diff review,
not new executable tests.

## Implementation verification (2026-09-11)

- Full suite: 309 tests pass. After removing local NyxTabs overrides at the user's
  request, the 39 demo/application and generated-example tests pass again.
- Type checking, lint, demo formatting, library build, declaration generation,
  demo build/smoke, and package creation pass.
- Chromium/WebGL checks cover all nine animated presets at 640×360 and 300×500,
  with depth -0.35, 0, and 0.35. All 54 combinations remain empty before a manual
  trigger, animate, and finish pixel-identically to the corresponding None render.
- The four scans reveal the expected leading half of the canvas. Real NyxTabs,
  preset controls, delay/duration edits, retained settings, replay, and mobile
  preview scrolling pass browser checks, with no page or shader errors.
- Video and a browser-simulated webcam reveal successfully. Reduced motion keeps
  manual instances hidden until requested, then reveals instantly.
- The last-millisecond change averages less than 0.04 on a 0–255 RGBA channel
  scale across the test captures, including restoration of normal depth writing.
- A short Chromium software-WebGL timing sample at 640×360 had a median frame
  interval of about 16.7 ms for None, Depth, and Scatter. Early-frame outliers
  occurred for all three; this is a local comparison, not a hardware performance
  guarantee or a mobile GPU benchmark.

The demo keeps the installed NyxTabs appearance and behavior, without custom tab
CSS or focus overrides. Scan names are explicit directions rather than horizontal/
vertical plus reversed. The built package version is 1.1.0; publishing is separate.
