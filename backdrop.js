function createStarfield() {
  starPositions = new Float32Array(STAR_COUNT * 3);
  starData = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    let angle = Math.random() * Math.PI * 2;
    let radius = STARFIELD_MIN_RADIUS + Math.random() * (STARFIELD_RADIUS - STARFIELD_MIN_RADIUS);
    let z = -Math.random() * STARFIELD_DEPTH;
    let x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    starPositions.set([x, y, z], i * 3);
    starData.push({ angle, radius, z, prev: {x, y, z} });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const material = new THREE.PointsMaterial({
    size: 1.1, sizeAttenuation: true, color: 0xffffff, opacity: 0.85, transparent: true, depthWrite: false
  });
  starfield = new THREE.Points(geometry, material);
  scene.add(starfield);
}

function updateStarfield(forwardSpeed, playerPos, riverTangent) {
  if (wasHyperdrive && !hyperdrive) {
    for (let i = 0; i < STAR_COUNT; i++) {
      let angle = Math.random() * Math.PI * 2;
      let radius = STARFIELD_MIN_RADIUS + Math.random() * (STARFIELD_RADIUS - STARFIELD_MIN_RADIUS);
      let z = -Math.random() * STARFIELD_DEPTH;
      Object.assign(starData[i], { angle, radius, z });
    }
    wasHyperdrive = false;
  }
  
  let speedMult = hyperdrive ? 50 : 1;
  for (let i = 0; i < STAR_COUNT; i++) {
    starData[i].z += forwardSpeed * speedMultiplier * speedMult;
    if (starData[i].z > 5) {
      let angle = Math.random() * Math.PI * 2;
      let radius = STARFIELD_MIN_RADIUS + Math.random() * (STARFIELD_RADIUS - STARFIELD_MIN_RADIUS);
      let z = -STARFIELD_DEPTH + Math.random() * -30;
      Object.assign(starData[i], { angle, radius, z });
    }
    let x = Math.cos(starData[i].angle) * starData[i].radius;
    let y = Math.sin(starData[i].angle) * starData[i].radius;
    let z = starData[i].z;
    starPositions.set([x, y, z], i * 3);
  }
  starfield.geometry.attributes.position.needsUpdate = true;
  starfield.position.copy(playerPos);

  let up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  m.lookAt(new THREE.Vector3(0,0,0), riverTangent, up);
  starfield.setRotationFromMatrix(m);
  starfield.position.copy(playerPos);
  
  starfield.material.opacity = hyperdrive ? 0.1 : 0.85;
}
