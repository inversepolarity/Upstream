function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000011);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 10, 10);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  createStarfield();
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const light = new THREE.DirectionalLight(0xffffff, 0.5);
  light.position.set(5, 10, 7); scene.add(light);

  playerUniforms = { time: { value: 0 }, isJumping: { value: 0 } };
  playerShaderMaterial = new THREE.ShaderMaterial({
    uniforms: playerUniforms,
    vertexShader: `
      varying vec3 vPosition;
      void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform float time, isJumping;
      varying vec3 vPosition;
      float checker(vec2 uv) {
        float cx = step(0.5, fract(uv.x * 4.0));
        float cy = step(0.5, fract(uv.y * 4.0));
        return mod(cx + cy, 2.0);
      }
      void main() {
        vec2 uv = abs(vPosition.xy); uv = mod(uv, 1.0);
        float glow = 0.5 + 0.5 * exp(-dot(vPosition.xy, vPosition.xy) * 1.5);
        vec3 baseColor = mix(vec3(1.0, 0.2, 0.2), vec3(1.0, 0.6, 0.3), 0.5 + 0.5*sin(time*2.0));
        float c = checker(uv);
        vec3 flagColor = mix(vec3(1.0), vec3(0.0), c);
        vec3 color = mix(baseColor, flagColor, isJumping);
        color += vec3(1.0,0.9,0.5) * glow * 0.35;
        gl_FragColor = vec4(color, 0.93);
      }
    `,
    transparent: true
  });

  const geo = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
  player = new THREE.Mesh(geo, playerShaderMaterial);
  scene.add(player);

  createTrainCubes();

  gameOver = false; document.getElementById("gameover").style.display = "none";
  cubeRotation = 0; targetRotation = 0; obstacles = []; obstacleSpawnTimer = 0; speedMultiplier = 1;
  riverGaps = []; gapSpawnTimer = 0; isJumping = false; jumpTimer = 0; hyperdrive = false;
  generateInitialRiver(); createRiverMesh();

  playerDistance = 10; playerOffset = 0;
  let info = getRiverInfoByDistance(playerDistance);
  player.position.copy(info.point.clone().add(info.left.clone().multiplyScalar(playerOffset)));
  player.position.y += PLAYER_SIZE/2;
  camPos.copy(camera.position); camTarget.copy(info.point);
}

function animate() {
  if (gameOver) return;
  extendRiverIfNeeded(); pruneRiverBehind();

  let moveDist = SPEED * speedMultiplier;
  playerDistance += moveDist;
  if (inputLeft) playerOffset += 0.18;
  if (inputRight) playerOffset -= 0.18;
  playerOffset = Math.max(-RIVER_WIDTH/2 + PLAYER_SIZE/2, Math.min(RIVER_WIDTH/2 - PLAYER_SIZE/2, playerOffset));
  let info = getRiverInfoByDistance(playerDistance);
  let playerPos = info.point.clone().add(info.left.clone().multiplyScalar(playerOffset));
  
  if (hyperdrive) {
    player.visible = false;
    trainCubes.forEach(cube => cube.visible = true);
    updateTrainPosition(info, info.tangent);
  } else {
    player.visible = true;
    trainCubes.forEach(cube => cube.visible = false);
    player.position.copy(playerPos); 
    player.position.y += PLAYER_SIZE/2;
  }

  if (isJumping) {
    jumpTimer--;
    let jumpPhase = 1 - Math.abs(jumpTimer - JUMP_DURATION/2) / (JUMP_DURATION/2);
    if (!hyperdrive) {
      player.position.y += JUMP_HEIGHT * jumpPhase;
      player.rotation.x = Math.PI * 2 * (1 - jumpTimer / JUMP_DURATION);
    }
    if (jumpTimer <= 0) { 
      isJumping = false; jumpTimer = 0; 
      if (!hyperdrive) player.rotation.x = 0; 
    }
  } else if (!hyperdrive) {
    player.rotation.x = 0;
  }

  if (player.material.uniforms) {
    player.material.uniforms.time.value = performance.now() * 0.001;
    player.material.uniforms.isJumping.value = isJumping ? 1.0 : 0.0;
  }

  let tangent = info.tangent;
  if (tangent.dot(new THREE.Vector3(0,0,-1)) < 0.7) {
    gracePeriod = 60;
    let turnAngle = Math.atan2(tangent.x, tangent.z);
    targetRotation = turnAngle * 0.8;
  }
  if (gracePeriod > 0) gracePeriod--;
  else targetRotation *= 0.95;
  cubeRotation += (targetRotation - cubeRotation) * 0.1;
  if (!hyperdrive) player.rotation.z = cubeRotation;

  obstacleSpawnTimer++;
  if (obstacleSpawnTimer > 180) { spawnObstacle(); obstacleSpawnTimer = 0; }
  for (let i = obstacles.length - 1; i >= 0; i--) {
    let obs = obstacles[i];
    obs.userData.distance -= obs.userData.speed;
    if (obs.userData.distance < playerDistance - 50) {
      scene.remove(obs); obstacles.splice(i, 1); continue;
    }
    let obsInfo = getRiverInfoByDistance(obs.userData.distance);
    obs.position.copy(obsInfo.point.clone().add(obsInfo.left.clone().multiplyScalar(obs.userData.offset)));
    obs.position.y += obs.userData.size/2 + 0.3;
    obs.rotation.x += 0.01; obs.rotation.y += 0.01;
    let dDist = Math.abs(playerDistance - obs.userData.distance);
    let offsetDist = Math.abs(playerOffset - obs.userData.offset);
    if (dDist < PLAYER_SIZE*2 && offsetDist < obs.userData.size + PLAYER_SIZE/2 && !isJumping) {
      gameOver = true; document.getElementById("gameover").style.display = "block"; return;
    }
  }

  gapSpawnTimer++;
  if (gapSpawnTimer > 320) { spawnGap(); gapSpawnTimer = 0; }
  for (let i = riverGaps.length - 1; i >= 0; i--) {
    if (riverGaps[i].distance < playerDistance - 50) {
      if (riverGaps[i].edgeMesh) {
        for (let m of riverGaps[i].edgeMesh) {
          scene.remove(m); m.geometry.dispose(); m.material.dispose();
        }
      }
      riverGaps.splice(i, 1); createRiverMesh();
    }
  }

  let lookAheadInfo = getRiverInfoByDistance(playerDistance + 30);
  let camGoal = playerPos.clone().add(new THREE.Vector3(0, 8, 0)).add(tangent.clone().multiplyScalar(-12));
  camPos.lerp(camGoal, 0.08); camTarget.lerp(lookAheadInfo.point, 0.12);
  camera.position.copy(camPos); camera.lookAt(camTarget);

  updateStarfield(STARFIELD_SPEED, playerPos, tangent);

  if (riverShaderMaterial) {
    riverTime += 0.016;
    riverShaderMaterial.uniforms.time.value = riverTime;
    riverShaderMaterial.uniforms.hyperdrive.value = hyperdrive ? 1.0 : 0.0;
  }

  if (!isOnRiver(playerOffset) && gracePeriod === 0) {
    gameOver = true; document.getElementById("gameover").style.display = "block";
  }
  let overGap = riverGaps.some(gap =>
    playerDistance > gap.distance - gap.width/2 && playerDistance < gap.distance + gap.width/2
  );
  if (overGap && !isJumping && gracePeriod === 0) {
    gameOver = true; document.getElementById("gameover").style.display = "block";
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}