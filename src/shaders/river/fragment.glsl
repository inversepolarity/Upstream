varying vec2 vUv;
uniform float time, hyperdrive;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float checker(vec2 uv) {
  float cx = step(0.5, fract(uv.x * 4.0));
  float cy = step(0.5, fract(uv.y * 4.0));
  return mod(cx + cy, 2.0);
}
float getHeight(vec2 uv, float t) {
  float wave1 = sin(uv.x * 18.0 + t * 1.5) * 0.08;
  float wave2 = sin(uv.x * 32.0 - t * 2.0) * 0.04;
  float wave3 = sin(uv.y * 24.0 + t * 2.5) * 0.06;
  float n1 = noise(uv * 8.0 + t * 0.5) * 0.08;
  float n2 = noise(uv * 16.0 - t * 0.8) * 0.04;
  float n3 = noise(uv * 32.0 + t * 1.2) * 0.02;
  return wave1 + wave2 + wave3 + n1 + n2 + n3;
}
void main() {
  vec2 uv = vUv; float t = time;
  float height = getHeight(uv, t);
  vec3 deep = vec3(0.07, 0.22, 0.45), shallow = vec3(0.18, 0.55, 0.95);
  float depth = clamp(uv.y + height * 0.5, 0.0, 1.0);
  vec3 color = mix(deep, shallow, depth);
  color = mix(color, vec3(0.1, 0.3, 0.5), 0.2 + 0.2*noise(uv*4.0 + t*0.2));
  float fresnel = pow(1.0 - abs(uv.y - 0.5) * 2.0, 2.0);
  color += vec3(0.25,0.35,0.45) * fresnel * 0.3;
  float foam = smoothstep(0.15, 0.22, abs(height)) * (1.0-depth);
  foam *= 0.5 + 0.5*sin(uv.x*60.0 + t*2.0 + noise(uv*12.0)*2.0);
  color += vec3(0.9,0.95,1.0) * foam * 0.18;
  
  if (hyperdrive > 0.5) {
    float c = checker(uv * 8.0);
    vec3 flagColor = mix(vec3(1.0), vec3(0.0), c);
    vec3 hyperColor = mix(vec3(1.0, 0.2, 0.2), vec3(1.0, 0.6, 0.3), 0.5 + 0.5*sin(t*2.0));
    color = mix(color, mix(hyperColor, flagColor, 0.7), 0.6);
  }
  
  gl_FragColor = vec4(color, 0.93);
}