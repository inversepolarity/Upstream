uniform float time;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    // Base metallic color
    vec3 baseColor = vec3(0.8, 0.85, 0.9);

    // Animated normal distortion for "liquid" effect
    float wave = sin(vPosition.x * 10.0 + time * 2.0)
               + cos(vPosition.y * 10.0 - time * 2.5)
               + sin(vPosition.z * 10.0 + time * 1.5);

    // Fake environment reflection (using normal and wave)
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - dot(vNormal, viewDir), 3.0);

    // Dynamic highlight
    float highlight = 0.5 + 0.5 * sin(time * 3.0 + vPosition.x * 20.0 + vPosition.y * 20.0);

    // Combine for metallic look
    vec3 color = baseColor * (0.7 + 0.3 * fresnel) + vec3(1.0) * highlight * 0.2 * fresnel;

    // Add some animated distortion to alpha for shimmer
    float alpha = 0.7 + 0.2 * sin(time * 4.0 + wave * 0.5);

    gl_FragColor = vec4(color, alpha);
}