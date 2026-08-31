uniform float pointSize;
uniform float depth;

attribute vec3 color;
attribute float luminance;

varying vec3 particleColor;

void main() {
  vec3 displacedPosition = position;
  displacedPosition.z = luminance * depth;
  particleColor = color;
  gl_PointSize = pointSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
