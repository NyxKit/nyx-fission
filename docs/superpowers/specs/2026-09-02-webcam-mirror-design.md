# Webcam Input Mirroring Design

## Goal

Horizontally mirror webcam pixels before they enter the NyxFission particle pipeline, so webcam output behaves like a typical selfie preview while image and URL-video sources remain unchanged.

## Behavior

Only `MediaType.Usermedia` is mirrored. The mirror is a left-to-right flip applied in the internal 2D sampling canvas before `getImageData()` runs. Consequently, particle positions, colors, luminance, depth displacement, luma-key filtering, and coherence all operate on the mirrored source pixels.

No public configuration or API change is introduced.

## Architecture

`FrameSampler` receives an internal boolean `mirror` option. `NyxFission` resolves the media type before constructing the sampler and passes `true` only for usermedia sources. The sampler retains its existing working-dimension calculation, canvas reuse, frame cadence, and error handling.

For a mirrored frame, drawing is wrapped in a saved canvas state:

1. Save the 2D context.
2. Translate the origin to the right edge of the working canvas.
3. Scale the horizontal axis by `-1`.
4. Draw the webcam frame with the existing dimensions.
5. Restore the context.
6. Extract image data as before.

The context is restored even when `drawImage()` throws. Non-mirrored sources continue using the current direct draw path.

CSS transforms on the video element are intentionally not used because they affect presentation, not the pixels read by the sampler. Mirroring particle coordinates after sampling is also rejected because it would mirror rendered output after source-space processing rather than mirroring the input itself.

## Testing

Add tests for:

- Usermedia sampler construction enabling mirroring.
- Mirrored draw order using `save`, `translate(width, 0)`, `scale(-1, 1)`, `drawImage`, and `restore`.
- Image and URL-video sampling remaining untransformed.
- Context restoration when drawing fails.
- NyxFission passing mirroring only when the resolved media type is `MediaType.Usermedia`.

Existing frame dimensions, sampled data extraction, dynamic updates, disposal, and media error behavior must remain unchanged.

## Scope Exclusions

This change does not add a public mirror toggle, mirror image/video sources, alter webcam acquisition constraints, modify the rendered canvas via CSS, or change particle coordinate generation.
