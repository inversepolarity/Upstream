import * as THREE from 'three';
import { state, resetState } from './state.js';
import { createStarfield, updateStarfield } from './backdrop.js';
import {  PLAYER_SIZE, 
          SPEED, 
          RIVER_WIDTH, 
          STARFIELD_SPEED, 
          JUMP_DURATION, 
          JUMP_HEIGHT  } from './constants.js';
import { createTrainCubes, updateTrainPosition  } from './player.js';
import { spawnObstacle } from './enemies.js';
import { spawnGap  } from './river.js';
import {  isOnRiver, 
          generateInitialRiver, 
          createRiverMesh, 
          getRiverInfoByDistance, 
          extendRiverIfNeeded, 
          pruneRiverBehind } from './river.js';

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
  light.position.set(5, 10, 7); state.scene.add(light);

  state.playerUniforms = { time: { value: 0 }, isJumping: { value: 0 } };
  state.playerShaderMaterial = new THREE.ShaderMaterial({
    uniforms: state.playerUniforms,
    vertexShader: player_default_vertex,
    fragmentShader: player_default_frag,
    transparent: true
  });

  const geo = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
  state.player = new THREE.Mesh(geo, state.playerShaderMaterial);
  state.scene.add(state.player);

  createTrainCubes();
  state.trainCubes.forEach(cube => {
    cube.visible = false; 
  });

  state.gameOver = false; 
  document.getElementById("gameover").style.display = "none";
  resetState();
  
  generateInitialRiver(); 
  createRiverMesh();

  state.playerDistance = 10; state.playerOffset = 0;
  let info = getRiverInfoByDistance(state.playerDistance);
  state.player.position.copy(info.point.clone().add(info.left.clone().multiplyScalar(state.playerOffset)));
  state.player.position.y += PLAYER_SIZE/2;
  state.camPos.copy(state.camera.position); state.camTarget.copy(info.point);

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
    extendRiverIfNeeded(); pruneRiverBehind();

    let moveDist = SPEED * state.speedMultiplier;
    state.playerDistance += moveDist;
    if (state.inputLeft) state.playerOffset += 0.21;
    if (state.inputRight) state.playerOffset -= 0.21;

    const buffer = 0.94; // or whatever value you want

    state.playerOffset = Math.max(
      -RIVER_WIDTH/2 + PLAYER_SIZE/2 - buffer,
      Math.min(RIVER_WIDTH/2 - PLAYER_SIZE/2 + buffer, state.playerOffset)
    );

    let info = getRiverInfoByDistance(state.playerDistance);
    let playerPos = info.point.clone().add(info.left.clone().multiplyScalar(state.playerOffset));
    
    if (state.hyperdrive) {
      state.player.visible = false;
      state.trainCubes.forEach(cube => cube.visible = true);
      updateTrainPosition(info, info.tangent);
    } else {
      state.player.visible = true;
      state.trainCubes.forEach(cube => cube.visible = false);
      state.player.position.copy(playerPos); 
      state.player.position.y += PLAYER_SIZE/2;
    }

    if (state.isJumping) {
      state.jumpTimer--;
      let jumpPhase = 1 - Math.abs(state.jumpTimer - JUMP_DURATION/2) / (JUMP_DURATION/2);
      if (!state.hyperdrive) {
        state.player.position.y += JUMP_HEIGHT * jumpPhase;
        state.player.rotation.x = Math.PI * 2 * (1 - state.jumpTimer / JUMP_DURATION);
      }
      if (state.jumpTimer <= 0) { 
        state.isJumping = false; state.jumpTimer = 0; 
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
    if (tangent.dot(new THREE.Vector3(0,0,-1)) < 0.7) {
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
      spawnObstacle(); state.obstacleSpawnTimer = 0; 
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      let obs = state.obstacles[i];
      obs.userData.distance -= obs.userData.speed;
      
      if (obs.userData.distance < state.playerDistance - 50) {
        state.scene.remove(obs); state.obstacles.splice(i, 1); continue;
      }

      let obsInfo = getRiverInfoByDistance(obs.userData.distance);
      obs.position.copy(obsInfo.point.clone().add(obsInfo.left.clone().multiplyScalar(obs.userData.offset)));
      
      obs.position.y += obs.userData.size/2 + 0.3;
      obs.rotation.x += 0.01; obs.rotation.y += 0.01;

      let dDist = Math.abs(state.playerDistance - obs.userData.distance);
      let offsetDist = Math.abs(state.playerOffset - obs.userData.offset);
      
      if (dDist < PLAYER_SIZE*2 && offsetDist < obs.userData.size + PLAYER_SIZE/2 && !state.isJumping) {
        state.gameOver = true; 
        document.getElementById("gameover").style.display = "block"; 
        // return;
      }
    }

    state.gapSpawnTimer++;
    if (state.gapSpawnTimer > 320) { spawnGap(); state.gapSpawnTimer = 0; }
    for (let i = state.riverGaps.length - 1; i >= 0; i--) {
      if (state.riverGaps[i].distance < state.playerDistance - 50) {
        if (state.riverGaps[i].edgeMesh) {
          for (let m of state.riverGaps[i].edgeMesh) {
            state.scene.remove(m); m.geometry.dispose(); m.material.dispose();
          }
        }
        state.riverGaps.splice(i, 1); createRiverMesh();
      }
    }

    let lookAheadInfo = getRiverInfoByDistance(state.playerDistance + 30);
    let camGoal = playerPos.clone().add(new THREE.Vector3(0, 8, 0)).add(tangent.clone().multiplyScalar(-12));
    state.camPos.lerp(camGoal, 0.08); state.camTarget.lerp(lookAheadInfo.point, 0.12);
    state.camera.position.copy(state.camPos); state.camera.lookAt(state.camTarget);

    updateStarfield(STARFIELD_SPEED, playerPos, tangent);

    if (state.riverShaderMaterial) {
      state.riverTime += 0.016;
      state.riverShaderMaterial.uniforms.time.value = state.riverTime;
      state.riverShaderMaterial.uniforms.hyperdrive.value = state.hyperdrive ? 1.0 : 0.0;
    }

    let shouldDie = false;

    // Check gaps
    for (let i = 0; i < state.riverGaps.length; i++) {
      if (Math.abs(state.playerDistance - state.riverGaps[i].distance) < state.riverGaps[i].width * 0.5) {
        shouldDie = true;
        break;
      }
    }

    // Check river edges  
    if (Math.abs(state.playerOffset) > RIVER_WIDTH/2 - (PLAYER_SIZE-0.94)) {
      if (!state.isFalling) {
        state.isFalling = true;
        state.fallTimer = 0;
      }
    }

    if (shouldDie && !state.isJumping) {
        state.isFalling = true;
        state.fallTimer = 0;
      document.getElementById("gameover").style.display = "block";
    }

    if (state.isFalling) {
      state.fallTimer++;
      
      // Determine fall direction (left or right)
      if (!state.fallDirection) {
        state.fallDirection = Math.random() > 0.5 ? 1 : -1; // 1 for right, -1 for left
      }
      
      // Spinning fall off the track with sinking
      if (!state.hyperdrive) {
        // Player spins off to the side
        state.player.position.x += state.fallDirection * state.fallTimer * 0.2;
        
        // Accelerating downward fall
        state.player.position.y -= state.fallTimer * 0.3; // Increased from 0.1 for faster sinking
        
        // Rotate as if rolling off the track
        state.player.rotation.z += state.fallDirection * 0.3;
        state.player.rotation.x += 0.1;
        state.player.rotation.y += state.fallDirection * 0.05;
        
      } else {
        // Train cubes cascade off the track
        state.trainCubes.forEach((cube, index) => {
          // Staggered falling for domino effect
          const delay = index * 1.5;
          if (state.fallTimer > delay) {
            const adjustedTimer = state.fallTimer - delay;
            
            // Fall off to the side
            cube.position.x += state.fallDirection * adjustedTimer * 0.2;
            
            // Accelerating downward fall
            cube.position.y -= adjustedTimer * 0.3; // Increased for faster sinking
            
            // Rolling rotation
            cube.rotation.z += state.fallDirection * 0.3;
            cube.rotation.x += 0.1;
            cube.rotation.y += state.fallDirection * 0.05;
          }
        });
      }
      
      // Show game over after falling for a bit
      if (state.fallTimer > 30) {
        state.gameOver = true;
        document.getElementById("gameover").style.display = "block";
      }
    }
  }

  state.renderer.render(state.scene, state.camera);
  requestAnimationFrame(animate);
}