# Fullscreen Particle Hero Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing hero's NyxFission video preview into a full-bleed particle background using `hero0.mp4`, while preserving the current design on `main`.

**Architecture:** Keep the existing `createHeroPreviewLifecycle` integration and error cleanup, changing only its source URL and presentation target styling. The hero becomes a clipped, positioned stage with the particle canvas behind the existing copy and a scrim between them; the local fixture source remains a single constant for manual cycling.

**Tech Stack:** Vue 3 SFC, TypeScript, CSS, Vitest, Vite, NyxFission.

---

### Task 1: Add focused regression expectations

**Files:**
- Modify: `demo/main.spec.ts:18-50, 113-146`

- [ ] **Step 1: Update the hero behavior test to require the new source and preserve NyxFission configuration**

In the existing `keeps the hero preview independent with dark luma filtering` test, keep the lifecycle and luma assertions and add these exact expectations after the existing `heroInstance` assertion:

```ts
expect(app).toContain("const heroVideoUrl = new URL('./fixtures/hero0.mp4', document.baseURI).href")
expect(app).toContain('source: heroVideoUrl')
```

Replace the old expectation that checks the previous hero-specific absence with the new source-specific assertion. Keep the existing `hero-canvas`, `heroCanvas`, `heroInstance`, luma, depth, `createInstance()`, and control-rail assertions unchanged.

- [ ] **Step 2: Replace the old split-layout style assertions with fullscreen-layer assertions**

Replace the body of `floats the transparent hero preview and resets it on mobile` with assertions for the new layout:

```ts
it('fills the hero with a layered particle background', () => {
  const styles = readFileSync(resolve(demoDirectory, 'style.css'), 'utf8')
  const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 800px)'))

  expect(styles).toContain('.hero { min-height: 610px; display: block; position: relative; overflow: hidden; }')
  expect(styles).toContain('.hero-copy { position: relative; z-index: 2;')
  expect(styles).toContain('.hero-preview { position: absolute; inset: 0; z-index: 0;')
  expect(styles).toContain('.hero-preview::after {')
  expect(styles).toContain('.hero-preview canvas { display: block; width: 100%; height: 100%;')
  expect(styles).toContain('background: var(--nyx-c-bg-mute);')
  expect(mobileStyles).toContain('.hero { min-height: 610px; }')
  expect(mobileStyles).toContain('.hero-copy { padding: 72px 20px 48px; }')
  expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  expect(styles).toContain('.hero-preview { display: none; }')
})
```

- [ ] **Step 3: Run the focused tests and confirm they fail for the old layout**

Run:

```bash
pnpm vitest run demo/main.spec.ts
```

Expected: the new source and fullscreen style assertions fail before the
implementation changes, demonstrating that the tests cover the experiment.

### Task 2: Switch the hero particle source

**Files:**
- Modify: `demo/App.vue:19-20, 175`

- [ ] **Step 1: Add a one-line-swappable hero video URL constant**

Immediately after the existing `videoUrl` declaration, add:

```ts
const heroVideoUrl = new URL('./fixtures/hero0.mp4', document.baseURI).href
```

Keep `imageUrl` and `videoUrl` unchanged because they drive the playground.

- [ ] **Step 2: Use the hero constant in the existing NyxFission factory**

In `createHeroInstance`, change only the `source` property in the existing
factory from `source: videoUrl` to:

```ts
source: heroVideoUrl
```

Keep `MediaType.Video`, `depth: 0.7`, dark luma settings, lifecycle callbacks,
and disposal behavior unchanged. Do not add a raw `<video>` element.

- [ ] **Step 3: Run the focused tests and confirm the source expectations pass**

Run:

```bash
pnpm vitest run demo/main.spec.ts demo/hero-lifecycle.spec.ts
```

Expected: source and lifecycle assertions pass; the fullscreen style test may
still fail until Task 3 is complete.

### Task 3: Make the particle canvas a fullscreen hero layer

**Files:**
- Modify: `demo/style.css:23-32, 77-83, 100-103`

- [ ] **Step 1: Replace the desktop hero layout rules**

Replace the existing `.hero`, `.hero-copy`, `.hero-preview`, and
`.hero-preview canvas` rules with:

```css
.hero { min-height: 610px; display: block; position: relative; overflow: hidden; }
.hero-copy { position: relative; z-index: 2; max-width: 690px; padding: 90px 0 100px; }
.hero-preview { position: absolute; inset: 0; z-index: 0; margin: 0; padding: 0; background: var(--nyx-c-bg-mute); }
.hero-preview::after { content: ''; position: absolute; inset: 0; z-index: 2; background: linear-gradient(90deg, color-mix(in srgb, var(--nyx-c-bg) 92%, transparent) 0%, color-mix(in srgb, var(--nyx-c-bg) 64%, transparent) 56%, color-mix(in srgb, var(--nyx-c-bg) 34%, transparent) 100%); pointer-events: none; }
.hero-preview canvas { display: block; width: 100%; height: 100%; max-width: none; aspect-ratio: auto; }
```

The canvas remains behind the scrim because the pseudo-element has a higher
stacking order within `.hero-preview`, while `.hero-copy` remains above both.

- [ ] **Step 2: Replace the mobile split-layout overrides**

In the `@media (max-width: 800px)` block, replace the existing hero grid and
preview overrides with:

```css
.hero { min-height: 610px; }
.hero-copy { padding: 72px 20px 48px; }
.hero-preview { inset: 0; }
```

Leave the remaining mobile rules for sections, playground, quickstart, and
reference unchanged.

- [ ] **Step 3: Add the reduced-motion fallback for the decorative hero layer**

In the existing `@media (prefers-reduced-motion: reduce)` block, add:

```css
.hero-preview { display: none; }
```

The solid `.hero-preview` fallback is retained in normal mode, and hiding the
decorative layer for reduced motion leaves the hero background and semantic
copy usable. The existing lifecycle helper already avoids mounting the hero
renderer when reduced motion is preferred.

- [ ] **Step 4: Run the focused tests and confirm the fullscreen layout passes**

Run:

```bash
pnpm vitest run demo/main.spec.ts demo/hero-lifecycle.spec.ts
```

Expected: all focused demo tests pass.

### Task 4: Validate and commit the experiment

**Files:**
- No additional files

- [ ] **Step 1: Run the complete unit suite**

Run:

```bash
pnpm test:unit
```

Expected: all 227 existing tests pass.

- [ ] **Step 2: Run lint and build the demo**

Run:

```bash
pnpm lint
pnpm build:demo
```

Expected: ESLint exits successfully and Vite writes `dist-demo` successfully.

- [ ] **Step 3: Verify the ignored fixtures remain uncommitted**

Run:

```bash
git check-ignore -v demo/public/fixtures/hero0.mp4
git status --short
```

Expected: `hero0.mp4` is ignored by `demo/public/fixtures/hero*.mp4`; only the
intended source, test, and style changes are present.

- [ ] **Step 4: Manually review the experiment in the browser**

Run:

```bash
pnpm dev
```

Open the local Vite URL and verify the hero particle canvas fills the hero,
the copy and CTA remain readable, the playground is unchanged, and changing
`heroVideoUrl` to `hero1.mp4` selects another local fixture. Verify the
reduced-motion fallback using the browser's prefers-reduced-motion emulation.

- [ ] **Step 5: Commit the branch experiment**

Run:

```bash
git add demo/App.vue demo/main.spec.ts demo/style.css
git commit -m "feat(demo): experiment with fullscreen particle hero"
```

Expected: the branch contains the reversible fullscreen experiment without
changing `main` or adding large video fixtures.
