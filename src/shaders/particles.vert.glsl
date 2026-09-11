uniform float pointSize;
uniform float depth;
uniform float entranceType;
uniform float entranceProgress;
uniform float entranceRadius;
uniform float entranceOriginZ;
uniform float entranceFieldRadius;
uniform float entranceHalfWidth;
uniform float entranceHalfHeight;
#ifdef NYX_INTERACTION
attribute vec3 interactionOffset;
#endif

attribute vec3 color;
attribute float luminance;
attribute float coherence;

varying vec3 particleColor;
varying float particleLuminance;
varying float particleCoherence;
varying float entranceAlpha;

float particleSeed(vec2 coordinate) {
  return fract(sin(dot(coordinate, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 displacedPosition = position;
  displacedPosition.z = luminance * depth;
  entranceAlpha = 1.0;
  float sizeScale = 1.0;
  if (entranceType > 0.0) {
    float seed = particleSeed(position.xy);
    vec3 randoms = vec3(particleSeed(position.xy + 2.71), particleSeed(position.xy - 5.19), particleSeed(position.yx + 9.43));
    bool organic = entranceType == 2.0 || entranceType == 4.0 || entranceType == 6.0;
    bool scan = entranceType == 5.0 || entranceType >= 7.0;
    float stagger = entranceType == 1.0 ? 0.2 : organic ? 0.32 : 0.0;
    float startAt = stagger * seed;
    // Vary both departure and travel time, with every particle settled by progress 1.
    float travelTime = organic ? mix(0.38, 0.68, randoms.x) : 1.0 - stagger;
    if (scan) {
      float coordinate = entranceType >= 8.0
        ? 0.5 - position.y / max(2.0 * entranceHalfHeight, 0.00001)
        : 0.5 + position.x / max(2.0 * entranceHalfWidth, 0.00001);
      if (entranceType == 7.0 || entranceType == 9.0) coordinate = 1.0 - coordinate;
      startAt = 0.72 * clamp(coordinate, 0.0, 1.0) + 0.08 * seed;
      travelTime = 0.2;
    }
    float local = clamp((entranceProgress - startAt) / travelTime, 0.0, 1.0);
    float eased = 1.0 - pow(1.0 - local, organic ? mix(2.0, 5.0, randoms.y) : 4.0);
    if (entranceType == 1.0 || entranceType == 4.0) {
      float radius = length(position.xy);
      vec2 direction = radius > 0.00001 ? position.xy / radius : vec2(cos(seed * 6.2831853), sin(seed * 6.2831853));
      vec3 startPosition = vec3(direction * entranceRadius * (1.0 + seed * 0.35), displacedPosition.z);
      displacedPosition = mix(startPosition, displacedPosition, eased);
      if (entranceType == 4.0) {
        float angle = (1.0 - eased) * (4.712389 + randoms.z * 3.1415927);
        displacedPosition.xy = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * displacedPosition.xy;
      }
      entranceAlpha = smoothstep(0.0, 0.12, local);
    } else if (entranceType == 2.0) {
      float travelDepth = min(0.0, depth) - entranceOriginZ;
      vec3 origin = vec3((randoms.xy - 0.5) * entranceFieldRadius * 0.08, entranceOriginZ + randoms.z * travelDepth * 0.2);
      displacedPosition = mix(origin, displacedPosition, eased);
      // Individual curved routes break up the expanding-image silhouette.
      float angle = randoms.z * 6.2831853 + (1.0 - eased) * (randoms.x - 0.5) * 3.1415927;
      displacedPosition.xy += vec2(cos(angle), sin(angle)) * sin(eased * 3.1415927) * entranceFieldRadius * mix(0.35, 0.9, randoms.y);
      entranceAlpha = smoothstep(0.0, 0.18, local);
      sizeScale = mix(0.15, 1.0, smoothstep(0.0, 0.45, local));
      // Thin the coincident cluster, then restore every particle early in the run.
      if (randoms.z > smoothstep(0.0, 0.15, local)) entranceAlpha = 0.0;
    } else if (scan) {
      displacedPosition.xy += (randoms.xy - 0.5) * entranceFieldRadius * 0.14 * (1.0 - eased);
      entranceAlpha = smoothstep(0.0, 0.4, local);
    } else if (entranceType == 6.0) {
      vec3 startPosition = vec3((randoms.xy - 0.5) * entranceRadius * 2.0, mix(min(0.0, depth), entranceOriginZ, randoms.z));
      displacedPosition = mix(startPosition, displacedPosition, eased);
      displacedPosition.xy += (randoms.yz - 0.5) * sin(eased * 3.1415927) * entranceFieldRadius * 0.4;
      entranceAlpha = smoothstep(0.0, 0.15, local);
    } else {
      entranceAlpha = eased;
    }
  }
  particleColor = color;
  particleLuminance = luminance;
  particleCoherence = coherence;
  vec4 viewPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
#ifdef NYX_INTERACTION
  float cameraDistance = -viewPosition.z;
  viewPosition.xyz += interactionOffset;
  // A video frame can change luminance while an old displacement is held.
  viewPosition.z = min(viewPosition.z, -cameraDistance * 0.3);
  sizeScale *= cameraDistance / (-viewPosition.z);
#endif
  gl_PointSize = pointSize * sizeScale;
  gl_Position = projectionMatrix * viewPosition;
}
