varying vec3 particleColor;

void main() {
  vec2 point = gl_PointCoord - vec2(0.5);
  float distanceFromCenter = length(point);
  if (distanceFromCenter > 0.5) discard;

  float alpha = smoothstep(0.5, 0.35, distanceFromCenter);
  gl_FragColor = vec4(particleColor, alpha);
}
