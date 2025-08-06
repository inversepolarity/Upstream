
    uniform float time;
    uniform sampler2D textTexture;
    uniform float textAlpha;
    varying vec2 vUv;

    // Vibrant vapourwave palette
    vec3 vapourwaveRamp(float t) {
      vec3 pink = vec3(1.0, 0.2, 0.8);
      vec3 purple = vec3(0.6, 0.2, 1.0);
      vec3 cyan = vec3(0.0, 1.0, 1.0);
      vec3 blue = vec3(0.2, 0.4, 1.0);
      if (t < 0.33) return mix(pink, purple, t / 0.33);
      else if (t < 0.66) return mix(purple, cyan, (t-0.33)/0.33);
      else return mix(cyan, blue, (t-0.66)/0.34);
    }

    void main() {
      vec2 uv = vUv;
      vec4 text = texture2D(textTexture, uv);
      float textMask = text.a;
      if (textMask < 0.1) discard;

      // Stronger, animated color bands
      float band = sin(uv.y * 16.0 + time * 2.0 + uv.x * 8.0) * 0.5 + 0.5;
      band = pow(band, 1.5); // Sharper bands
      vec3 bandColor = vapourwaveRamp(band);

      // Metallic shine
      float shine = pow(sin(uv.x * 20.0 + time * 3.0) * 0.5 + 0.5, 8.0);
      float shine2 = pow(cos(uv.y * 30.0 - time * 2.0) * 0.5 + 0.5, 12.0);
      float specular = max(shine, shine2);

      // Flashy highlight color
      vec3 highlight = vec3(1.0, 0.95, 0.9);

      // Mix: mostly bandColor, but strong white highlights
      vec3 color = mix(bandColor, highlight, specular * 0.85);

      // Add a subtle moving gradient for extra flash
      float grad = 0.5 + 0.5 * sin(uv.x * 4.0 + time * 1.5);
      color = mix(color, vapourwaveRamp(1.0-grad), 0.25);

      // Edge glow for depth
      float edge = smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.85, uv.y);
      color += vec3(1.0, 0.7, 1.0) * (1.0 - edge) * 0.15;

      // Ensure minimum brightness and max vibrancy
      color = max(color, vec3(0.8));
      color = min(color, vec3(1.0));

      gl_FragColor = vec4(color, textMask * textAlpha);
    }