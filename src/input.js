import { state } from './state.js';
import { JUMP_DURATION } from './constants.js';
import { init } from './engine.js';
import { hideNewGameOverlay } from './hud.js';

window.addEventListener('keydown', (e) => {
  let k = e.key.toLowerCase();
  if (state.gameOver && state.rpo == false) {
    state.obstacles.forEach((obs) => {
      state.scene.remove(obs);
      obs.geometry.dispose();
      obs.material.dispose();
    });

    state.riverMeshes.forEach((mesh) => {
      state.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });

    if (state.starfield) {
      state.scene.remove(state.starfield);
      state.starfield.geometry.dispose();
      state.starfield.material.dispose();
      state.starfield = null;
    }

    state.trainCubes.forEach((cube) => {
      state.scene.remove(cube);
      cube.geometry.dispose();
      cube.material.dispose();
    });

    state.trainCubes = [];

    state.riverGaps.forEach((gap) => {
      if (gap.edgeMesh)
        gap.edgeMesh.forEach((m) => {
          state.scene.remove(m);
          m.geometry.dispose();
          m.material.dispose();
        });
    });

    init();
  }

  if (k === ' ') {
    if (state.rpo && !state.gameOver) {
      state.inputUp = true;
      state.speedMultiplier = 8;
      if (!state.hyperdrive) state.wasHyperdrive = false;
      state.hyperdrive = true;
    }

    if (!state.gameOver && state.rpo == false) {
      state.rpo = true;
      hideNewGameOverlay();
    }
  }

  if (state.rpo) {
    if (k === 'arrowleft' || k === 'a') state.inputLeft = true;
    if (k === 'arrowright' || k === 'd') state.inputRight = true;
    if (k === 'arrowdown' || k === 's') {
      state.inputDown = true;
      state.speedMultiplier = 0.5;
    }

    if ((e.key === 'w' || e.code === 'ArrowUp') && !state.isJumping && !state.gameOver) {
      state.isJumping = true;
      state.jumpTimer = JUMP_DURATION;
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (!state.rpo) return;

  let k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') state.inputLeft = false;
  if (k === 'arrowright' || k === 'd') state.inputRight = false;

  if (k === ' ') {
    state.inputUp = false;
    state.speedMultiplier = 1;

    if (state.hyperdrive) state.wasHyperdrive = true;
    state.hyperdrive = false;
    if (state.gameOver && state.rpo == true) {
      state.rpo = false;
      init();
      // break;
      return;
    }
  }

  if (state.gameOver && state.rpo == true) {
    state.rpo = false;
  }

  if (k === 'arrowdown' || k === 's') {
    state.inputDown = false;
    state.speedMultiplier = 1;
  }
});

window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;

  // Update main camera
  state.camera.aspect = aspect;
  state.camera.updateProjectionMatrix();

  // Update HUD camera to maintain aspect ratio
  if (state.hudCamera) {
    const height = 5.625;
    const width = height * aspect;
    state.hudCamera.left = -width;
    state.hudCamera.right = width;
    state.hudCamera.updateProjectionMatrix();

    // Reposition score to stay in top left
    if (state.scoreMesh) {
      state.scoreMesh.position.set(-width + 4, height - 1, 0);
    }
  }

  state.renderer.setSize(window.innerWidth, window.innerHeight);
});
