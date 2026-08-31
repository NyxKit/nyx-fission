# Signed Particle Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add finite signed particle depth with GPU-side luminance displacement, perspective framing, and a recreate-on-change demo control.

**Architecture:** Keep CPU particle positions limited to aspect-preserving XY coordinates and add a normalized luminance attribute. The Three.js vertex shader computes `z = luminance * depth` from that attribute and a construction-time uniform; `NyxFission` validates and normalizes depth, while `ThreeRuntime` frames the field with a perspective camera sized for the configured maximum displacement. No public runtime setter or render-loop control is added.

**Tech Stack:** TypeScript, Three.js, GLSL, Vitest, Vue 3, NyxKit components, Vite.

---

## File Map

- Modify `src/types.ts`: add optional `depth?: number` to `NyxFissionConfig`.
- Modify `src/nyx-fission.ts`: validate finite depth, apply the `0.35` default, and pass the resolved value into the runtime.
- Modify `src/particles.ts`: retain normalized luminance in a stable `Float32Array` and update it for every sampled frame; stop writing Z on the CPU.
- Modify `src/runtime.ts`: construct and update a perspective camera, expose no public depth mutation, and bind the luminance attribute plus depth uniform.
- Modify `src/shaders/particles.vert.glsl`: perform signed GPU-side Z displacement.
- Modify `src/__tests__/particles.spec.ts`: test luminance buffers and frame updates for default, zero, positive, and negative depth behavior at the field boundary.
- Modify `src/__tests__/runtime.spec.ts`: test perspective construction, displacement uniform/attribute wiring, and perspective resize framing.
- Modify `src/__tests__/nyx-fission.spec.ts`: test config validation/default propagation and dynamic video/webcam update paths.
- Modify `src/__tests__/public-types.spec.ts`: test the public depth property type.
- Modify `demo/App.vue`: add a signed `-1..1` depth control in `0.05` increments, recreate instances when it changes, and display the active value.
- Modify `demo/quickstart.ts`: include the active depth value in generated integration code.
- Create `demo/quickstart.spec.ts`: test generated image, video, and usermedia examples with active depth literals.
- Modify `README.md`: document signed depth, its default, and recreate-to-change behavior if the current API reference is present.

## Task 1: Add Public Depth Configuration and CPU Luminance Data

**Files:**
- Modify: `src/types.ts`
- Modify: `src/particles.ts`
- Modify: `src/nyx-fission.ts`
- Test: `src/__tests__/public-types.spec.ts`
- Test: `src/__tests__/particles.spec.ts`
- Test: `src/__tests__/nyx-fission.spec.ts`

- [ ] **Step 1: Write failing public-type and particle tests**

Extend the public type assertion with a finite numeric depth:

```ts
const config: NyxFissionConfig = { source: 'image.jpg', depth: -0.5 }
expect(config.depth).toBe(-0.5)
```

Update particle expectations so the field exposes a stable luminance buffer,
with values `[0, 1, 0.2126, 0.7152]` for the existing sampled pixels, while all
CPU Z coordinates remain zero. Add an update assertion that the same luminance
array object is retained and receives the new frame values.

- [ ] **Step 2: Run focused tests and verify the new expectations fail**

Run: `pnpm vitest run src/__tests__/public-types.spec.ts src/__tests__/particles.spec.ts`

Expected: FAIL because `depth` and the luminance attribute do not yet exist and
the existing implementation writes luminance directly into position Z.

- [ ] **Step 3: Implement the minimal public and particle changes**

Add `depth?: number` to `NyxFissionConfig`. Add `readonly luminance: Float32Array`
to `ParticleField`, allocate one value per sampled point, and set it during
both construction and `update()`. Keep XY positions unchanged and leave every
position Z at `0`. Keep palette selection based on the same normalized
luminance values.

- [ ] **Step 4: Add constructor validation/default tests**

Add tests that `new NyxFission({ source: 'image.jpg', depth: Number.NaN })`,
`Infinity`, and `-Infinity` throw `NyxError` with code `INVALID_CONFIG`. Add
coverage for `0`, positive, and negative finite values being accepted. Verify
omitted depth resolves to `0.35` through the mocked runtime constructor in the
orchestration test; do not expose a public getter or setter solely for testing.

- [ ] **Step 5: Implement depth normalization in orchestration**

Define `DEFAULT_DEPTH = 0.35`, reject any configured value for which
`!Number.isFinite(config.depth)`, and use `config.depth ?? DEFAULT_DEPTH` when
constructing `ThreeRuntime`. Do not reject negative or zero finite values and
do not add a runtime mutation API.

- [ ] **Step 6: Run the focused tests and type-check**

Run: `pnpm vitest run src/__tests__/public-types.spec.ts src/__tests__/particles.spec.ts src/__tests__/nyx-fission.spec.ts && pnpm type-check`

Expected: PASS.

- [ ] **Step 7: Commit the public depth and luminance data changes**

```bash
git add src/types.ts src/particles.ts src/nyx-fission.ts src/__tests__/public-types.spec.ts src/__tests__/particles.spec.ts src/__tests__/nyx-fission.spec.ts
git commit -m "feat: add signed particle depth configuration"
```

## Task 2: Move Depth Displacement Into the Perspective Runtime

**Files:**
- Modify: `src/shaders/particles.vert.glsl`
- Modify: `src/runtime.ts`
- Test: `src/__tests__/runtime.spec.ts`

- [ ] **Step 1: Write failing shader/runtime tests**

Extend the Three.js mock to include `PerspectiveCamera`. Construct
`ThreeRuntime(canvas, field, 0.35)` and assert that it creates a perspective
camera rather than an orthographic camera. Assert that the shader material
receives a `depth` uniform initialized to `0.35`, and that the geometry has a
`luminance` attribute with one scalar per point. Assert that the camera has a
finite field of view, aspect ratio matching the canvas, and a positive Z
position large enough to leave a safe gap beyond the maximum displacement.

Add a resize test that changes the canvas from `640x360` to `360x640` and
verifies the renderer size, camera aspect, and projection update. The test must
also verify that the framing remains based on the same XY field extents and
configured absolute depth rather than reverting to orthographic bounds.

- [ ] **Step 2: Run the runtime tests and verify they fail**

Run: `pnpm vitest run src/__tests__/runtime.spec.ts`

Expected: FAIL because the runtime currently constructs an
`OrthographicCamera`, has no luminance attribute, and has no depth uniform.

- [ ] **Step 3: Implement the vertex shader displacement**

Add `uniform float depth;` and `attribute float luminance;`. Compute the vertex
position before projection:

```glsl
vec3 displacedPosition = position;
displacedPosition.z = luminance * depth;
gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
```

Continue passing the color and point size exactly as before.

- [ ] **Step 4: Implement perspective camera framing and attribute wiring**

Change `ThreeRuntime` to accept `(canvas, initialField, depth, errorCallback?)`.
Use a fixed readable field of view of `50` degrees, and a camera distance
calculated from the existing normalized field half-height (`0.5`) and
`Math.abs(depth)`. Keep the camera at positive Z looking toward the origin.
Choose near/far planes from the camera distance and absolute depth so both
positive and negative displacement remain visible. On resize, update the
camera aspect and recompute framing without changing the field’s XY scale.

Create the `luminance` `Float32BufferAttribute` alongside position and color,
include its length in the same-buffer fast path, and copy its values with
`needsUpdate = true` on dynamic updates. Initialize the material uniforms with
`pointSize` and the construction-time `depth` value. Do not add `setDepth()`.

- [ ] **Step 5: Update orchestration runtime construction**

Pass the validated resolved depth from `NyxFission` into `new ThreeRuntime`.
Ensure both the first image frame and subsequent video/usermedia frame updates
reuse the same luminance attribute path.

- [ ] **Step 6: Run runtime/orchestration tests and type-check**

Run: `pnpm vitest run src/__tests__/runtime.spec.ts src/__tests__/nyx-fission.spec.ts && pnpm type-check`

Expected: PASS.

- [ ] **Step 7: Commit GPU displacement and perspective framing**

```bash
git add src/shaders/particles.vert.glsl src/runtime.ts src/nyx-fission.ts src/__tests__/runtime.spec.ts src/__tests__/nyx-fission.spec.ts
git commit -m "feat: render particles with perspective depth"
```

## Task 3: Verify Dynamic Media Updates and Demo Integration

**Files:**
- Modify: `src/__tests__/nyx-fission.spec.ts`
- Modify: `demo/App.vue`
- Modify: `demo/quickstart.ts`
- Create: `demo/quickstart.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add failing dynamic update coverage**

Extend the mocked video and webcam orchestration tests so a later sampled frame
changes luminance while retaining the same field and runtime instances. Verify
that the updated luminance buffer receives the new values for both source kinds;
the test should not expect CPU Z changes because displacement is now shader-side.

- [ ] **Step 2: Implement demo depth state and recreation**

Add `const depth = ref(0.35)` and a `NyxInput` numeric control with
`min="-1"`, `max="1"`, and `step="0.05"`. Include the active value in the
control label/status. Add `depth.value` to the generated `NyxFission` config and
to the existing recreation watcher so changing it destroys and rebuilds the
instance. Preserve the compiled `App.vue` SFC; do not introduce a runtime Vue
template string.

- [ ] **Step 3: Update generated integration example**

First create `demo/quickstart.spec.ts` with tests for image, video, and
usermedia output. Then change `buildQuickstart(source, sourceUrl)` to accept
`depth`, and generate a valid example containing the active literal:

```ts
const particles = new NyxFission({ type: MediaType.Image, source: "...", depth: 0.35 })
```

Update its callers and tests, including the usermedia form without a source.

- [ ] **Step 4: Document the public behavior**

Add a concise README section stating that depth defaults to `0.35`, accepts any
finite signed number, maps normalized luminance with `z = luminance * depth`,
uses `0` for a flat plane, and requires destroy/recreate to change. State that
render-loop and performance controls remain internal.

- [ ] **Step 5: Run focused tests and demo builds**

Run: `pnpm vitest run src/__tests__/nyx-fission.spec.ts && pnpm build:demo && pnpm test:demo`

Expected: PASS, with the compiled Vue demo producing the active depth in its
integration example and the smoke test succeeding.

- [ ] **Step 6: Commit demo and documentation changes**

```bash
git add demo/App.vue demo/quickstart.ts README.md src/__tests__/nyx-fission.spec.ts
git commit -m "docs: add signed depth demo control"
```

## Task 4: Full Verification and Package Checks

**Files:**
- No source changes expected unless verification exposes a defect.

- [ ] **Step 1: Run the complete unit suite**

Run: `pnpm test:unit`

Expected: all existing tests plus signed-depth tests pass.

- [ ] **Step 2: Run static checks and builds**

Run: `pnpm type-check && pnpm lint && pnpm build && pnpm declarations && pnpm build:demo`

Expected: all commands pass; the library bundle keeps Three.js external and
declarations expose `depth?: number` without exposing Three.js types.

- [ ] **Step 3: Run the package smoke check**

Run: `pnpm pack --dry-run`

Expected: the package contains the intended distribution files and no demo
source or test-only artifacts.

## Final Plan Review

- Spec coverage: finite validation, default `0.35`, zero/positive/negative
  semantics, GPU-side dynamic updates for image/video/usermedia, perspective
  framing, recreate-only lifecycle, demo control, generated example, tests, and
  non-goals are mapped to Tasks 1-4.
- Placeholder scan: no `TODO`, `TBD`, vague implementation step, or undefined
  follow-up remains.
- Type consistency: `depth` is a number in the public config, `luminance` is a
  scalar particle attribute, and `ThreeRuntime` receives the resolved depth
  exactly once at construction.
