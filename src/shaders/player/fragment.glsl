uniform float time;
varying vec3 vPosition;
void main() {
  vec3 color = vec3(0.5, 0.8, 1.0);
  float alpha = 0.3 + 0.2 * sin(time * 3.0);
  gl_FragColor = vec4(color, alpha);
}