varying vec2 vUv;
uniform float time, hyperdrive;
uniform sampler2D noiseTex;

float texNoise(vec2 uv) {
    return texture2D(noiseTex, fract(uv)).r;
}


vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float perlinNoise(vec2 v) {
        vec2 uv = vUv;

    vec2 i = floor(uv);
    vec2 f = fract(uv);
    f = f*f*(3.0 - 2.0*f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float getRiverFlow(vec2 uv, float t) {
    float f1 = sin(uv.x * 12.0 + uv.y * 3.0 - t * 2.5) * 0.06;
    float f2 = sin(uv.x * 20.0 + uv.y * 5.0 - t * 3.0) * 0.03;
    float bankDist = abs(uv.x - 0.5) * 2.0;
    float turb = perlinNoise(vec2(uv.x * 15.0, uv.y * 8.0 - t * 2.0)) * 0.04 * bankDist;
    return f1 + f2 + turb;
}

float getHeight(vec2 uv, float t) {
    return getRiverFlow(uv, t);
}

float cloudyDither(vec2 uv) {
    float t1 = time * 0.1, t2 = time * -0.15, t3 = time * 0.08;
    return perlinNoise(uv * 32.0 + t1) +
           perlinNoise(uv * 64.0 + t2) * 0.5 +
           perlinNoise(uv * 128.0 + t3) * 0.25 - 0.5;
}

void main() {
    vec2 uv = vUv;
    float t = time;

    float bankDist = abs(uv.x - 0.5) * 2.0;
    float height = getRiverFlow(uv, t);
    float depth = clamp(1.0 - bankDist + height * 0.5, 0.0, 1.0);

    vec3 blues[5];
    blues[0] = vec3(0.05, 0.12, 0.25);
    blues[1] = vec3(0.08, 0.22, 0.45);
    blues[2] = vec3(0.12, 0.32, 0.65);
    blues[3] = vec3(0.18, 0.44, 0.85);
    blues[4] = vec3(0.22, 0.55, 1.00);

float dither = texNoise(uv * 0.1 + t * 0.01);
    int level = int(clamp(floor(depth * 5.0 + dither), 0.0, 4.0));
    vec3 color = blues[4 - level];

    color = mix(color, vec3(0.10, 0.22, 0.45), 0.18 + 0.18 * perlinNoise(uv * 4.0 + t * 0.2));

    float fresnel = pow(1.0 - abs(uv.y - 0.5) * 2.0, 2.0);
    color += vec3(0.18, 0.32, 0.45) * step(0.3, fresnel) * 0.5;

    float foam = smoothstep(0.15, 0.22, abs(height)) * (1.0 - depth);
    float foamMask = step(0.4, foam);
    float foamPattern = step(0.0, sin(uv.x * 60.0 + t * 2.0 + perlinNoise(uv * 12.0) * 2.0));
    color += vec3(0.85, 0.95, 1.0) * foamMask * foamPattern * 0.3;

    float outline = 0.0;
    for (int i = 0; i < 8; ++i) {
        vec2 offs = 0.003 * vec2(cos(6.2831 * float(i)/8.0), sin(6.2831 * float(i)/8.0));
        outline += abs(height - getRiverFlow(uv + offs, t));
    }
    float outlineMask = step(0.02, outline * 0.125);
    color = mix(color, vec3(0.08, 0.16, 0.22), outlineMask * 0.8);

    if (hyperdrive > 0.5) {
        float checker = mod(float(fract(uv.x * 32.0) > 0.5) + float(fract(uv.y * 32.0) > 0.5), 2.0);
        vec3 hyperColor = mix(vec3(0.8, 0.95, 1.0), vec3(0.4, 0.7, 1.0), 0.5 + 0.5 * sin(t * 2.0));
        vec3 hyperFX = mix(hyperColor, vec3(1.0 - checker), 0.7);
        color = mix(color, mix(color, hyperFX, 0.6), 1.0);
    }

    float fade = 1.0 - bankDist;
    fade = floor(fade * 3.0 + cloudyDither(uv * 80.0) * 0.2) / 3.0;
    color = mix(vec3(0.0, 0.0, 0.0667), color, 0.3 + fade * 0.7);

    gl_FragColor = vec4(color, 0.93);
}
