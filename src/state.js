import * as THREE from 'three';

export const state = {
  scene: undefined,
  camera: undefined,
  renderer: undefined,

  riverMeshes: [],
  riverSpline: undefined,
  riverControlPoints: [],
  riverLengths: [],
  riverTotalLength: 0,

  player: undefined,
  playerDistance: 0,
  playerOffset: 0,
  gameOver: false,

  inputLeft: false,
  inputRight: false,
  inputUp: false,
  inputDown: false,

  gracePeriod: 0,
  cubeRotation: 0,
  targetRotation: 0,

  obstacles: [],
  obstacleSpawnTimer: 0,
  speedMultiplier: 1,

  camPos: new THREE.Vector3(),
  camTarget: new THREE.Vector3(),

  starfield: undefined,
  starPositions: undefined,
  starData: undefined,

  starTrails: undefined,
  starTrailPositions: undefined,
  hyperdrive: false,
  wasHyperdrive: false,

  riverGaps: [],
  gapSpawnTimer: 0,
  isJumping: false,
  jumpTimer: 0,

  riverShaderMaterial: undefined,
  riverTime: 0,

  playerUniforms: undefined,
  playerShaderMaterial: undefined,

  trainCubes: []
};