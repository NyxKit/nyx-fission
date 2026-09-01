# Luma Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fixed-at-construction GPU luma-key filtering for dark, light, and none modes while preserving stable particle buffers and dynamic luminance updates.

**Architecture:** Extend the public configuration with a string enum and validate the mode and normalized threshold synchronously in `NyxFission`, resolving omitted values to `none` and `0.1`. Pass those resolved values once to `ThreeRuntime`, expose them as shader uniforms, forward the existing luminance attribute through a vertex varying, and discard fragments according to the approved inclusive comparisons. No CPU filtering, buffer removal, runtime setters, chroma keying, or demo controls are introduced.

**Tech Stack:** TypeScript, Vitest, Three.js `ShaderMaterial`, GLSL raw shader imports, Vite.

---

### Task 1: Add public API and configuration tests

**Files:**
- Modify: `src/__tests__/public-types.spec.ts`
- Modify: `src/__tests__/nyx-fission.spec.ts`

- [ ] **Step 1: Write failing public enum and config tests**

Add `LumaKeyMode` to the public-types import and assert its runtime values. Add a typed config fixture using `lumaKey` and `lumaKeyThreshold`. In the orchestration suite, extend the mocked runtime instance shape to record mode and threshold, then add tests that omitted options resolve to `LumaKeyMode.None` and `0.1`, and explicit `Dark`/`Light` values reach the runtime unchanged.

- [ ] **Step 2: Write failing validation tests**

Add tests for unsupported luma modes and each threshold value `NaN`, positive infinity, negative infinity, `-0.01`, and `1.01`; each must throw an error matching `{ code: 'INVALID_CONFIG' }`. Add boundary acceptance coverage for thresholds `0`, `0.1`, and `1`.

- [ ] **Step 3: Run the focused tests and verify the expected red state**

Run: `pnpm vitest run src/__tests__/public-types.spec.ts src/__tests__/nyx-fission.spec.ts`

Expected: FAIL because `LumaKeyMode` and the new config behavior are not implemented.

### Task 2: Add failing runtime and shader tests

**Files:**
- Modify: `src/__tests__/runtime.spec.ts`

- [ ] **Step 1: Write failing uniform wiring coverage**

Import `LumaKeyMode`, construct `ThreeRuntime` with the new mode and threshold arguments, and assert `ShaderMaterial.uniforms` contains numeric mode values for none/dark/light and the exact threshold. Assert the existing luminance attribute remains present and in-place `setField()` updates still set its array and `needsUpdate`.

- [ ] **Step 2: Write failing shader behavior coverage**

Assert the vertex shader declares a luminance varying and assigns the luminance attribute to it. Assert the fragment shader declares the matching varying, declares luma-key uniforms, and contains the inclusive dark comparison `<= lumaKeyThreshold` and light comparison against `1.0 - lumaKeyThreshold` using `discard`.

- [ ] **Step 3: Write failing no-setter and dynamic stability coverage**

Assert the runtime instance has no public `setLumaKey`/`setLumaKeyThreshold` methods. Keep the existing attribute-update test as the regression proof that dynamic video/webcam luminance updates do not replace same-sized buffers.

- [ ] **Step 4: Run the focused runtime tests and verify the expected red state**

Run: `pnpm vitest run src/__tests__/runtime.spec.ts`

Expected: FAIL because the constructor signature, uniforms, and shader declarations are not implemented.

### Task 3: Implement public configuration normalization

**Files:**
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Modify: `src/nyx-fission.ts`
- Modify: `src/__tests__/nyx-fission.spec.ts`

- [ ] **Step 1: Add the enum and optional config fields**

Define and export:

```ts
export enum LumaKeyMode {
  None = 'none',
  Dark = 'dark',
  Light = 'light',
}
```

Add `lumaKey?: LumaKeyMode` and `lumaKeyThreshold?: number` to `NyxFissionConfig`, and re-export the enum from `src/index.ts`.

- [ ] **Step 2: Implement synchronous validation and resolved defaults**

Track `lumaKey` and `lumaKeyThreshold` as resolved private values. Validate mode with `Object.values(LumaKeyMode)` and validate threshold with `Number.isFinite(value) && value >= 0 && value <= 1`, throwing `NyxError` with code `INVALID_CONFIG` and sampling stage. Resolve omitted values to `LumaKeyMode.None` and `0.1` before asynchronous lifecycle work begins.

- [ ] **Step 3: Pass resolved values to runtime construction**

Extend the `ThreeRuntime` construction call to receive the resolved mode and threshold after depth, without changing dynamic `setField()` behavior.

- [ ] **Step 4: Run the focused API tests and verify green**

Run: `pnpm vitest run src/__tests__/public-types.spec.ts src/__tests__/nyx-fission.spec.ts`

Expected: PASS.

### Task 4: Implement GPU luma-key filtering

**Files:**
- Modify: `src/runtime.ts`
- Modify: `src/shaders/particles.vert.glsl`
- Modify: `src/shaders/particles.frag.glsl`

- [ ] **Step 1: Add fixed uniforms and numeric mode mapping**

Accept `LumaKeyMode` and threshold in `ThreeRuntime`, validate the threshold at the rendering boundary, and initialize `lumaKeyMode` as `0.0`, `1.0`, or `2.0` for none, dark, or light plus `lumaKeyThreshold` with the supplied value. Do not add mutation methods.

- [ ] **Step 2: Forward luminance from vertex to fragment**

Declare `varying float particleLuminance;` and assign it from the existing `luminance` attribute while retaining the current Z displacement expression unchanged.

- [ ] **Step 3: Apply inclusive fragment discards**

Declare the two uniforms and discard only when mode is dark and luminance is `<= lumaKeyThreshold`, or mode is light and luminance is `>= 1.0 - lumaKeyThreshold`. Keep the circular soft-alpha discard and color output intact.

- [ ] **Step 4: Run focused runtime tests and verify green**

Run: `pnpm vitest run src/__tests__/runtime.spec.ts`

Expected: PASS.

### Task 5: Review, verify, document, and commit implementation

**Files:**
- Review: `docs/superpowers/specs/2026-08-29-media-to-particles-design.md`
- Review: all changed source and test files

- [ ] **Step 1: Run the complete required verification**

Run each command exactly: `pnpm test:unit`, `pnpm type-check`, `pnpm lint`, `pnpm build`, `pnpm declarations`, `pnpm build:demo`, `pnpm test:demo`, `pnpm pack --dry-run`, `git diff --check`, `git status --short`.

- [ ] **Step 2: Review the diff against the design**

Confirm no CPU particle removal, geometry rebuilding for same-sized dynamic frames, runtime key setter, render-loop control, chroma key, or Vue runtime template strings were added. Confirm the mode and threshold are immutable after construction and the approved inclusive threshold semantics are represented in tests and shaders.

- [ ] **Step 3: Commit the focused implementation**

Run: `git add src/types.ts src/index.ts src/nyx-fission.ts src/runtime.ts src/shaders/particles.vert.glsl src/shaders/particles.frag.glsl src/__tests__/public-types.spec.ts src/__tests__/nyx-fission.spec.ts src/__tests__/runtime.spec.ts && git commit -m "feat: add GPU luma key filtering"`

- [ ] **Step 4: Confirm the worktree is clean**

Run: `git status --short`

Expected: no output.
