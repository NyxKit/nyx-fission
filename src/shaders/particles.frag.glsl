varying vec3 particleColor;
varying float particleLuminance;
varying float particleCoherence;

uniform float lumaKeyMode;
uniform float lumaKeyThreshold;
uniform float lumaKeyCoherence;

void main() {
  if (lumaKeyMode == 1.0 && particleLuminance <= lumaKeyThreshold) discard;
  if (lumaKeyMode == 2.0 && particleLuminance >= 1.0 - lumaKeyThreshold) discard;
  if (lumaKeyCoherence > 0.0 && particleCoherence < lumaKeyCoherence) discard;
  vec2 point = gl_PointCoord - vec2(0.5);
  float distanceFromCenter = length(point);
  if (distanceFromCenter > 0.5) discard;

  float alpha = 1.0 - smoothstep(0.35, 0.5, distanceFromCenter);
  gl_FragColor = vec4(particleColor, alpha);
}
