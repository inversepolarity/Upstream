import * as THREE from 'three';
import { state } from './state.js';
import { getRiverInfoByDistance } from './river.js';
import { RIVER_WIDTH, OBSTACLE_COLORS } from './constants.js';

export function spawnObstacle() {
  let dist = state.playerDistance + 80 + Math.random()*180;
  let info = getRiverInfoByDistance(dist);
  let offset = (Math.random()-0.5)*(RIVER_WIDTH-3);
  let pos = info.point.clone().add(info.left.clone().multiplyScalar(offset));
  let shapes = ['box', 'sphere', 'cone', 'cylinder'];
  let shapeType = shapes[Math.floor(Math.random() * shapes.length)];
  let geometry, size;
  switch(shapeType) {
    case 'sphere': size = 1.5 + Math.random(); geometry = new THREE.SphereGeometry(size, 8, 8); break;
    case 'cone': size = 1.5 + Math.random(); geometry = new THREE.ConeGeometry(size, size * 1.5, 6); break;
    case 'cylinder': size = 1.2 + Math.random() * 0.8; geometry = new THREE.CylinderGeometry(size, size, size * 2, 8); break;
    default: size = 1.5 + Math.random(); geometry = new THREE.BoxGeometry(size, size, size);
  }
  let material = new THREE.MeshStandardMaterial({ 
    color: OBSTACLE_COLORS[Math.floor(Math.random() * OBSTACLE_COLORS.length)],
    emissive: 0x333333
  });
  let obstacle = new THREE.Mesh(geometry, material);
  obstacle.position.copy(pos); obstacle.position.y += size/2 + 0.3;
  obstacle.userData = { distance: dist, speed: 0.7 + Math.random() * 0.3, size: size, offset: offset };
  state.scene.add(obstacle); 
  state.obstacles.push(obstacle);
}