# Luma-Key Coherence Filtering Design

## Goal

Reduce noisy, isolated particles produced by dark and light luma-key filtering while preserving the existing stable particle buffers and dynamic media behavior.

The feature is opt-in. A coherence value of `0` retains the current luma-key behavior exactly.

## Public API

Rename the enum to make its role explicit:

```ts
export enum LumaKeyMode {
  None = 'none',
  Dark = 'dark',
  Light = 'light',
}
```

Use a nested luma-key configuration:

```ts
new NyxFission({
  type: MediaType.Video,
  source: 'path/to/source.mp4',
  depth: 0.25,
  lumaKey: {
    mode: LumaKeyMode.Dark,
    threshold: 0.1,
    coherence: 0.1,
  },
})
```

The configuration is optional. When `lumaKey` is present, `mode` is required. Its optional values resolve as follows:

- `threshold`: `0.1`
- `coherence`: `0`

Both numeric values must be finite and within `0..1`, inclusive. Invalid modes and values are rejected synchronously with the existing `INVALID_CONFIG` sampling error. The old flat `lumaKey` enum value and top-level `lumaKeyThreshold` are intentionally removed; this API has not reached a `1.0` release and has no external compatibility requirement.

Luma-key settings are fixed for the lifetime of an instance. Runtime setters are not part of this design.

## Detection Model

`coherence` is a normalized local-support threshold:

- `0`: disable neighborhood cleanup and preserve current behavior.
- Values between `0` and `1`: require local support at least equal to the configured value.
- `1`: require every available neighboring sample to qualify.

For each sampled particle that passes the active luma-key threshold, inspect the up to eight immediately adjacent samples in a fixed 3x3 neighborhood on the sampled grid. A neighbor qualifies when it would also survive the selected dark or light luma-key comparison. The support score is:

```text
qualifying neighbors / available neighbors
```

The current particle is excluded from both counts. At image borders, the denominator is the number of neighbors that actually exist, avoiding an artificial edge penalty. A particle is discarded when its support score is less than `coherence`.

The 3x3 neighborhood is intentionally conservative. It targets isolated samples and small specks without immediately eroding thin structures. More advanced kernels can be considered later if real input examples show that diagonal gaps or fine details need special handling.

## Data Flow and Architecture

The existing sampled particle positions remain stable. During initial sampling and each same-sized frame update:

1. Retain the existing luminance and color updates.
2. Evaluate sampled luminance against the resolved luma-key mode and threshold.
3. Calculate local support when coherence is greater than zero.
4. Store the support score in a new per-particle attribute.
5. Update the existing GPU attribute in place and mark it for upload.
6. Let the fragment shader discard particles that fail the coherence condition.

The support score uses the same stabilized luminance values currently used for depth updates. This reduces flicker when video or webcam pixels briefly cross a threshold. No particles are removed from arrays, no same-sized geometry is rebuilt, and the attribute lengths remain constant across dynamic frames.

When coherence is zero, neighborhood calculation is bypassed and the shader's coherence condition is disabled. When no luma-key mode is active, coherence filtering is also disabled because there is no foreground classification to support.

## Rendering Behavior

The runtime receives the resolved luma-key mode, threshold, and coherence once during construction. The vertex shader forwards the per-particle support attribute to the fragment shader alongside luminance. The fragment shader keeps the existing order and behavior:

1. Apply dark or light luma-key discard.
2. Apply coherence discard when enabled.
3. Apply the existing circular point discard and soft alpha.

The existing luma comparisons remain inclusive. Coherence uses a strict less-than comparison so a particle exactly at the configured support threshold remains visible.

## Alternatives Considered

### Connected-component cleanup

Build a binary luma-key mask, identify connected regions, and remove regions below a minimum size.

This better represents semantic noise because a particle can survive when it belongs to a larger region even if it is locally sparse. However, it adds considerably more per-frame CPU work for video and webcam input, introduces resolution-dependent sizing concerns, and does not map as naturally to a single normalized `0..1` property.

### GPU neighborhood texture

Upload the current luminance or binary key mask as a texture and sample neighboring texels in the fragment shader.

This moves repeated spatial work to the GPU and could support soft falloff. It also requires texture-coordinate plumbing and a per-frame texture upload, making it more invasive than the existing attribute pipeline. It still requires a policy for preserving thin details.

### Multi-scale support

Preserve a particle when it has either tight local support or broader support from a larger nearby region.

This could protect thin strokes that belong to large shapes, but it adds tuning complexity and makes the meaning of one coherence value less obvious. It is deferred unless the fixed 3x3 kernel proves insufficient.

## Validation and Testing

Tests should cover:

- Public `LumaKeyMode` values and nested TypeScript configuration.
- Default mode, threshold, and coherence resolution.
- Explicit nested values reaching the runtime unchanged.
- Invalid modes, non-finite numbers, and values outside `0..1`.
- Isolated qualifying particles receiving zero support.
- Dense regions receiving high support.
- Correct border handling.
- Thin structures under different coherence values.
- Stable attribute lengths and in-place updates across dynamic frames.
- Runtime uniforms and shader declarations/discard ordering.
- The intentionally removed flat API.

The implementation should retain existing unit, type-check, lint, build, declaration, demo, packaging, and diff checks.

## Scope Exclusions

This design does not include CPU removal of particles, geometry rebuilding for same-sized frames, runtime luma-key setters, chroma keying, render-loop controls, connected-component analysis, or multi-scale filtering.
