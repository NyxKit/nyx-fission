# Hero Particle Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hero's decorative badge and vertical signal with an independent NyxFission particle preview driven by `nyx-orbit.mp4` and default renderer settings.

**Architecture:** Add a dedicated hero canvas and `NyxFission` instance separate from the interactive playground instance. The hero instance is created with only `MediaType.Video` and the existing `videoUrl`, then mounted on page load and disposed on teardown; the playground lifecycle remains unchanged.

**Tech Stack:** Vue 3 Composition API, TypeScript, NyxFission, CSS, Vitest, Vite.

---

## File Map

- Modify `demo/App.vue`: add hero canvas/instance lifecycle, remove badge and vertical signal markup, and preserve the playground instance.
- Modify `demo/style.css`: style the hero preview and responsive stacked layout; remove obsolete vertical-signal rules.
- Modify `demo/main.spec.ts`: assert the new hero canvas/default configuration and removed decorative elements.

## Task 1: Add the Independent Hero Particle Preview

**Files:**
- Modify: `demo/App.vue`
- Modify: `demo/style.css`
- Modify: `demo/main.spec.ts`

- [ ] **Step 1: Write failing source assertions**

In `demo/main.spec.ts`, extend the existing App source assertions with:

```ts
expect(app).toContain('hero-canvas')
expect(app).toContain('heroInstance')
expect(app).toContain('new NyxFission({ type: MediaType.Video, source: videoUrl })')
expect(app).not.toContain('browser particle engine')
expect(app).not.toContain('GPU</span>')
expect(app).not.toContain('MEDIA</span>')
expect(app).not.toContain('FIELD</span>')
```

Keep assertions for `particles-canvas`, the existing controls, and `createInstance()` so the interactive playground remains present.

- [ ] **Step 2: Run the focused demo tests and verify the expected red state**

Run:

```bash
pnpm vitest run demo/main.spec.ts
```

Expected: FAIL because the hero canvas, hero instance, and new default-only config do not exist, while the removed badge and signal still exist.

- [ ] **Step 3: Add hero refs and default-only initialization**

In `demo/App.vue`:

1. Import `MediaType` from `../src/index`.
2. Add refs next to the playground refs:

```ts
const heroCanvas = ref<HTMLCanvasElement | null>(null)
const heroInstance = ref<NyxFission | null>(null)
```

3. Add a dedicated initializer that does not use playground controls:

```ts
const createHeroInstance = () => {
  const target = heroCanvas.value
  if (!target) return

  const nextInstance = new NyxFission({ type: MediaType.Video, source: videoUrl })
  heroInstance.value = nextInstance
  nextInstance.ready.catch(() => {
    if (heroInstance.value === nextInstance) {
      nextInstance.destroy()
      heroInstance.value = null
    }
  })
  nextInstance.mount(target)
}
```

The catch prevents an unhandled rejected `ready` promise and keeps hero failure isolated from playground status and controls. The hero uses the library defaults for theme, depth, and luma-key settings.

4. In `onMounted`, call `createHeroInstance()` after `await nextTick()` and before or alongside the existing playground `createInstance()` call.
5. In `onBeforeUnmount`, destroy `heroInstance` after clearing timers and before or alongside the existing playground cleanup.

- [ ] **Step 4: Replace the hero markup**

Keep the existing hero copy and CTA. Replace the badge and `.hero-signal` element with:

```vue
<div class="hero-preview" aria-hidden="true">
  <div class="hero-preview-label">LIVE / NYX-ORBIT.MP4</div>
  <canvas id="hero-canvas" ref="heroCanvas"></canvas>
</div>
```

The canvas is decorative because the interactive playground below remains the accessible control and status surface. Do not add hero controls or a second status indicator.

- [ ] **Step 5: Add responsive hero preview styling**

In `demo/style.css`, change the hero grid from the old fixed signal column to a flexible copy/preview split:

```css
.hero { grid-template-columns: minmax(0, 1fr) minmax(280px, .72fr); }
.hero-preview { position: relative; align-self: center; min-width: 0; padding: 24px 0 24px 28px; border-left: 1px solid var(--demo-line); }
.hero-preview-label { margin-bottom: 10px; color: var(--demo-faint); font: 10px var(--nyx-font-family-mono); letter-spacing: .1em; text-transform: uppercase; }
.hero-preview canvas { display: block; width: 100%; max-width: none; aspect-ratio: 4 / 3; border: 1px solid var(--demo-line); background: var(--nyx-c-bg-mute); }
```

Remove the obsolete `.hero-signal` rules. In the existing mobile media query, stack the preview:

```css
.hero { grid-template-columns: 1fr; }
.hero-preview { margin-top: 20px; padding: 20px 0 0; border-left: 0; border-top: 1px solid var(--demo-line); }
```

Preserve the existing hero copy spacing and reduced-motion rules. Do not add decorative gradients, blur, or animated layout properties.

- [ ] **Step 6: Run focused tests and verify green**

Run:

```bash
pnpm vitest run demo/main.spec.ts demo/quickstart.spec.ts src/__tests__/nyx-fission.spec.ts
```

Expected: PASS, including the existing playground and quickstart behavior.

- [ ] **Step 7: Commit the hero update**

```bash
git add demo/App.vue demo/style.css demo/main.spec.ts
git commit -m "feat: add particle preview to demo hero"
```

## Task 2: Full Verification and Review

**Files:**
- Review: `demo/App.vue`, `demo/style.css`, `demo/main.spec.ts`
- Reference: `docs/superpowers/specs/2026-09-02-hero-particle-preview-design.md`

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

Expected: all checks pass. The existing untracked `demo/public/fixtures/nyx-orbit.mp4` and luma-key plan remain untouched.

- [ ] **Step 2: Review the final diff against the design**

Confirm the badge and vertical signal are gone; the hero canvas uses an independent default-only `NyxFission` instance; the playground remains interactive; hero teardown is safe; the preview stacks on mobile; and no public API or particle-rendering behavior changed.
