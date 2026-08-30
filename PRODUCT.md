# Product

## Register

product

## Users

NyxFission serves both developers integrating a media-to-particle effect into
their browser application and people evaluating the library through its demo.
Developers need a small, framework-agnostic API with predictable media loading,
deployment-safe URLs, and library-owned runtime behavior. Demo visitors need to
understand the effect quickly and verify that image, video, webcam, themes, and
both mounting modes work.

## Product Purpose

NyxFission transforms browser media into a GPU-rendered particle field through a
single construct-and-mount API. Success means a consumer can get a compelling
result without managing Three.js, animation, resize, frame sampling, or
resource cleanup, while the demo makes the capabilities and constraints
obvious.

## Brand Personality

Playful, technical, kinetic. The interface should feel alive and experimental,
but its controls, errors, and integration guidance should remain exact and
developer-trustworthy.

## Anti-references

Avoid generic SaaS dashboards, dense settings panels, decorative glass cards,
and neon effects that obscure the actual particle output. Avoid demos that use
color alone to communicate state or that hide integration details behind an
unexplained visual spectacle.

## Design Principles

- Show the transformation immediately with a live, legible particle canvas.
- Make the shortest successful integration path visible before advanced detail.
- Treat browser constraints such as CORS and permissions as first-class product
  information, not surprising failures.
- Keep the visual energy in the rendered media, while controls stay calm and
  readable.

## Accessibility & Inclusion

Target WCAG 2.2 AA for the demo. Support keyboard navigation and visible focus,
use semantic labels and live status text, provide sufficient contrast, avoid
color-only state communication, and respect `prefers-reduced-motion` by
reducing decorative motion while keeping the core effect usable.
