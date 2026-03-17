// GLSL vertex and fragment shaders for the holographic beam highlight effect.

/** Vertex shader for the holographic beam cylinder. */
export const beamVertexShader = /* glsl */ `
uniform float u_radius;

varying float vHeight;
varying float vRadial;

void main() {
  vHeight = uv.y;
  vRadial = length(position.xz) / u_radius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Fragment shader for the holographic beam cylinder. */
export const beamFragmentShader = /* glsl */ `
uniform vec3 u_color;
uniform float u_intensity;
uniform float u_time;

varying float vHeight;
varying float vRadial;

void main() {
  // Vertical falloff: bright at base, transparent at top
  float vertFade = 1.0 - smoothstep(0.0, 0.85, vHeight);
  // Radial softness: bright center, soft edges
  float radFade = 1.0 - smoothstep(0.3, 1.0, vRadial);
  // Subtle pulse animation
  float pulse = 0.95 + 0.05 * sin(u_time * 2.0 + vHeight * 3.0);

  float alpha = vertFade * radFade * u_intensity * pulse;
  gl_FragColor = vec4(u_color, alpha);
}
`;
