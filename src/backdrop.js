import * as THREE from 'three';
import {
  STARFIELD_MIN_RADIUS,
  STARFIELD_RADIUS,
  STARFIELD_DEPTH,
  STAR_COUNT,
} from './constants.js';
import { state } from './state.js';

export function createStarfield() {
  state.starPositions = new Float32Array(STAR_COUNT * 3);
  state.starData = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    let angle = Math.random() * Math.PI * 2;
    let radius = STARFIELD_MIN_RADIUS + Math.random() * (STARFIELD_RADIUS - STARFIELD_MIN_RADIUS);
    let z = -Math.random() * STARFIELD_DEPTH;
    let x = Math.cos(angle) * radius,
      y = Math.sin(angle) * radius;
    state.starPositions.set([x, y, z], i * 3);
    state.starData.push({ angle, radius, z, prev: { x, y, z } });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(state.starPositions, 3));
  const material = new THREE.PointsMaterial({
    size: 1.1,
    sizeAttenuation: true,
    color: 0xffffff,
    opacity: 0.85,
    transparent: true,
    depthWrite: false,
  });
  state.starfield = new THREE.Points(geometry, material);
  state.scene.add(state.starfield);
}

export function updateStarfield(forwardSpeed, playerPos, riverTangent) {
  if (state.wasHyperdrive && !state.hyperdrive) {
    for (let i = 0; i < STAR_COUNT; i++) {
      let angle = Math.random() * Math.PI * 2;
      let radius = STARFIELD_MIN_RADIUS + Math.random() * (STARFIELD_RADIUS - STARFIELD_MIN_RADIUS);
      let z = -Math.random() * STARFIELD_DEPTH;
      Object.assign(state.starData[i], { angle, radius, z });
    }
    state.wasHyperdrive = false;
  }

  let speedMult = state.hyperdrive ? 50 : 1;
  for (let i = 0; i < STAR_COUNT; i++) {
    state.starData[i].z += forwardSpeed * state.speedMultiplier * speedMult;
    if (state.starData[i].z > 5) {
      let angle = Math.random() * Math.PI * 2;
      let radius = STARFIELD_MIN_RADIUS + Math.random() * (STARFIELD_RADIUS - STARFIELD_MIN_RADIUS);
      let z = -STARFIELD_DEPTH + Math.random() * -30;
      Object.assign(state.starData[i], { angle, radius, z });
    }
    let x = Math.cos(state.starData[i].angle) * state.starData[i].radius;
    let y = Math.sin(state.starData[i].angle) * state.starData[i].radius;
    let z = state.starData[i].z;
    state.starPositions.set([x, y, z], i * 3);
  }
  state.starfield.geometry.attributes.position.needsUpdate = true;
  state.starfield.position.copy(playerPos);

  let up = new THREE.Vector3(0, 1, 0),
    m = new THREE.Matrix4();
  m.lookAt(new THREE.Vector3(0, 0, 0), riverTangent, up);
  state.starfield.setRotationFromMatrix(m);
  state.starfield.position.copy(playerPos);

  state.starfield.material.opacity = state.hyperdrive ? 0.1 : 0.85;
}
