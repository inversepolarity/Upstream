import * as THREE from 'three';
import { state, resetState } from './state.js';

import ui_vertex from './shaders/ui/vertex.glsl';
import ui_frag from './shaders/ui/fragment.glsl';

const liquidMetalShader = {
  uniforms: {
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(512, 128) },
    textTexture: { value: null },
    textAlpha: { value: 1.0 },
  },
  vertexShader: ui_vertex,
  fragmentShader: ui_frag,
};

export function updateScoreDisplay() {
  const ctx = state.scoreContext;
  const canvas = state.scoreCanvas;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set text properties for mask
  ctx.font = '24px sans-serif';

  // Format score to 10 decimal places
  const scoreText = `${state.displayScore.toFixed(10)}`;

  // Draw text
  ctx.fillText(scoreText, canvas.width / 20, canvas.height / 7.7);

  // Update texture
  state.scoreTexture.needsUpdate = true;

  // Update shader time
  if (state.scoreMaterial) {
    state.scoreMaterial.uniforms.time.value = performance.now() * 0.001;
  }
}

export function gameOverDisplay() {
  // If overlay already exists, do nothing
  let existing = document.getElementById('gameover-overlay');
  if (existing) return;

  // Create a new canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'gameover-overlay';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  canvas.style.opacity = '0'; // Start transparent
  canvas.style.transition = 'opacity 0.8s cubic-bezier(.4,0,.2,1)';

  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Minimal reddish-orange transparent background
  ctx.fillStyle = 'rgba(91, 44, 44, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Minimal, wide, centered text
  const fontSize = Math.floor(canvas.width * 0.05);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff8383';

  ctx.fillText('G    A    M    E        O    V    E    R', canvas.width / 2, canvas.height / 2.25);
  // Restart instruction text
  const restartFontSize = Math.floor(fontSize * 0.25);
  ctx.font = `${restartFontSize}px sans-serif`;
  ctx.fillStyle = '#ff8383';
  ctx.fillText(
    'P    R    E    S    S        A    N    Y        K    E    Y        /        L    O    N    G        T    A    P        T    O        R    E    S    T    A    R    T',
    canvas.width / 2,
    canvas.height / 2 + fontSize * 0.8
  );
  
  // Fade in with CSS after a tick
  requestAnimationFrame(() => {
    canvas.style.opacity = '1';
  });
}

export function newGameDisplay() {
  // If overlay already exists, do nothing
  let existing = document.getElementById('gameover-overlay');
  if (existing) return;

  // Create a new canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'gameover-overlay';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  canvas.style.opacity = '0'; // Start transparent
  canvas.style.transition = 'opacity 0.8s cubic-bezier(.4,0,.2,1)';

  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Minimal reddish-orange transparent background
  ctx.fillStyle = 'rgba(91, 44, 44, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Minimal, wide, centered text
  const fontSize = Math.floor(canvas.width * 0.05);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff8383';

  ctx.fillText(
    'U       P       S       T       R       E       A       M',
    canvas.width / 2,
    canvas.height / 2.25
  );
  // Restart instruction text
  const restartFontSize = Math.floor(fontSize * 0.25);
  ctx.font = `${restartFontSize}px sans-serif`;
  ctx.fillStyle = '#ff8383';
  ctx.fillText(
    'S    P    A    C    E        /        L    O    N    G        T    A    P        T    O        S    T    A    R    T',
    canvas.width / 2,
    canvas.height / 2 + fontSize * 0.8
  );
  // Fade in with CSS after a tick
  requestAnimationFrame(() => {
    canvas.style.opacity = '1';
  });
}

export function hideGameOverOverlay() {
  let old = document.getElementById('gameover-overlay');
  if (old) old.remove();
}

export function hideNewGameOverlay() {
  let old = document.getElementById('gameover-overlay');
  if (old) old.remove();
}

export function updateScore() {
  if (state.rpo && !state.gameOver && state.score !== undefined) {
    // Calculate the difference between target and displayed score
    const diff = state.score - state.displayScore;

    // Smooth acceleration/deceleration (scaled down by 60x)
    const acceleration = diff * 0.001667; // 0.1 / 60
    state.scoreVelocity = state.scoreVelocity * 0.9983 + acceleration * 0.001667; // 0.9^(1/60) ≈ 0.9983, 0.1/60

    // Add one smallest unit per frame (this stays the same as it's already per-frame)
    let smallestUnit = 0.0000000001;
    if (state.hyperdrive) {
      state.displayScore += state.scoreVelocity + smallestUnit + 1;
    } else {
      state.displayScore += state.scoreVelocity + smallestUnit;
    }

    // Ensure we don't overshoot
    if (Math.abs(diff) < smallestUnit * 10) {
      state.displayScore = state.score;
    }

    updateScoreDisplay();
  }
}

export function initScoreState() {
  state.score = state.score || 0;
  state.displayScore = state.displayScore || 0;
  state.scoreVelocity = state.scoreVelocity || 0;
}

export function createScoreDisplay() {
  // Create render target for score text
  const renderTarget = new THREE.WebGLRenderTarget(512, 128);

  // Create scene for rendering text
  const textScene = new THREE.Scene();
  const textCamera = new THREE.OrthographicCamera(-256, 256, 64, -64, 0.1, 10);
  textCamera.position.z = 5;

  // Create canvas for text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;

  // Create texture from canvas
  const textTexture = new THREE.CanvasTexture(canvas);

  // Create plane for score display with liquid metal shader
  const scoreMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...liquidMetalShader.uniforms,
      textTexture: { value: textTexture },
      textAlpha: { value: 1.0 },
    },
    vertexShader: liquidMetalShader.vertexShader,
    fragmentShader: liquidMetalShader.fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const scoreGeometry = new THREE.PlaneGeometry(8, 2);
  const scoreMesh = new THREE.Mesh(scoreGeometry, scoreMaterial);

  // Position in top left of screen
  scoreMesh.position.set(-6, 4, 0);

  // Create HUD scene and camera
  state.hudScene = new THREE.Scene();
  state.hudCamera = new THREE.OrthographicCamera(
    -10,
    10, // left, right
    5.625,
    -5.625, // top, bottom (16:9 aspect)
    0.1,
    10
  );
  state.hudCamera.position.z = 5;
  state.hudScene.add(scoreMesh);

  // Store references
  state.scoreCanvas = canvas;
  state.scoreContext = context;
  state.scoreTexture = textTexture;
  state.scoreMaterial = scoreMaterial;
  state.scoreMesh = scoreMesh;

  // Initialize score tracking
  state.displayScore = 0;
  state.scoreVelocity = 0;

  updateScoreDisplay();
}
