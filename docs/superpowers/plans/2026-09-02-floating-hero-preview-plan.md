# Floating Dark-Luma Hero Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hero particle example into a transparent, partially overlapping dark-luma visual layer without changing the interactive playground.

**Architecture:** Keep the existing independent hero `NyxFission` instance and lifecycle. Change only its luma-key mode to `LumaKeyMode.Dark`, remove the preview title and divider treatments, and use CSS overlap with a mobile reset.

**Tech Stack:** Vue 3 Composition API, TypeScript, CSS, Vitest, Vite, NyxFission.

---

## File Map

- Modify `demo/App.vue`: set the hero instance to dark luma mode and remove the preview label.
- Modify `demo/style.css`: remove hero/preview divider and background treatments, add floating overlap, and reset it on mobile.
- Modify `demo/main.spec.ts`: update source assertions for dark luma mode, removed title, removed dividers, and preserved playground/lifecycle wiring.

## Task 1: Refine the Hero Visual Layer

**Files:**
- Modify: `demo/App.vue`
- Modify: `demo/style.css`
- Modify: `demo/main.spec.ts`

- [ ] **Step 1: Write failing source assertions**

Update `demo/main.spec.ts` to require the dark luma mode and the new transparent treatment:

```ts
expect(app).toContain('lumaKey: { mode: LumaKeyMode.Dark }')
expect(app).not.toContain('LIVE / NYX-ORBIT.MP4')
expect(styles).not.toContain('border-left: 1px solid var(--demo-line)')
expect(styles).not.toContain('background: var(--nyx-c-bg-mute)')
expect(styles).toContain('margin-right: -')
expect(styles).toContain('transform: translateY(')
expect(styles).toContain('.hero-preview')
```

Keep the existing assertions for `hero-canvas`, `heroInstance`, independent lifecycle cleanup, `particles-canvas`, and the interactive control rail. Add a check that the mobile media query resets the preview transform or offset.

- [ ] **Step 2: Run the focused demo test and verify the expected red state**

Run:

```bash
pnpm vitest run demo/main.spec.ts
```

Expected: FAIL because the hero still has its preview title, default-only luma config, border, and background.

- [ ] **Step 3: Update the hero renderer configuration and markup**

In `demo/App.vue`, change the hero factory passed to `createHeroPreviewLifecycle` to:

```ts
create: () => new NyxFission({
  type: MediaType.Video,
  source: videoUrl,
  lumaKey: { mode: LumaKeyMode.Dark },
})
```

Keep threshold and coherence omitted so they retain their library defaults. Remove the `hero-preview-label` element from the hero template, leaving the decorative wrapper and canvas:

```vue
<div class="hero-preview" aria-hidden="true">
  <canvas id="hero-canvas" ref="heroCanvas"></canvas>
</div>
```

Do not alter the playground `lumaKey` configuration or hero lifecycle helper.

- [ ] **Step 4: Make the preview transparent and floating**

In `demo/style.css`, change the preview styling to remove the border and panel treatment and introduce a controlled overlap:

```css
.hero { border-bottom: 0; }
.hero-preview { position: relative; align-self: center; min-width: 0; margin-right: -10%; padding: 0; transform: translateY(28px); z-index: 1; }
.hero-preview canvas { display: block; width: 115%; max-width: none; aspect-ratio: 4 / 3; }
```

Remove `.hero-preview-label` and any `border-left`, `background`, or border declarations from `.hero-preview` and `.hero-preview canvas`. Keep the global canvas sizing needed by the playground, and do not add gradients, blur, or layout-property animation.

In the existing mobile media query, return the preview to normal flow:

```css
.hero-preview { margin: 20px 0 0; padding: 20px 0 0; transform: none; border-top: 0; }
.hero-preview canvas { width: 100%; }
```

The mobile rule must not reintroduce a divider or background.

- [ ] **Step 5: Run focused tests and verify green**

Run:

```bash
pnpm vitest run demo/main.spec.ts demo/hero-lifecycle.spec.ts
```

Expected: PASS, including dark-luma configuration, transparent floating styles, responsive reset, lifecycle safety, and unchanged playground assertions.

- [ ] **Step 6: Commit the refinement**

```bash
git add demo/App.vue demo/style.css demo/main.spec.ts
git commit -m "feat: float dark-luma hero preview"
```

## Task 2: Full Verification and Review

**Files:**
- Review: `demo/App.vue`, `demo/style.css`, `demo/main.spec.ts`
- Reference: `docs/superpowers/specs/2026-09-02-floating-hero-preview-design.md`

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

Expected: all checks pass. Preserve unrelated untracked `hero*.mp4` files and the luma-key plan.

- [ ] **Step 2: Review the final diff against the design**

Confirm the preview title, hero divider, preview divider, preview background, and preview border are absent; the hero uses `LumaKeyMode.Dark` with default threshold/coherence; the canvas overlaps on desktop and resets on mobile; reduced-motion and lifecycle behavior remain intact; and the playground is unchanged.
