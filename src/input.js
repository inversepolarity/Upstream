import { state } from './state.js';
import { JUMP_DURATION } from './constants.js';
import { init } from './engine.js';

window.addEventListener('keydown', (e) => {
  let k = e.key.toLowerCase();

  if (k === 'arrowleft' || k === 'a') state.inputLeft = true;
  if (k === 'arrowright' || k === 'd') state.inputRight = true;

  if (k === " ") {
    state.inputUp = true;
    state.speedMultiplier = 8;
    if (!state.hyperdrive) state.wasHyperdrive = false;
    state.hyperdrive = true;
  }

  if (k === 'arrowdown' || k === 's') {
    state.inputDown = true;
    state.speedMultiplier = 0.5;
  }

  if ((e.key === "w" || e.code === "ArrowUp") && !state.isJumping && !state.gameOver) {
    state.isJumping = true; 
    state.jumpTimer = JUMP_DURATION;
  }

  if (state.gameOver && k === 'r') {
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
});

window.addEventListener('keyup', (e) => {
  let k = e.key.toLowerCase();

  if (k === " ") { 
    state.inputUp = false; 
    state.speedMultiplier = 1; 

    if (state.hyperdrive) state.wasHyperdrive = true;
    state.hyperdrive = false;
  }

  if (k === 'arrowdown' || k === 's') {
    state.inputDown = false;
    state.speedMultiplier = 1;
  }
});

window.addEventListener('resize', () => {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
});
