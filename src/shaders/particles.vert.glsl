uniform float pointSize;
uniform float depth;

attribute vec3 color;
attribute float luminance;
attribute float coherence;

varying vec3 particleColor;
varying float particleLuminance;
varying float particleCoherence;

void main() {
  vec3 displacedPosition = position;
  displacedPosition.z = luminance * depth;
  particleColor = color;
  particleLuminance = luminance;
  particleCoherence = coherence;
  gl_PointSize = pointSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
