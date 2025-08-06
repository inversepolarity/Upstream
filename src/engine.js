import * as THREE from 'three';
import { state, resetState } from './state.js';
import { createStarfield, updateStarfield } from './backdrop.js';

import { PLAYER_SIZE, SPEED, STARFIELD_SPEED, JUMP_DURATION, JUMP_HEIGHT } from './constants.js';

import { createTrainCubes, updateTrainPosition } from './player.js';

import { spawnObstacle } from './enemies.js';
import { spawnGap } from './river.js';

import {
  generateInitialRiver,
  createRiverMesh,
  getRiverInfoByDistance,
  extendRiverIfNeeded,
  pruneRiverBehind,
  getWidthAt,
  distanceToT,
  getRiverPositionWithCurve,
} from './river.js';

import player_default_vertex from './shaders/player/default_vertex.glsl';
import player_default_frag from './shaders/player/default_frag.glsl';

export function init() {
  if (state.renderer && state.renderer.domElement && state.renderer.domElement.parentNode) {
    state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
  }

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x000011);
  state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  state.camera.position.set(0, 10, 10);

  if (!state.renderer) {
    let renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    state.renderer = renderer;
  }

  document.body.appendChild(state.renderer.domElement);

  createStarfield();
  state.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const light = new THREE.DirectionalLight(0xffffff, 0.5);
  light.position.set(5, 10, 7);
  state.scene.add(light);

  state.playerUniforms = { time: { value: 0 }, isJumping: { value: 0 } };
  state.playerShaderMaterial = new THREE.ShaderMaterial({
    uniforms: state.playerUniforms,
    vertexShader: player_default_vertex,
    fragmentShader: player_default_frag,
    transparent: true,
  });

  const geo = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
  state.player = new THREE.Mesh(geo, state.playerShaderMaterial);
  state.scene.add(state.player);

  createTrainCubes();
  state.trainCubes.forEach((cube) => {
    cube.visible = false;
  });

  state.gameOver = false;
  document.getElementById('gameover').style.display = 'none';
  resetState();

  generateInitialRiver();
  createRiverMesh();

  state.playerDistance = 10;
  state.playerOffset = 0;
  let info = getRiverInfoByDistance(state.playerDistance);
  state.player.position.copy(
    info.point.clone().add(info.left.clone().multiplyScalar(state.playerOffset))
  );
  state.player.position.y += PLAYER_SIZE / 2;
  state.camPos.copy(state.camera.position);
  state.camTarget.copy(info.point);

  // Reset all animation states
  state.isJumping = false;
  state.jumpTimer = 0;
  state.hyperdrive = false;
  state.wasHyperdrive = false;
  state.isFalling = false;
  state.fallTimer = 0;
  state.fallDirection = null;
}

export function animate() {
  if (!state.gameOver) {
    extendRiverIfNeeded();
    pruneRiverBehind();

    let moveDist = SPEED * state.speedMultiplier;
    state.playerDistance += moveDist;
    if (state.inputLeft) state.playerOffset += 0.21;
    if (state.inputRight) state.playerOffset -= 0.21;

    const buffer = 0.94; // or whatever value you want

    let dynamicWidth = getWidthAt(distanceToT(state.playerDistance));
    state.playerOffset = Math.max(
      -dynamicWidth / 2 + PLAYER_SIZE / 2 - buffer,
      Math.min(dynamicWidth / 2 - PLAYER_SIZE / 2 + buffer, state.playerOffset)
    );

    let info = getRiverInfoByDistance(state.playerDistance);

    // Calculate curved position on riverbed
    dynamicWidth = getWidthAt(distanceToT(state.playerDistance));
    let widthRatio = (state.playerOffset + dynamicWidth / 2) / dynamicWidth; // 0 to 1 from left to right
    let normalizedOffset = (widthRatio - 0.5) * 2; // -1 to 1

    let riverPos = getRiverPositionWithCurve(state.playerDistance, state.playerOffset);
    let playerPos = riverPos.position;
    info = riverPos.info;

    if (state.hyperdrive) {
      state.player.visible = false;
      state.trainCubes.forEach((cube) => (cube.visible = true));
      updateTrainPosition(info, info.tangent);
    } else {
      state.player.visible = true;
      state.trainCubes.forEach((cube) => (cube.visible = false));
      state.player.position.copy(playerPos);
      state.player.position.y += PLAYER_SIZE / 2;
    }

    if (state.isJumping) {
      state.jumpTimer--;
      let jumpPhase = 1 - Math.abs(state.jumpTimer - JUMP_DURATION / 2) / (JUMP_DURATION / 2);
      if (!state.hyperdrive) {
        state.player.position.y += JUMP_HEIGHT * jumpPhase;
        state.player.rotation.x = Math.PI * 2 * (1 - state.jumpTimer / JUMP_DURATION);
      }
      if (state.jumpTimer <= 0) {
        state.isJumping = false;
        state.jumpTimer = 0;
        if (!state.hyperdrive) state.player.rotation.x = 0;
      }
    } else if (!state.hyperdrive) {
      state.player.rotation.x = 0;
    }

    if (state.player.material.uniforms) {
      state.player.material.uniforms.time.value = performance.now() * 0.001;
      state.player.material.uniforms.isJumping.value = state.isJumping ? 1.0 : 0.0;
    }

    let tangent = info.tangent;
    if (tangent.dot(new THREE.Vector3(0, 0, -1)) < 0.7) {
      state.gracePeriod = 60;
      let turnAngle = Math.atan2(tangent.x, tangent.z);
      state.targetRotation = turnAngle * 0.8;
    }

    if (state.gracePeriod > 0) state.gracePeriod--;
    else state.targetRotation *= 0.95;

    state.cubeRotation += (state.targetRotation - state.cubeRotation) * 0.1;
    if (!state.hyperdrive) state.player.rotation.z = state.cubeRotation;

    state.obstacleSpawnTimer++;
    if (state.obstacleSpawnTimer > 180) {
      spawnObstacle();
      state.obstacleSpawnTimer = 0;
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      let obs = state.obstacles[i];
      obs.userData.distance -= obs.userData.speed;

      if (obs.userData.distance < state.playerDistance - 50) {
        state.scene.remove(obs);
        state.obstacles.splice(i, 1);
        continue;
      }

      // Use helper function for obstacle positioning
      let obsRiverPos = getRiverPositionWithCurve(obs.userData.distance, obs.userData.offset);
      obs.position.copy(obsRiverPos.position);
      obs.position.y += obs.userData.size / 2 + 0.3;

      obs.rotation.x += 0.01;
      obs.rotation.y += 0.01;

      let obsShouldFall = false;

      for (let g = 0; g < state.riverGaps.length; g++) {
        let gap = state.riverGaps[g];
        if (Math.abs(obs.userData.distance - gap.distance) < gap.width * 0.5) {
          obsShouldFall = true;
          break;
        }
      }

      let obsDynamicWidth = getWidthAt(distanceToT(obs.userData.distance));
      if (Math.abs(obs.userData.offset) > obsDynamicWidth / 2 - (obs.userData.size - 0.94)) {
        obsShouldFall = true;
      }

      if (obsShouldFall && !obs.userData.falling) {
        obs.userData.falling = true;
        obs.userData.fallTimer = 0;
        obs.userData.fallDirection = Math.random() > 0.5 ? 1 : -1;
      }

      if (obs.userData.falling) {
        obs.userData.fallTimer++;
        obs.position.x += obs.userData.fallDirection * obs.userData.fallTimer * 0.2;
        obs.position.y -= obs.userData.fallTimer * 0.3;
        obs.rotation.z += obs.userData.fallDirection * 0.3;
        obs.rotation.x += 0.1;
        obs.rotation.y += obs.userData.fallDirection * 0.05;

        if (obs.userData.fallTimer > 30) {
          state.scene.remove(obs);
          state.obstacles.splice(i, 1);
          continue;
        }
      } else {
        let dDist = Math.abs(state.playerDistance - obs.userData.distance);
        let offsetDist = Math.abs(state.playerOffset - obs.userData.offset);

        if (
          dDist < PLAYER_SIZE * 2 &&
          offsetDist < obs.userData.size + PLAYER_SIZE / 2 &&
          !state.isJumping
        ) {
          state.gameOver = true;
          document.getElementById('gameover').style.display = 'block';
        }
      }
    }

    state.gapSpawnTimer++;
    if (state.gapSpawnTimer > 320) {
      spawnGap();
      state.gapSpawnTimer = 0;
    }
    for (let i = state.riverGaps.length - 1; i >= 0; i--) {
      if (state.riverGaps[i].distance < state.playerDistance - 50) {
        if (state.riverGaps[i].edgeMesh) {
          for (let m of state.riverGaps[i].edgeMesh) {
            state.scene.remove(m);
            m.geometry.dispose();
            m.material.dispose();
          }
        }
        state.riverGaps.splice(i, 1);
        createRiverMesh();
      }
    }

    let lookAheadInfo = getRiverInfoByDistance(state.playerDistance + 30);
    let camGoal = playerPos
      .clone()
      .add(new THREE.Vector3(0, 8, 0))
      .add(tangent.clone().multiplyScalar(-12));
    state.camPos.lerp(camGoal, 0.08);
    state.camTarget.lerp(lookAheadInfo.point, 0.12);
    state.camera.position.copy(state.camPos);
    state.camera.lookAt(state.camTarget);

    updateStarfield(STARFIELD_SPEED, playerPos, tangent);

    if (state.riverShaderMaterial) {
      state.riverTime += 0.016;
      state.riverShaderMaterial.uniforms.time.value = state.riverTime;
      state.riverShaderMaterial.uniforms.hyperdrive.value = state.hyperdrive ? 1.0 : 0.0;
    }

    let shouldDie = false;

    for (let i = 0; i < state.riverGaps.length; i++) {
      if (
        Math.abs(state.playerDistance - state.riverGaps[i].distance) <
        state.riverGaps[i].width * 0.5
      ) {
        shouldDie = true;
        break;
      }
    }

    // Use helper for boundary calculations
    dynamicWidth = getWidthAt(distanceToT(state.playerDistance));
    let maxSafeOffset = dynamicWidth / 2 - (PLAYER_SIZE / 2 - 1);

    // Calculate curve steepness for boundary adjustment
    widthRatio = (state.playerOffset + dynamicWidth / 2) / dynamicWidth;
    normalizedOffset = (widthRatio - 0.5) * 2;
    let curveSteepness = Math.abs(normalizedOffset);
    let curvePenalty = curveSteepness > 0.7 ? (curveSteepness - 0.7) * 2 : 0;
    maxSafeOffset -= curvePenalty;

    if (Math.abs(state.playerOffset) > maxSafeOffset) {
      if (!state.isFalling) {
        state.isFalling = true;
        state.fallTimer = 0;
        state.fallDirection = state.playerOffset > 0 ? 1 : -1;
      }
    }
    if (shouldDie && !state.isJumping) {
      state.isFalling = true;
      state.fallTimer = 0;
      state.isGapFall = true; // New flag for gap falls
      document.getElementById('gameover').style.display = 'block';
    }

    if (Math.abs(state.playerOffset) > maxSafeOffset) {
      if (!state.isFalling) {
        state.isFalling = true;
        state.fallTimer = 0;
        state.fallDirection = state.playerOffset > 0 ? 1 : -1;
        state.isGapFall = false; // Side fall
      }
    }
    if (state.isFalling) {
      state.fallTimer++;

      // Determine fall direction (left or right)
      if (!state.fallDirection) {
        state.fallDirection = Math.random() > 0.5 ? 1 : -1; // 1 for right, -1 for left
      }

      // Dramatic fall phases
      const STUMBLE_DURATION = 12; // Extended stumble phase
      const LAUNCH_DURATION = 8; // Quick violent launch
      const FALL_START = STUMBLE_DURATION + LAUNCH_DURATION;

      // Initialize dramatic physics
      if (!state.fallPhysics) {
        state.fallPhysics = {
          stumbleIntensity: 1.0,
          launchPower: 0.8,
          velocityX: 0,
          velocityY: 0,
          spin: 0,
        };
      }

      if (!state.hyperdrive) {
        // PHASE 1: Stumbling at the edge (frames 1-12)
        if (state.fallTimer <= STUMBLE_DURATION) {
          let stumblePhase = state.fallTimer / STUMBLE_DURATION;
          let stumbleWobble = Math.sin(state.fallTimer * 0.8) * state.fallPhysics.stumbleIntensity;

          // Wobbling as it loses balance
          state.player.position.x += state.fallDirection * stumbleWobble * 0.15;
          state.player.position.y += Math.abs(stumbleWobble) * 0.05; // Slight bouncing

          // Increasingly dramatic rotation as it loses balance
          state.player.rotation.z = state.fallDirection * stumblePhase * 0.6;
          state.player.rotation.x = Math.sin(state.fallTimer * 0.5) * 0.2;
        }
        // PHASE 2: Violent launch off the edge (frames 13-20)
        else if (state.fallTimer <= FALL_START) {
          let launchPhase = (state.fallTimer - STUMBLE_DURATION) / LAUNCH_DURATION;
          let launchForce = Math.pow(launchPhase, 0.5); // Accelerating launch

          // Violent horizontal throw
          state.fallPhysics.velocityX =
            state.fallDirection * state.fallPhysics.launchPower * launchForce;
          state.fallPhysics.velocityY = 0.3 * (1 - launchPhase); // Initial upward momentum

          state.player.position.x += state.fallPhysics.velocityX;
          state.player.position.y += state.fallPhysics.velocityY;

          // Dramatic spinning during launch
          state.fallPhysics.spin += 0.4;
          state.player.rotation.z += state.fallDirection * state.fallPhysics.spin;
          state.player.rotation.x += state.fallPhysics.spin * 0.3;
          state.player.rotation.y += state.fallDirection * state.fallPhysics.spin * 0.2;
        }
        // PHASE 3: Gravity takes over (frame 21+)
        else {
          let fallTime = state.fallTimer - FALL_START;

          // Gravity and air resistance
          state.fallPhysics.velocityY -= 0.04 * fallTime; // Accelerating downward
          state.fallPhysics.velocityX *= 0.99; // Slight air resistance

          state.player.position.x += state.fallPhysics.velocityX;
          state.player.position.y += state.fallPhysics.velocityY;

          // Continue spinning but slower
          state.player.rotation.z += state.fallDirection * 0.2;
          state.player.rotation.x += 0.15;
          state.player.rotation.y += state.fallDirection * 0.1;
        }
      } else {
        // Train cubes dramatic cascade
        state.trainCubes.forEach((cube, index) => {
          const delay = index * 2; // Slower cascade for more drama
          if (state.fallTimer > delay) {
            const adjustedTimer = state.fallTimer - delay;

            // Initialize cube physics
            if (!cube.userData.fallPhysics) {
              cube.userData.fallPhysics = {
                stumbleIntensity: 0.8 + Math.random() * 0.4,
                launchPower: 0.6 + Math.random() * 0.4,
                velocityX: 0,
                velocityY: 0,
                spinRate: 0.3 + Math.random() * 0.2,
              };
            }

            // Same phases but with individual cube variation
            if (adjustedTimer <= STUMBLE_DURATION) {
              let stumblePhase = adjustedTimer / STUMBLE_DURATION;
              let stumbleWobble =
                Math.sin(adjustedTimer * 0.6) * cube.userData.fallPhysics.stumbleIntensity;

              cube.position.x += state.fallDirection * stumbleWobble * 0.12;
              cube.position.y += Math.abs(stumbleWobble) * 0.03;
              cube.rotation.z = state.fallDirection * stumblePhase * 0.5;
            } else if (adjustedTimer <= FALL_START) {
              let launchPhase = (adjustedTimer - STUMBLE_DURATION) / LAUNCH_DURATION;
              let launchForce = Math.pow(launchPhase, 0.4);

              cube.userData.fallPhysics.velocityX =
                state.fallDirection * cube.userData.fallPhysics.launchPower * launchForce;
              cube.userData.fallPhysics.velocityY = 0.2 * (1 - launchPhase);

              cube.position.x += cube.userData.fallPhysics.velocityX;
              cube.position.y += cube.userData.fallPhysics.velocityY;

              // Individual spinning
              cube.rotation.z += state.fallDirection * cube.userData.fallPhysics.spinRate * 2;
              cube.rotation.x += cube.userData.fallPhysics.spinRate;
              cube.rotation.y += state.fallDirection * cube.userData.fallPhysics.spinRate * 0.8;
            } else {
              let fallTime = adjustedTimer - FALL_START;

              cube.userData.fallPhysics.velocityY -= 0.03 * fallTime;
              cube.userData.fallPhysics.velocityX *= 0.99;

              cube.position.x += cube.userData.fallPhysics.velocityX;
              cube.position.y += cube.userData.fallPhysics.velocityY;

              cube.rotation.z += state.fallDirection * cube.userData.fallPhysics.spinRate;
              cube.rotation.x += cube.userData.fallPhysics.spinRate * 0.8;
              cube.rotation.y += state.fallDirection * cube.userData.fallPhysics.spinRate * 0.5;
            }
          }
        });
      }

      // Show game over after the full dramatic sequence
      if (state.fallTimer > 50) {
        state.gameOver = true;
        document.getElementById('gameover').style.display = 'block';
      }
    }
  }

  state.renderer.render(state.scene, state.camera);
  requestAnimationFrame(animate);
}
