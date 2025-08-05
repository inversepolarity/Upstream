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

  trainCubes: [],
  isFalling: false,
};

export function resetState() {
  console.log('reset state');
  // Game state
  state.gameOver = false;
  state.isFalling = false;

  // Player state
  state.playerDistance = 0;
  state.playerOffset = 0;
  state.isJumping = false;
  state.jumpTimer = 0;
  state.cubeRotation = 0;
  state.targetRotation = 0;
  state.gracePeriod = 0;

  // Input state
  state.inputLeft = false;
  state.inputRight = false;
  state.inputUp = false;
  state.inputDown = false;

  // Movement state
  state.speedMultiplier = 1;

  if (state.hyperdrive) {
    state.trainCubes.length = 0;
  }

  state.hyperdrive = false;
  state.wasHyperdrive = false;

  // Obstacles and gaps
  state.obstacles = [];
  state.obstacleSpawnTimer = 0;
  state.riverGaps = [];
  state.gapSpawnTimer = 0;

  // River state
  state.riverTime = 0;

  // Clear arrays
  state.obstacles.length = 0;
  state.riverGaps.length = 0;
  state.riverMeshes.length = 0;
  state.riverControlPoints.length = 0;
  state.riverLengths.length = 0;
  state.riverTotalLength = 0;
  
  // Camera positions
  state.camPos = new THREE.Vector3();
  state.camTarget = new THREE.Vector3();

  // Note: We don't reset these as they'll be recreated in init():
  // - scene, camera, renderer
  // - riverSpline
  // - player
  // - starfield, starPositions, starData
  // - starTrails, starTrailPositions
  // - riverShaderMaterial
  // - playerUniforms, playerShaderMaterial

  // Add any missing state that might have been added during gameplay
  state.fallTimer = 0;
  state.fallDirection = null;
}
