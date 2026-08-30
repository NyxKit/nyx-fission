uniform float pointSize;

attribute vec3 color;

varying vec3 particleColor;

void main() {
  particleColor = color;
  gl_PointSize = pointSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
