uniform float time, isJumping;
varying vec3 vPosition;

float checker(vec2 uv) {
  float cx = step(0.5, fract(uv.x * 4.0));
  float cy = step(0.5, fract(uv.y * 4.0));
  return mod(cx + cy, 2.0);
}
void main() {
  vec2 uv = abs(vPosition.xy); uv = mod(uv, 1.0);
  float glow = 0.5 + 0.5 * exp(-dot(vPosition.xy, vPosition.xy) * 1.5);
  vec3 baseColor = mix(vec3(1.0, 0.2, 0.2), vec3(1.0, 0.6, 0.3), 0.5 + 0.5*sin(time*2.0));
  float c = checker(uv);
  vec3 flagColor = mix(vec3(1.0), vec3(0.0), c);
  vec3 color = mix(baseColor, flagColor, isJumping);
  color += vec3(1.0,0.9,0.5) * glow * 0.35;
  gl_FragColor = vec4(color, 0.93);
}