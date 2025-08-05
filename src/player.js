import * as THREE from 'three';
import { state } from './state.js';
import { PLAYER_SIZE, JUMP_DURATION, JUMP_HEIGHT  } from './constants.js';
import { getRiverPositionWithCurve, getRiverInfoByDistance, getWidthAt, distanceToT  } from './river.js';

import player_super_vertex from './shaders/player/superpos_vertex.glsl';
import player_super_frag from './shaders/player/superpos_frag.glsl';

export function createTrainCubes() {
  state.trainCubes = [];
  const geo = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);

  for (let i = 0; i < 5; i++) {
    let material;
    if (i === 4) {
      material = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: player_super_vertex,
        fragmentShader: player_super_frag,
        transparent: true,
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
  const CUBE_SPACING = 3;
  
  state.trainCubes.forEach((cube, index) => {
    let cubeDistance = state.playerDistance - (index + 1) * CUBE_SPACING;
    
    // Use helper function for train cube positioning
    let cubeRiverPos = getRiverPositionWithCurve(cubeDistance, state.playerOffset);
    
    cube.position.copy(cubeRiverPos.position);
    cube.position.y += PLAYER_SIZE/2;
    
    // Align with river direction
    let cubeForward = cubeRiverPos.info.tangent;
    cube.lookAt(cube.position.clone().add(cubeForward));
  });
}
