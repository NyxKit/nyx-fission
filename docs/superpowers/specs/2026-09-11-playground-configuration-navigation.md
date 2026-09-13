# Playground configuration navigation

Date: 2026-09-11; decision updated 2026-09-12; implemented 2026-09-13

Status: Revised option A integrated with nyx-kit 2.1.0: Source initially open, single-open mode.

Baseline: `main` at `6c60ddb`, NyxFission 1.2.0, installed nyx-kit 2.0.40.

## Problem and intended outcome

The fourth playground tab, Interaction, is mostly outside the visible controls
column. Visitors can miss an entire capability. Choose an organization that keeps
labels understandable, works on narrow screens, and accommodates future settings
without another redesign each time a tab is added.

The user selected option A on 2026-09-12, then revised it on 2026-09-13:
Source is now the first accordion section and starts open. Appearance, LumaKey,
Entrance, and Interaction start closed. Opening a section closes the previous
one; users may also close the current section. This supersedes the earlier
always-visible Source and multiple-open design.

The alternatives and baseline measurements remain as research context. The demo
uses the published NyxAccordion API: `items` with five stable IDs, `multiple=false`,
a scalar `v-model` initialized to `'source'`, heading level 3, the `header` slot
for labels and closed-state summaries, and `item-<id>` slots for settings.
Accordion state does not participate in the configuration watcher, so navigation
does not rebuild the renderer or alter the code output.

## Original layout and measured cause

- `demo/App.vue`: `configTabs` contains Basic, LumaKey, Entrance, Interaction.
  Basic contains both Source and Appearance. The demo uses real NyxTabs with
  `NyxSize.Small` and the primary theme.
- `demo/style.scss`: `.playground__layout` allocates a fixed 310px controls column
  beside the preview above 800px viewport width. At 800px and below, it becomes a
  single column. The desktop preview is sticky; the mobile preview is not.
- `.demo-controls__tabs > nav` already has `overflow-x: auto`. Adding that same
  rule again would not address discovery. NyxTabs has an outer `overflow: hidden`
  and flex tab items with uppercase, letter-spaced labels and padding.
- State belongs to the App, independently of the selected tab. Preserve this
  separation and the existing debounced number inputs in any replacement.

Measured in headless Chromium against the local Vite demo with fonts ready, at
100% zoom. Values are CSS pixels, rounded. This is a baseline diagnosis, not a
cross-browser accessibility audit or usability study.

| Viewport width    | Controls width | Tab strip available | Tab strip scroll width |
| ----------------- | -------------: | ------------------: | ---------------------: |
| 1440 / 1024 / 801 |            310 |                 308 |                    422 |
| 800               |            760 |                 758 |                    758 |
| 390               |            350 |                 348 |                    422 |
| 320               |            280 |                 278 |                    422 |

At desktop widths, Interaction begins around pixel 291 and ends around pixel 422
inside a 308px strip. Only its leading edge is visible. Scrolling is technically
available, but the captured browser view gives little indication of the hidden
section. The 800px breakpoint also explains why a narrower window can briefly
look better than a wider one.

Removing Basic in a temporary browser DOM experiment still produced **345px** of
tabs in **308px** of space. Extracting Basic alone therefore does not fix the
current desktop layout, even before considering future sections or larger text.

## Product constraints

The existing `PRODUCT.md` describes developers integrating the library and people
evaluating its capabilities. The preview should stay prominent, and the controls
should remain calm, readable, and consistent with Nyx components. Keep the
existing dark palette and typography; this is an information-architecture change.

Keep clear text labels, all existing settings, explicit webcam activation, source
URL Apply behavior, entrance replay, loading/error feedback, and generated code
in sync. Opening a section must not restart media, ask for camera permission, or
reset an effect. Support keyboard use, visible focus, and reduced motion.

## Research that informs the options

1. Carbon supports scrolling horizontal tabs and advises against wrapping them
   into several rows. Its icon-only guidance assumes recognizable, established
   symbols and tooltips. Those conditions are weak for concepts such as LumaKey
   and Entrance. This supports retaining text and treating overflow as deliberate
   navigation, rather than clipping or reducing font size.
   [Carbon tabs usage](https://carbondesignsystem.com/components/tabs/usage/)
2. WAI-ARIA tabs use explicit tab/panel relationships and keyboard navigation.
   Automatic activation is suitable when panels appear without noticeable delay.
   Any overflow mechanism must keep focused tabs reachable and visible.
   [WAI-ARIA tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
3. WAI-ARIA accordions organize sections vertically using expandable headings.
   They support either one or multiple open sections. Headers expose expansion
   state and panel relationships and operate with Enter/Space.
   [WAI-ARIA accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
4. WCAG reflow guidance calls for content to remain usable at a width equivalent
   to 320 CSS pixels without loss of information or functionality. Evaluate the
   settings independently of the inherently visual particle canvas; do not assume
   the canvas makes overflow in the controls acceptable.
   [WCAG 2.2 reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

The recommendation below is a project-specific judgment drawn from these sources
and the measurements, not a requirement imposed by those design systems.

## Options

| Option                                      | Benefit                                                                       | Cost / limitation                                                                  | Assessment                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| A. Source plus expandable settings sections | Full text; width independent of section count; several groups can be compared | More vertical scrolling; disclosure component work                                 | Recommended for growth                       |
| B. Text tabs with visible overflow controls | Familiar model; smaller information-architecture change                       | Some sections remain hidden; library work to make scrolling obvious and accessible | Best conservative alternative                |
| C. Labeled section selector                 | Fits the narrow column; supports more sections                                | An extra interaction; capabilities hidden until opened                             | Compact fallback                             |
| D. Extract Basic and keep three tabs        | Common controls always available                                              | Remaining labels still need 345px; additional height; growth problem returns       | Useful grouping change, insufficient fix     |
| E. Vertical tabs                            | Every section name visible; supports more sections                            | Navigation consumes the 310px width needed by fields                               | Consider only with a wider/full-width editor |
| F. Icon-only or wrapped tabs                | Can reduce immediate width pressure                                           | Ambiguous symbols or multi-row navigation; does not resolve scalable grouping      | Do not pursue                                |

### A. Expandable sections (selected, revised to single-open mode)

Split the former Basic content into Source and Appearance. Use five accordion
sections in order: Source, Appearance, LumaKey, Entrance, Interaction.

```text
Live particle preview        v Source
                              Image  Video  Enable webcam
                              Media URL             Apply
                            > Appearance
                            > LumaKey       None
                            > Entrance      None
                            > Interaction   None
```

Source starts open and the remaining sections start closed. Opening any section
closes the current one; allow all to close. Add compact current
mode summaries to closed effect headings, for example “Dark”, “Vortex”, “Repel”.
“None” means the effect mode is disabled; it does not mean the settings section
cannot open. Derive summaries from the same configuration used by the preview.

Use full-width heading controls with a disclosure chevron. Labels and summaries
can wrap within their own row. Do not add another nested card around each group.
All settings sections remain in normal flow. Preserve desktop preview
stickiness and the current stacked mobile order; do not add a sticky mobile canvas
that could cover fields or the on-screen keyboard.

This is the strongest growth option because adding a group consumes vertical
space rather than shrinking every existing label. Its tradeoff is travel down the
page, especially on mobile where the preview is above the controls. Validate
switching between Entrance and Interaction during integration.

**Component dependency:** nyx-kit 2.1.0 supplies NyxAccordion and is now locked in
the demo dependency graph. Its panels use `v-show` with `inert` and `aria-hidden`,
preserving mounted controls while excluding closed content from keyboard access.
The demo retains the existing Nyx inputs and selects.

The demo needs these behaviors from the component, without prescribing its API:

- Stable section identities and an initial open state, with Source open.
- At most one open section, with the ability to close all sections.
- Header text plus optional mode summaries derived from the demo configuration.
- Panel content that preserves input drafts and does not restart media when toggled.
- Accessible heading controls, expansion state, keyboard operation, visible focus,
  and closed content excluded from the focus order.
- Long labels that wrap within narrow containers and reduced-motion support.

The published exports and behavior were inspected before integration. The package
manifest and lockfile now include the upgrade.

### B. Text tabs with explicit scrolling controls

Retain the four sections and existing tab semantics. Add previous/next scroll
buttons when the list actually overflows, with labels such as “Scroll settings
left” and “Scroll settings right”. At each end, make the unavailable direction
clear. A partial next label may reinforce discovery, but must not be the only cue.

```text
[<]  Basic  LumaKey  Entrance ... [>]
               selected panel
```

Measure available strip width, including the space occupied by scroll buttons.
Update on resize, font changes, and section changes. Scroll the selected/focused
tab fully into view during keyboard navigation. Scroll controls move the strip
without changing the selected settings; clicking a tab selects it. Retain touch
swiping and visible focus. Use instant scrolling under reduced motion.

The installed NyxTabs props have no overflow-control option. Implementing this in
nyx-kit would be preferable to coupling the demo to its internal `<nav>` markup.
Its existing `position` prop also does not establish that vertical behavior meets
all keyboard and layout requirements; verify it before relying on it.

This is the conservative choice if keeping tabs is a priority. It deliberately
accepts that a visitor must navigate to discover every capability. It must still
be checked at 320px and with six longer labels.

### C. Labeled section selector

Replace the tab strip with a NyxSelect labeled “Settings section”, offering
Appearance, LumaKey, Entrance, Interaction; keep Source above it as in A.

```text
Source controls
Settings section
[Interaction                 v]
Interaction mode
Radius / strength / timing
```

The selected section's heading appears below the selector. Switching changes only
which fields are visible. Keep focus on the selector, with the section next in the
reading/tab order. It is a form control that changes displayed settings, so do not
add tab roles to the select. Verify the existing NyxSelect keyboard behavior.

This reuses an available component and needs little width, but hides the feature
inventory and adds a selection interaction. Prefer it only if compactness outweighs
discovery. Avoid introducing tabs on desktop and a selector on mobile unless
testing justifies maintaining two navigation modes and preserving focus across
breakpoint changes.

### Why the quick fixes are insufficient

- **Extract Basic:** reasonable as information architecture, but measured remaining
  tabs still overflow. Pair it with A, B, C, or a genuinely wider layout.
- **Widen the sidebar:** about 424px would accommodate today's measured strip at
  default text size. That steals preview space around the desktop breakpoint and
  does not cover longer labels, zoom, or future groups.
- **Shrink labels/padding:** spends readability and target size to buy temporary
  room. Use normal component sizing; do not invent abbreviations such as “Int.”.
- **Icons:** Source may have a familiar symbol, but LumaKey, Entrance, and
  Interaction lack equally obvious ones. Tooltips alone are weak discovery on
  touch. Icons beside text do not save width.
- **Two tab rows or a “More” menu:** wrapping makes relationships harder to scan;
  More introduces hidden destinations and extra selection/focus rules. Neither
  has a clear advantage over A or the simpler selector for this small editor.

## Acceptance criteria for a later implementation

1. Every group can be discovered and operated by pointer, touch, and keyboard.
   No label or focus indicator is cut off without an explicit, operable navigation
   mechanism. No horizontal document overflow originates from the controls.
2. Check 1440, 1024, 801, 800, 390, and 320px viewports; 200% text sizing; and 400%
   browser zoom from a 1280px viewport. Repeat with six groups and labels roughly
   twice as long. For A, labels wrap and groups remain in document flow.
3. Section navigation preserves source, typed/pending numeric input, theme, depth,
   luma key, entrance and interaction values. It neither remounts NyxFission nor
   changes generated integration code by itself.
4. With a video playing or webcam enabled, opening and closing groups leaves the
   stream running. Camera permission is requested only by Enable webcam.
5. Replay, busy/disabled states, error/help text, and source Apply retain their
   current behavior. Navigation stays usable during loading and after errors.
6. For A, Enter/Space toggles the header; heading buttons have stable panel IDs,
   `aria-expanded`, and `aria-controls`. Closed content is not focusable. Focus
   stays on a header after toggling; no automatic scrolling surprises the user.
   Keep form labels/legends intact. Do not put another button inside a header.
7. For B, verify Left/Right and Home/End, active-tab visibility, selected state,
   panel naming, and edge scroll controls. For C, verify the select label and
   keyboard selection, then the reading order into the displayed section.
8. Check Chromium, Firefox, and WebKit, keyboard-only use, and at least one screen
   reader. The baseline browser measurement above does not replace these checks.
9. Extend existing demo behavior tests for state and media continuity. Use browser
   layout checks for overflow; jsdom alone cannot verify clipping. Run demo build,
   formatting, lint, type checks, and the relevant existing tests.

## Implementation boundary

The integration changes configuration presentation in `demo/App.vue` and layout
in `demo/style.scss`, with `demo/App.spec.ts` coverage and demo documentation.
NyxAccordion itself remains owned by nyx-kit. Particle runtime behavior, public
API, source lifecycle, and configuration defaults are unchanged.

Option A is selected. A full standalone editor, presets browser, or searchable
settings surface is beyond the present problem.

## Integration validation

- All 390 unit/demo tests pass, including the real accordion's initial/single-open/
  all-closed states, persistent input nodes and pending values, mode summaries,
  video/webcam instance preservation, and unchanged JSON when toggling sections.
- Lint, type-check, demo build, and artifact smoke checks pass.
- Before the single-open revision, Chromium and Firefox checks passed at 1440, 1024, 801, 800, 390, and 320px.
  The controls and header scroll widths match their available widths, including
  the original 310px desktop column. Keyboard End, Enter, Space, and Tab behavior,
  hidden-panel exclusion, code-view synchronization, and canvas identity passed.
- WebKit launch was attempted but the local browser requires missing ICU 74
  libraries. WebKit and manual screen-reader verification remain outstanding.
  The extended six-group/long-label and browser-zoom stress cases above also
  remain recommended follow-up checks; the measured matrix uses the real four
  sections at normal text size.

## Remaining product questions

- Is “LumaKey” the preferred visible label, or would “Luma key” / “Filtering” help
  first-time visitors? Preserve the API terminology in help text either way.
- Which additional configuration groups are likely next? Use six groups as the
  stress case until there is a concrete roadmap.
- Is mobile interaction with the preview frequent enough to warrant a separate
  future preview-layout task? Keep the existing mobile flow for this change.

The layout direction and component ownership are settled. Remaining product
questions use the defaults above unless revised.
