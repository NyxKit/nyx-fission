# Luma-Key Coherence Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in local neighborhood filtering for luma-key particles through a nested `lumaKey` configuration with configurable `threshold` and `coherence` values.

**Architecture:** Normalize the nested luma-key configuration synchronously in `NyxFission`, then pass resolved immutable settings into `ParticleField` and `ThreeRuntime`. `ParticleField` keeps stable positions and computes a per-particle 3x3 support score in a two-pass frame update; `ThreeRuntime` uploads that attribute in place and the shaders perform the final luma and coherence discards.

**Tech Stack:** TypeScript, Vitest, Three.js `ShaderMaterial`, GLSL raw shader imports, Vite, Vue demo.

---

## File Map

- Modify `src/types.ts`: replace the flat luma-key API with `LumaKeyMode` and nested configuration types.
- Modify `src/index.ts`: re-export `LumaKeyMode` and the nested configuration type.
- Modify `src/nyx-fission.ts`: validate and resolve nested luma-key settings, pass them to field creation/update and runtime construction.
- Modify `src/particles.ts`: maintain a stable support attribute and compute local support from the sampled luminance grid.
- Modify `src/runtime.ts`: upload the support attribute and pass coherence to the shader as an immutable uniform.
- Modify `src/shaders/particles.vert.glsl`: forward support from the vertex attribute to the fragment shader.
- Modify `src/shaders/particles.frag.glsl`: discard particles below the configured coherence threshold.
- Modify `src/__tests__/public-types.spec.ts`: assert the renamed enum and nested public configuration.
- Modify `src/__tests__/nyx-fission.spec.ts`: assert nested defaults, values, and validation at orchestration level.
- Modify `src/__tests__/particles.spec.ts`: cover support scoring, borders, isolated particles, dense regions, thin structures, and in-place updates.
- Modify `src/__tests__/runtime.spec.ts`: cover support attributes, coherence uniforms, and shader behavior.
- Modify `demo/quickstart.ts`: generate the nested API shape and use `LumaKeyMode`.
- Modify `demo/quickstart.spec.ts`: update generated examples and nested luma-key assertions.
- Modify `demo/App.vue`: update demo state, imports, config creation, watchers, and controls for the nested shape.
- Modify `demo/main.spec.ts`: update source assertions for the renamed enum and nested configuration.
- Modify `README.md`: document the nested luma-key API and coherence semantics.

## Task 1: Replace the Public Luma-Key Configuration

**Files:**
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/public-types.spec.ts`
- Test: `src/__tests__/nyx-fission.spec.ts`

- [ ] **Step 1: Write failing public API tests**

Replace imports and fixtures that use `LumaKey` with `LumaKeyMode`, and add a typed nested configuration:

```ts
const config: NyxFissionConfig = {
  source: 'image.jpg',
  depth: -0.5,
  lumaKey: {
    mode: LumaKeyMode.Dark,
    threshold: 0.1,
    coherence: 0.25,
  },
}

expect(config.lumaKey?.mode).toBe(LumaKeyMode.Dark)
expect(config.lumaKey?.threshold).toBe(0.1)
expect(config.lumaKey?.coherence).toBe(0.25)
```

Assert that the public enum values are `none`, `dark`, and `light`, and that `LumaKeyMode` is exported from `src/index.ts`.

- [ ] **Step 2: Add failing configuration normalization tests**

Extend the mocked runtime instance shape to record the nested resolved settings. Add tests for:

```ts
it('resolves omitted luma-key settings', async () => {
  const particles = new NyxFission({ source: './portrait.jpg' })
  // mount using the existing test harness and await particles.ready
  expect(mocks.runtimeInstances[0]).toMatchObject({
    lumaKey: { mode: LumaKeyMode.None, threshold: 0.1, coherence: 0 },
  })
})

it('passes explicit nested luma-key settings', async () => {
  const particles = new NyxFission({
    source: './portrait.jpg',
    lumaKey: { mode: LumaKeyMode.Light, threshold: 0.25, coherence: 0.4 },
  })
  // mount using the existing test harness and await particles.ready
  expect(mocks.runtimeInstances[0]).toMatchObject({
    lumaKey: { mode: LumaKeyMode.Light, threshold: 0.25, coherence: 0.4 },
  })
})
```

Add synchronous rejection coverage for an invalid mode, `NaN`, positive and negative infinity, `-0.01`, and `1.01` for both `threshold` and `coherence`. Add acceptance coverage for `0`, `0.1`, and `1`. Assert `{ code: 'INVALID_CONFIG', stage: 'sampling' }`.

Add a test proving the removed flat form is no longer accepted, for example by casting an old shape to `NyxFissionConfig` and asserting construction throws `INVALID_CONFIG`.

- [ ] **Step 3: Run focused tests and confirm the expected red state**

Run:

```bash
pnpm vitest run src/__tests__/public-types.spec.ts src/__tests__/nyx-fission.spec.ts
```

Expected: FAIL because the renamed enum, nested fields, and normalized runtime shape do not exist yet.

- [ ] **Step 4: Implement the type and normalization changes**

In `src/types.ts`, define:

```ts
export enum LumaKeyMode {
  None = 'none',
  Dark = 'dark',
  Light = 'light',
}

export interface LumaKeyConfig {
  mode: LumaKeyMode
  threshold?: number
  coherence?: number
}

export type ResolvedLumaKeyConfig = Required<LumaKeyConfig>

export interface NyxFissionConfig {
  // existing fields remain unchanged
  lumaKey?: LumaKeyConfig
}
```

In `src/nyx-fission.ts`, resolve one immutable `ResolvedLumaKeyConfig` object with mode `LumaKeyMode.None`, threshold `0.1`, and coherence `0` when `lumaKey` is omitted. Validate the nested mode and both numeric ranges before asynchronous lifecycle work begins. A flat `lumaKey` value must fail mode validation; do not retain or read the removed top-level `lumaKeyThreshold` property.

Re-export `LumaKeyMode` and `LumaKeyConfig` from `src/index.ts`.

- [ ] **Step 5: Run focused tests and confirm they pass**

Run:

```bash
pnpm vitest run src/__tests__/public-types.spec.ts src/__tests__/nyx-fission.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the public API change**

```bash
git add src/types.ts src/index.ts src/nyx-fission.ts src/__tests__/public-types.spec.ts src/__tests__/nyx-fission.spec.ts
git commit -m "feat: nest luma-key configuration"
```

## Task 2: Add CPU Local-Support Scoring

**Files:**
- Modify: `src/particles.ts`
- Test: `src/__tests__/particles.spec.ts`

- [ ] **Step 1: Add failing support-score tests**

Use a small 3x3 sampled image fixture and pass a resolved filter configuration to field creation. Assert individual support values with `toBeCloseTo`, for example:

```ts
expect(field.coherence[4]).toBeCloseTo(0)
expect(field.coherence[0]).toBeCloseTo(1)
expect(field.coherence[8]).toBeCloseTo(1)
```

Use separate fixtures for the isolated center, fully qualifying grid, and border cases so every expected value is unambiguous.

Cover these cases explicitly:

- A single qualifying center sample has support `0`.
- A fully qualifying 3x3 region has support `1` for every sample.
- A corner divides by its three available neighbors, not eight.
- Dark mode counts luminance strictly greater than `threshold`.
- Light mode counts luminance strictly less than `1 - threshold`.
- A thin qualifying line gets the expected support from its adjacent line samples.
- A dynamic update preserves the `coherence` array object and changes its values in place.
- `LumaKeyMode.None` or coherence `0` produces the disabled fast-path values without neighborhood filtering.

- [ ] **Step 2: Run particle tests and confirm the expected red state**

Run:

```bash
pnpm vitest run src/__tests__/particles.spec.ts
```

Expected: FAIL because `ParticleField` has no support attribute or filter-aware update path.

- [ ] **Step 3: Implement the filter-aware field state**

Add an internal resolved filter type used by particle creation and updates:

```ts
type ParticleFilter = {
  mode: LumaKeyMode
  threshold: number
  coherence: number
}
```

Add `readonly coherence: Float32Array` to `ParticleField`. Derive sampled grid width and height from the source dimensions and `SAMPLE_STEP`, matching the existing `x += SAMPLE_STEP` and `y += SAMPLE_STEP` loops. Preserve the existing `pixelIndices` and position order so the support index maps directly to the particle index.

Update the field in two passes:

1. Iterate the existing pixel indices, calculate raw luminance, apply the existing `DEPTH_UPDATE_THRESHOLD` stabilization, and update colors.
2. If the filter mode is `None` or filter coherence is `0`, fill support with the disabled value and return. Otherwise, for each qualifying particle, inspect row and column offsets `-1..1` except `(0, 0)`, skip out-of-bounds neighbors, and count neighbors passing the same mode/threshold predicate. Store the ratio of qualifying to available neighbors; store `0` for a particle that does not pass the luma key.

Use the stabilized `this.luminance` values in the second pass. Do not remove or reorder particles. Extend `createParticleField` and `updateParticleField` so the resolved filter is supplied by `NyxFission` and retained by the field for future frame updates.

- [ ] **Step 4: Run particle tests and confirm they pass**

Run:

```bash
pnpm vitest run src/__tests__/particles.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the CPU scoring change**

```bash
git add src/particles.ts src/__tests__/particles.spec.ts
git commit -m "feat: calculate luma-key particle coherence"
```

## Task 3: Wire Support Through Three.js and GLSL

**Files:**
- Modify: `src/runtime.ts`
- Modify: `src/shaders/particles.vert.glsl`
- Modify: `src/shaders/particles.frag.glsl`
- Test: `src/__tests__/runtime.spec.ts`

- [ ] **Step 1: Add failing runtime and shader tests**

Extend runtime test fields with `coherence`. Assert that `setField()` creates a `coherence` attribute and that same-sized updates reuse its array and set `needsUpdate`. Assert the uniform values for none, dark, and light modes plus exact threshold and coherence values.

Assert the shader source contains:

```glsl
attribute float coherence;
varying float particleCoherence;
uniform float lumaKeyCoherence;
```

and a strict discard condition equivalent to:

```glsl
if (lumaKeyCoherence > 0.0 && particleCoherence < lumaKeyCoherence) discard;
```

Assert luma-key discard occurs before coherence discard, and keep the existing circular alpha behavior. Assert no runtime luma setter is introduced.

- [ ] **Step 2: Run runtime tests and confirm the expected red state**

Run:

```bash
pnpm vitest run src/__tests__/runtime.spec.ts
```

Expected: FAIL because the runtime constructor, geometry attributes, uniforms, and shaders lack coherence support.

- [ ] **Step 3: Implement runtime attribute and uniform wiring**

Change `ThreeRuntime` to receive the resolved `ResolvedLumaKeyConfig`. Validate the values at the rendering boundary as well as in `NyxFission`. Add a `coherenceAttribute` beside the existing position, color, and luminance attributes and bind it under the geometry attribute name `coherence`. Include its length in the stable-buffer fast path, copy its values in place, and set `needsUpdate`.

Create a numeric `lumaKeyCoherence` uniform from the resolved value. Keep mode, threshold, and coherence immutable after construction.

- [ ] **Step 4: Implement shader forwarding and discard**

In the vertex shader, declare `attribute float coherence` and `varying float particleCoherence`, then assign `particleCoherence = coherence` without changing depth displacement. In the fragment shader, declare the matching varying and uniform and discard below the configured support threshold after the existing luma discard but before point-shape calculations.

- [ ] **Step 5: Run runtime tests and confirm they pass**

Run:

```bash
pnpm vitest run src/__tests__/runtime.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit GPU wiring**

```bash
git add src/runtime.ts src/shaders/particles.vert.glsl src/shaders/particles.frag.glsl src/__tests__/runtime.spec.ts
git commit -m "feat: render luma-key coherence filtering"
```

## Task 4: Connect the Orchestration and Demo API

**Files:**
- Modify: `src/nyx-fission.ts`
- Modify: `demo/quickstart.ts`
- Modify: `demo/quickstart.spec.ts`
- Modify: `demo/App.vue`
- Modify: `demo/main.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Pass the resolved filter through all field lifecycle paths**

Update `renderFirstFrame()` and the dimension-change branch in `renderFrame()` to call `createParticleField(frame, theme, resolvedFilter)`. Update the same-sized branch to call `updateParticleField(this.field, frame)` with the field-retained filter. Construct `ThreeRuntime` with the same resolved filter.

- [ ] **Step 2: Update quickstart generation tests first**

Change expected generated snippets from the old flat form to:

```ts
lumaKey: {
  mode: LumaKeyMode.Dark,
  threshold: 0.25,
  coherence: 0.1,
}
```

Add coverage for omitted luma configuration and explicit coherence values.

- [ ] **Step 3: Update quickstart generation and demo controls**

Change `demo/quickstart.ts` imports and generated code to use `LumaKeyMode` and the nested object. Keep the demo's current controls, adding coherence only where the existing luma controls are exposed. Ensure the generated example includes resolved threshold and coherence values.

In `demo/App.vue`, store the luma mode, threshold, and coherence as separate UI state values but construct one nested `lumaKey` object when creating `NyxFission`. Update watchers and quickstart generation to use that object shape. Preserve the default coherence of `0` so the demo does not visually change unless enabled.

- [ ] **Step 4: Update README and demo source assertions**

Document `LumaKeyMode`, nested `lumaKey.mode`, `lumaKey.threshold`, and `lumaKey.coherence`. State that coherence is a normalized local-support threshold, defaults to `0`, uses an adjacent 3x3 sampled-grid neighborhood, and is fixed at construction. Update `demo/main.spec.ts` assertions for the renamed enum and nested config.

- [ ] **Step 5: Run demo tests**

Run:

```bash
pnpm test:demo
```

Expected: PASS.

- [ ] **Step 6: Commit API consumers and documentation**

```bash
git add demo/quickstart.ts demo/quickstart.spec.ts demo/App.vue demo/main.spec.ts README.md src/nyx-fission.ts
git commit -m "docs: expose luma-key coherence configuration"
```

## Task 5: Full Verification and Review

**Files:**
- Review: all files changed by Tasks 1 through 4
- Reference: `docs/superpowers/specs/2026-09-02-luma-key-coherence-design.md`

- [ ] **Step 1: Run the complete verification suite**

Run each command exactly:

```bash
pnpm test:unit
pnpm type-check
pnpm lint
pnpm build
pnpm declarations
pnpm build:demo
pnpm test:demo
pnpm pack --dry-run
git diff --check
git status --short
```

Expected: all project checks pass. `git status --short` may continue to show the pre-existing untracked `demo/public/fixtures/nyx-orbit.mp4`; do not add or modify it as part of this feature.

- [ ] **Step 2: Review implementation against the approved design**

Confirm that:

- The public enum is `LumaKeyMode` and the configuration is nested.
- No old flat compatibility layer or top-level threshold remains.
- Defaults are `None`, `0.1`, and `0`.
- Support uses stabilized luminance, an adjacent 3x3 neighborhood, and border-aware denominators.
- `coherence: 0` bypasses neighborhood work.
- Particle buffers remain stable for same-sized dynamic frames.
- Luma discard remains inclusive and coherence discard remains strict.
- No connected-component, GPU texture, multi-scale, chroma-key, runtime-setter, or unrelated refactor was added.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git diff HEAD~4..HEAD --stat
git diff HEAD~4..HEAD --check
```

Review all feature commits and verify only intended files are included. If the number of implementation commits differs from four, use the actual base commit that precedes Task 1 rather than silently omitting a commit from review.

- [ ] **Step 4: Request code review before integration**

Use the repository's normal review process after all checks pass. Do not amend commits or add the unrelated MP4 to the feature.
