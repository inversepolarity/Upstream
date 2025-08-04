function createTrainCubes() {
  trainCubes = [];
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
      material = playerShaderMaterial.clone();
    }
    let cube = new THREE.Mesh(geo, material);
    trainCubes.push(cube);
    scene.add(cube);
    cube.visible = false;
  }
}

function updateTrainPosition(info, tangent) {
  let spacing = PLAYER_SIZE * 1.8;
  for (let i = 0; i < trainCubes.length; i++) {
    let cube = trainCubes[i];
    let offset = -spacing * i;
    let trainDistance = playerDistance + offset;
    let trainInfo = getRiverInfoByDistance(trainDistance);
    let trainPos = trainInfo.point.clone().add(trainInfo.left.clone().multiplyScalar(playerOffset));
    cube.position.copy(trainPos);
    cube.position.y += PLAYER_SIZE/2;
    
    if (isJumping) {
      let jumpPhase = 1 - Math.abs(jumpTimer - JUMP_DURATION/2) / (JUMP_DURATION/2);
      cube.position.y += JUMP_HEIGHT * jumpPhase;
      cube.rotation.x = Math.PI * 2 * (1 - jumpTimer / JUMP_DURATION);
    } else {
      cube.rotation.x = 0;
    }
    
    cube.rotation.z = cubeRotation;
    
    if (i === 4 && cube.material.uniforms) {
      cube.material.uniforms.time.value = performance.now() * 0.001;
    }
  }
}