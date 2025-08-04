import * as THREE from 'three';
import { state } from './state.js';
import { PLAYER_SIZE, JUMP_DURATION, JUMP_HEIGHT  } from './constants.js';
import { getRiverInfoByDistance } from './river.js';

export function createTrainCubes() {
  state.trainCubes = [];
  const geo = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
  
  for (let i = 0; i < 5; i++) {
    let material;
    if (i === 4) {
      material = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: `
          varying vec3 vPosition;
          void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `,
        fragmentShader: `
          uniform float time;
          varying vec3 vPosition;
          void main() {
            vec3 color = vec3(0.5, 0.8, 1.0);
            float alpha = 0.3 + 0.2 * sin(time * 3.0);
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true
      });
    } else {
      material = state.playerShaderMaterial.clone();
    }
    let cube = new THREE.Mesh(geo, material);
    state.trainCubes.push(cube);
    state.scene.add(cube);
    cube.visible = false;
  }
}

export function updateTrainPosition(info, tangent) {
  let spacing = PLAYER_SIZE * 1.8;
  for (let i = 0; i < state.trainCubes.length; i++) {
    let cube = state.trainCubes[i];
    let offset = -spacing * i;
    let trainDistance = state.playerDistance + offset;
    let trainInfo = getRiverInfoByDistance(trainDistance);
    let trainPos = trainInfo.point.clone().add(trainInfo.left.clone().multiplyScalar(state.playerOffset));
    cube.position.copy(trainPos);
    cube.position.y += PLAYER_SIZE/2;
    
    if (state.isJumping) {
      let jumpPhase = 1 - Math.abs(state.jumpTimer - JUMP_DURATION/2) / (JUMP_DURATION/2);
      cube.position.y += JUMP_HEIGHT * jumpPhase;
      cube.rotation.x = Math.PI * 2 * (1 - state.jumpTimer / JUMP_DURATION);
    } else {
      cube.rotation.x = 0;
    }
    
    cube.rotation.z = state.cubeRotation;
    
    if (i === 4 && cube.material.uniforms) {
      cube.material.uniforms.time.value = performance.now() * 0.001;
    }
  }
}