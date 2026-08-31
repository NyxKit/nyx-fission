# Particle and Demo Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce static-background depth jitter, align the Nyx palette with its four core colors, make demo video playback automatic, and simplify the playground UI.

**Architecture:** Keep jitter suppression inside `ParticleField.update()` by comparing each new normalized luminance against the last accepted value with an internal `0.03` threshold; palette colors still update every frame. Keep `nyx` resolution independent and limited to primary, secondary, tertiary, and neutral tokens. Enable native forward looping in URL video sources, and simplify the Vue demo without adding public runtime controls.

**Tech Stack:** TypeScript, Vitest, browser media APIs, Three.js, Vue 3, NyxKit, Vite.

---

## File Map

- Modify `src/particles.ts`: add the internal depth-update threshold to luminance writes.
- Modify `src/themes.ts`: replace six Nyx semantic colors with four core colors and matching fallbacks.
- Modify `src/media/source.ts`: configure URL videos to loop and restart from time zero.
- Modify `src/__tests__/particles.spec.ts`: test sub-threshold stability and threshold-crossing updates.
- Modify `src/__tests__/themes.spec.ts`: test the four-token Nyx palette and fallback behavior.
- Modify `src/__tests__/media-source.spec.ts`: test looping and initial playback position.
- Modify `demo/App.vue`: remove integration-type state/control, consolidate the live heading, and retain only useful playground controls.
- Modify `demo/main.spec.ts`: test the simplified demo structure and no duplicate live label.
- Modify `README.md`: remove references to interactive mount-mode testing if needed and document automatic demo video looping.

## Task 1: Stabilize Particle Depth Updates

**Files:**
- Modify: `src/particles.ts`
- Test: `src/__tests__/particles.spec.ts`

- [ ] **Step 1: Write the failing threshold tests**

Add a test using a one-particle frame whose initial luminance is `0.5`. Update
it with a value whose luminance delta is below `0.03` and assert that
`field.luminance[0]` remains `0.5`. Add a second update whose delta is exactly
`0.03` or greater and assert that the new luminance is accepted. Assert that
the color buffer still updates for the sub-threshold frame so the threshold
only stabilizes depth.

- [ ] **Step 2: Run the focused particle tests and verify failure**

Run: `pnpm vitest run src/__tests__/particles.spec.ts`

Expected: FAIL because every frame currently overwrites luminance regardless
of delta.

- [ ] **Step 3: Implement the minimal thresholded luminance update**

Define an internal constant:

```ts
const DEPTH_UPDATE_THRESHOLD = 0.03
```

For each sampled pixel, calculate the new luminance as today. Update the
luminance attribute only when
`Math.abs(newLuminance - this.luminance[index]) >= DEPTH_UPDATE_THRESHOLD`.
Keep palette selection and color writes based on `newLuminance` on every frame.
Do not add a public config option or change the shader/runtime API.

- [ ] **Step 4: Run particle tests and type-check**

Run: `pnpm vitest run src/__tests__/particles.spec.ts && pnpm type-check`

Expected: PASS.

- [ ] **Step 5: Commit the particle stability change**

```bash
git add src/particles.ts src/__tests__/particles.spec.ts
git commit -m "fix: stabilize particle depth updates"
```

## Task 2: Reduce the Nyx Particle Palette

**Files:**
- Modify: `src/themes.ts`
- Test: `src/__tests__/themes.spec.ts`

- [ ] **Step 1: Write failing four-token palette tests**

Change the Nyx CSS-token test to provide and expect exactly these names and
order:

```ts
const names = ['primary', 'secondary', 'tertiary', 'neutral']
```

Assert the resolved palette has exactly four colors. Add a fallback test for a
missing tertiary and invalid neutral token. Assert that the resolved Nyx theme
does not read or include `success`, `warning`, `danger`, or `info` values.

- [ ] **Step 2: Run the focused theme tests and verify failure**

Run: `pnpm vitest run src/__tests__/themes.spec.ts`

Expected: FAIL because the current resolver reads six status-oriented tokens.

- [ ] **Step 3: Implement the four-color Nyx resolver**

Set `nyxFallback` to four stable particle colors and set
`semanticNames` to `['primary', 'secondary', 'tertiary', 'neutral']`. Reuse the
existing parsing and fallback logic. Do not change NyxKit status themes or the
other three particle themes.

- [ ] **Step 4: Run theme tests and full type-check**

Run: `pnpm vitest run src/__tests__/themes.spec.ts && pnpm type-check`

Expected: PASS.

- [ ] **Step 5: Commit the palette change**

```bash
git add src/themes.ts src/__tests__/themes.spec.ts
git commit -m "feat: narrow Nyx particle palette"
```

## Task 3: Enable Automatic Forward Video Looping

**Files:**
- Modify: `src/media/source.ts`
- Test: `src/__tests__/media-source.spec.ts`

- [ ] **Step 1: Write failing URL-video playback tests**

Extend the mocked video element assertions to require `loop === true`,
`autoplay === true`, `muted === true`, and `currentTime === 0` before playback
starts. Trigger the existing `loadeddata` path and verify `play()` is called.
Keep webcam behavior unchanged except for its existing autoplay setup.

- [ ] **Step 2: Run media-source tests and verify failure**

Run: `pnpm vitest run src/__tests__/media-source.spec.ts`

Expected: FAIL because URL videos currently autoplay but do not set `loop` or
explicitly reset `currentTime`.

- [ ] **Step 3: Implement native forward looping from time zero**

In `loadUrlVideo`, set `element.loop = true` with the existing autoplay/muted/
inline configuration before assigning `src`. In `handleLoad`, set
`element.currentTime = 0` before awaiting `element.play()`. Do not add
ping-pong state or expose a playback option.

- [ ] **Step 4: Run media tests and type-check**

Run: `pnpm vitest run src/__tests__/media-source.spec.ts && pnpm type-check`

Expected: PASS.

- [ ] **Step 5: Commit automatic video looping**

```bash
git add src/media/source.ts src/__tests__/media-source.spec.ts
git commit -m "feat: loop demo videos automatically"
```

## Task 4: Simplify the Interactive Demo

**Files:**
- Modify: `demo/App.vue`
- Modify: `demo/main.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing demo structure tests**

Extend `demo/main.spec.ts` to assert that `App.vue` no longer contains
`MountChoice`, `mountChoice`, `mountOptions`, `mount-select`, or
`Integration shape`. Assert that the playground heading contains the live
status expression and that the separate `LIVE OUTPUT` label is absent. Keep
assertions for compiled SFC usage and the particle canvas.

- [ ] **Step 2: Run the demo structure test and verify failure**

Run: `pnpm vitest run demo/main.spec.ts`

Expected: FAIL because the demo currently exposes integration-shape state and
the repeated live labels.

- [ ] **Step 3: Remove integration-mode state and controls**

Remove the `MountChoice` enum, `mountChoice` ref, `mountOptions`, watcher
dependency, selector-specific config branch, and mount-target fieldset. Keep
explicit canvas mounting as the sole interactive path. Remove the now-unused
NyxKit select-labeling entry for `mount-select` while preserving theme select
accessibility.

- [ ] **Step 4: Consolidate the live status heading**

Change the playground section heading to show the current lifecycle status once,
such as `Live`, `Loading source`, or `Needs attention`, with the existing status
detail remaining in the sidebar’s live region. Do not append a duplicate `live`
label. Remove the separate `LIVE OUTPUT` stage-meta label while retaining
useful canvas sizing metadata.

- [ ] **Step 5: Update demo documentation and tests**

Remove README instructions that tell users to manually verify both mount modes
in the demo. State that the demo uses explicit mounting and that its local video
fixture loops automatically from the beginning. Keep library documentation for
the public `querySelector` API unchanged.

- [ ] **Step 6: Run demo tests and builds**

Run: `pnpm vitest run demo/main.spec.ts && pnpm build:demo && pnpm test:demo && pnpm type-check && pnpm lint`

Expected: PASS, with the compiled SFC, single explicit mount path, simplified
heading, and looping local video fixture intact.

- [ ] **Step 7: Commit demo simplification**

```bash
git add demo/App.vue demo/main.spec.ts README.md
git commit -m "docs: simplify particle playground controls"
```

## Task 5: Full Verification

**Files:**
- No source changes expected unless verification exposes a defect.

- [ ] **Step 1: Run the complete verification suite**

Run: `pnpm test:unit && pnpm type-check && pnpm lint && pnpm build && pnpm declarations && pnpm build:demo && pnpm test:demo && pnpm pack --dry-run`

Expected: all tests and checks pass, declarations remain framework-free, the
library bundle keeps Three.js external, and the package contains only intended
distribution files.

- [ ] **Step 2: Review final scope**

Confirm no public threshold, playback, palette-status, mount-mode, render-loop,
or performance controls were added. Confirm the browser-only scope and
compiled Vue SFC remain intact.

## Final Plan Review

- Spec coverage: thresholded depth updates, four-color Nyx palette, automatic
  forward video looping, integration-control removal, consolidated live title,
  tests, docs, and existing non-goals are mapped to Tasks 1-5.
- Placeholder scan: no `TODO`, `TBD`, vague implementation step, or undefined
  follow-up remains.
- Type consistency: the threshold remains internal, theme resolution remains
  `readonly Color[]`, URL-video looping stays inside `LoadedSource` creation,
  and demo state no longer contains mount-choice values.
