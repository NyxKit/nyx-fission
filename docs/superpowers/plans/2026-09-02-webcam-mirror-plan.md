# Webcam Input Mirroring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Horizontally mirror webcam frames before sampling them into particles while leaving image and URL-video sources unchanged.

**Architecture:** Pass an internal `mirror` boolean to `FrameSampler`, set only when `NyxFission` resolves `MediaType.Usermedia`. Wrap webcam `drawImage()` calls in a saved canvas transform (`translate(width, 0)` and `scale(-1, 1)`), then read pixels through the existing `getImageData()` path.

**Tech Stack:** TypeScript, Canvas 2D API, Vitest, Vite.

---

## File Map

- Modify `src/frame-sampler.ts`: accept the internal mirror option and transform webcam draws.
- Modify `src/nyx-fission.ts`: pass `type === MediaType.Usermedia` to the sampler.
- Modify `src/__tests__/frame-sampler.spec.ts`: test mirrored webcam drawing, unchanged non-webcam drawing, and restore-on-error behavior.
- Modify `src/__tests__/nyx-fission.spec.ts`: test the sampler receives mirroring only for usermedia.

## Task 1: Mirror Webcam Frames at the Sampling Boundary

**Files:**
- Modify: `src/frame-sampler.ts`
- Modify: `src/nyx-fission.ts`
- Test: `src/__tests__/frame-sampler.spec.ts`
- Test: `src/__tests__/nyx-fission.spec.ts`

- [ ] **Step 1: Write failing sampler tests**

Extend the mocked 2D context with `save`, `translate`, `scale`, and `restore` spies. Construct a usermedia source and a sampler with mirroring enabled. Assert the draw sequence is:

```ts
expect(context.save).toHaveBeenCalledOnce()
expect(context.translate).toHaveBeenCalledWith(2, 0)
expect(context.scale).toHaveBeenCalledWith(-1, 1)
expect(context.drawImage).toHaveBeenCalledWith(source.element, 0, 0, 2, 1)
expect(context.restore).toHaveBeenCalledOnce()
```

Keep the existing image sampler test as proof that the default/non-mirrored path calls only the direct `drawImage()` form. Add a video source test with mirroring disabled to confirm URL-video frames are not transformed.

Add a test where `drawImage` throws and assert `restore` is still called once before the error escapes.

- [ ] **Step 2: Run sampler tests and verify the expected red state**

Run:

```bash
pnpm vitest run src/__tests__/frame-sampler.spec.ts
```

Expected: FAIL because `FrameSampler` does not yet accept a mirror option or call the transform methods.

- [ ] **Step 3: Write failing orchestration tests**

Update the mocked `FrameSampler` constructor in `src/__tests__/nyx-fission.spec.ts` to record its source and mirror argument. Add tests that mount image, URL-video, and usermedia instances and assert:

```ts
expect(mocks.frameSampler).toHaveBeenCalledWith(expect.objectContaining({ kind: 'usermedia' }), true)
expect(mocks.frameSampler).toHaveBeenCalledWith(expect.objectContaining({ kind: 'video' }), false)
```

Use the existing media-loading harness and ensure the usermedia case resolves `MediaType.Usermedia` before construction.

- [ ] **Step 4: Run orchestration tests and verify the expected red state**

Run:

```bash
pnpm vitest run src/__tests__/nyx-fission.spec.ts
```

Expected: FAIL because `NyxFission` currently constructs `FrameSampler` without the mirror argument and the test mock does not record it.

- [ ] **Step 5: Implement source-specific mirroring**

In `src/frame-sampler.ts`, add a private readonly `mirror` field and accept `mirror = false` in the constructor. Keep all existing dimension and disposal behavior unchanged. In `sample()`, use the existing direct draw for `false`; for `true`, wrap only the draw call in `try/finally`:

```ts
if (!this.mirror) {
  this.context.drawImage(source, 0, 0, this.width, this.height)
} else {
  this.context.save()
  try {
    this.context.translate(this.width, 0)
    this.context.scale(-1, 1)
    this.context.drawImage(source, 0, 0, this.width, this.height)
  } finally {
    this.context.restore()
  }
}
```

Leave `getImageData(0, 0, width, height)` unchanged. In `src/nyx-fission.ts`, after resolving `type` and loading the source, construct the sampler as:

```ts
this.sampler = new FrameSampler(source, type === MediaType.Usermedia)
```

Import `MediaType` from the existing types import if needed. Do not add a public mirror option.

- [ ] **Step 6: Run focused tests and verify green**

Run:

```bash
pnpm vitest run src/__tests__/frame-sampler.spec.ts src/__tests__/nyx-fission.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/frame-sampler.ts src/nyx-fission.ts src/__tests__/frame-sampler.spec.ts src/__tests__/nyx-fission.spec.ts
git commit -m "feat: mirror webcam input before sampling"
```

## Task 2: Full Verification and Review

**Files:**
- Review: all files changed by Task 1
- Reference: `docs/superpowers/specs/2026-09-02-webcam-mirror-design.md`

- [ ] **Step 1: Run the complete verification suite**

Run:

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

Expected: all checks pass. The existing untracked `demo/public/fixtures/nyx-orbit.mp4` and the earlier untracked luma-key plan must remain untouched.

- [ ] **Step 2: Review the final diff against the design**

Confirm that only usermedia is mirrored, context state is restored on success and failure, image/video sampling is unchanged, no public API was added, and all downstream particle processing receives the mirrored `ImageData`.
