# Demo styles

NyxTabs groups the playground into Basic (source, theme, depth), LumaKey
(filtering), Entrance, and Interaction. Switching tabs preserves controls and the current
media instance. NyxTabs retains its default appearance; the tab navigation
scrolls horizontally when needed so all four tabs fit without shifting the fields.
The Entrance fieldset controls `entrance.type`, `autoStart`, `duration`, and `delay`.
Timing edits use the existing debounce and clamp to the demo's 0–10,000 ms range.
Manual start displays “Ready, waiting to play”; Play/Replay calls `playEntrance()`
on the current instance. Preset/configuration edits recreate only the playground
and update its generated integration example. The hero remains independent.

The Interaction tab configures `interaction.type`, `radius` (1–1000 CSS pixels),
`strength` (0–1), `delay`, and `duration` (0–10,000 ms in the demo). None is the default and disables
the numeric controls. Attract/Repel move in the image plane; Push/Pull move in
depth. Hover or touch the preview after its entrance to try the effect. Changes
use the existing debounce and update the generated example. Reduced motion
disables pointer effects; touch interactions preserve native scrolling. Delay
holds old particle displacements after pointer movement or exit; duration
controls their transitions toward the effect and back to rest.

`main.ts` imports `style.scss`. Vite compiles it with Sass; the library itself does not depend on Sass at runtime.

Use BEM names for demo-owned styles:

- A block represents a page section or reusable unit: `hero`, `demo-controls`, `code-example`.
- An element names a part of that block: `hero__canvas`, `demo-controls__label`.
- A modifier changes a block's presentation and accompanies its base class: `demo-section demo-section--surface`.

Keep each block's declarations, elements, states, and responsive overrides together. Use shallow `&__element` and `&--modifier` nesting, and explicit classes instead of selectors tied to the HTML hierarchy. Keep Nyx Kit's classes and semantic theme variables intact.

Format the Vue template and SCSS with `pnpm format:demo`; verify formatting with `pnpm format:demo:check`. The wordmark has a targeted formatter exception to keep “nyxfission” together without inserting whitespace.

The style assertions in `main.spec.ts` inspect compiled CSS, allowing SCSS source formatting and nesting to change without changing the assertions. Run `pnpm test:unit` and `pnpm test:demo` after changing styles or template classes.

`App.spec.ts` mounts the compiled Vue app with a fake particle engine and lightweight Nyx Kit controls. It checks configuration, rendered labels, status transitions, source changes, and cleanup through DOM events. It does not provide browser visual verification.

`useDebouncedNumberInput` owns edit timing and cancels pending work when its Vue scope is disposed. Each control supplies its parsing policy: depth retains its previous value for blank or incomplete edits; luma values clamp to 0–1 and treat blank input as zero. `restartPlayground()` starts setup synchronously; the particle instance’s events and `ready` promise report asynchronous completion.
