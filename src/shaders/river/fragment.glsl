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

float getHeight(vec2 uv, float t) {
  float wave1 = sin(uv.x * 18.0 + t * 1.5) * 0.08;
  float wave2 = sin(uv.x * 32.0 - t * 2.0) * 0.04;
  float wave3 = sin(uv.y * 24.0 + t * 2.5) * 0.06;
  float n1 = noise(uv * 8.0 + t * 0.5) * 0.08;
  float n2 = noise(uv * 16.0 - t * 0.8) * 0.04;
  float n3 = noise(uv * 32.0 + t * 1.2) * 0.02;
  return wave1 + wave2 + wave3 + n1 + n2 + n3;
}

float cloudyDither(vec2 uv) {
  float n1 = noise(uv * 32.0 + time * 0.1);
  float n2 = noise(uv * 64.0 - time * 0.15);
  float n3 = noise(uv * 128.0 + time * 0.08);
  return (n1 + n2 * 0.5 + n3 * 0.25) - 0.5;
}

void main() {
  vec2 uv = vUv;
  float t = time;
  float height = getHeight(uv, t);
  
  // Base color calculation
  vec3 deep = vec3(0.07, 0.22, 0.45);
  vec3 shallow = vec3(0.18, 0.55, 0.95);
  float depth = clamp(uv.y + height * 0.5, 0.0, 1.0);
  depth = floor(depth * 4.0 + cloudyDither(uv * 100.0) * 0.3) / 4.0;
  vec3 color = mix(deep, shallow, depth);
  
  // Noise overlay
  color = mix(color, vec3(0.1, 0.3, 0.5), 0.2 + 0.2*noise(uv*4.0 + t*0.2));
  
  // Fresnel effect - converted from conditional to multiplication
  float fresnel = pow(1.0 - abs(uv.y - 0.5) * 2.0, 2.0);
  float fresnelMask = float(fresnel > 0.3);
  color += vec3(0.25,0.35,0.45) * fresnelMask * 0.5;
  
  // Foam effect - converted from conditional to multiplication
  float foam = smoothstep(0.15, 0.22, abs(height)) * (1.0-depth);
  float foamMask = float(foam > 0.4);
  float foamPattern = float(sin(uv.x*60.0 + t*2.0 + noise(uv*12.0)*2.0) > 0.0);
  color += vec3(0.9,0.95,1.0) * foamMask * foamPattern * 0.3;
  
  // Outline calculation - unrolled loop for better prediction
  vec2 offset1 = vec2(0.003, 0.0);
  vec2 offset2 = vec2(0.00212, 0.00212);
  vec2 offset3 = vec2(0.0, 0.003);
  vec2 offset4 = vec2(-0.00212, 0.00212);
  vec2 offset5 = vec2(-0.003, 0.0);
  vec2 offset6 = vec2(-0.00212, -0.00212);
  vec2 offset7 = vec2(0.0, -0.003);
  vec2 offset8 = vec2(0.00212, -0.00212);
  
  float outline = abs(height - getHeight(uv + offset1, t));
  outline += abs(height - getHeight(uv + offset2, t));
  outline += abs(height - getHeight(uv + offset3, t));
  outline += abs(height - getHeight(uv + offset4, t));
  outline += abs(height - getHeight(uv + offset5, t));
  outline += abs(height - getHeight(uv + offset6, t));
  outline += abs(height - getHeight(uv + offset7, t));
  outline += abs(height - getHeight(uv + offset8, t));
  
  float outlineMask = float(outline * 0.125 > 0.02);
  color = mix(color, vec3(0.1, 0.2, 0.3), outlineMask * 0.8);
  
  // Hyperdrive effect - converted to branchless
  float hyperMask = float(hyperdrive > 0.5);
  float cx = fract(uv.x * 32.0);
  float cy = fract(uv.y * 32.0);
  float checkerPattern = float(cx > 0.5) + float(cy > 0.5);
  checkerPattern = 1.0 - mod(checkerPattern, 2.0);
  vec3 hyperColor = mix(vec3(1.0, 0.2, 0.2), vec3(1.0, 0.6, 0.3), 0.5 + 0.5*sin(t*2.0));
  vec3 flagColor = mix(vec3(1.0), vec3(0.0), checkerPattern);
  vec3 hyperEffect = mix(hyperColor, flagColor, 0.7);
  color = mix(color, mix(color, hyperEffect, 0.6), hyperMask);
  
  // Fade effect
  vec3 darkBlue = vec3(0.0, 0.0, 0.0667);
  float distFromCenter = abs(uv.x - 0.5) * 2.0;
  float fadeFactor = smoothstep(0.0, 1.0, 1.0 - distFromCenter);
  fadeFactor = floor(fadeFactor * 3.0 + cloudyDither(uv * 80.0) * 0.2) / 3.0;
  fadeFactor = 0.3 + fadeFactor * 0.7;
  color = mix(darkBlue, color, fadeFactor);
  
  gl_FragColor = vec4(color, 0.93);
}