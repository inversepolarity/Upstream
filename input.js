window.addEventListener("keydown", e => {
  let k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") inputLeft = true;
  if (k === "arrowright" || k === "d") inputRight = true;
  if (k === " " || k === "w") {
    inputUp = true;
    speedMultiplier = 8;
    if (!hyperdrive) wasHyperdrive = false;
    hyperdrive = true;
  }
  if (k === "arrowdown" || k === "s") { inputDown = true; speedMultiplier = 0.5; }
  if ((e.key === " " || e.code === "ArrowUp") && !isJumping && !gameOver) {
    isJumping = true; jumpTimer = JUMP_DURATION;
  }
  if (gameOver && k === "r") {
    obstacles.forEach(obs => { scene.remove(obs); obs.geometry.dispose(); obs.material.dispose(); });
    riverMeshes.forEach(mesh => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
    if (starfield) { scene.remove(starfield); starfield.geometry.dispose(); starfield.material.dispose(); starfield = null; }
    trainCubes.forEach(cube => { scene.remove(cube); cube.geometry.dispose(); cube.material.dispose(); });
    trainCubes = [];
    riverGaps.forEach(gap => {
      if (gap.edgeMesh) gap.edgeMesh.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    });
    riverGaps = []; gapSpawnTimer = 0; isJumping = false; jumpTimer = 0; hyperdrive = false; wasHyperdrive = false;
    riverShaderMaterial = null; riverTime = 0; playerShaderMaterial = null; playerUniforms = null;
    init(); animate();
  }
});

window.addEventListener("keyup", e => {
  let k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") inputLeft = false;
  if (k === "arrowright" || k === "d") inputRight = false;
  if (k === " " || k === "w") { 
    inputUp = false; 
    speedMultiplier = 1; 
    if (hyperdrive) wasHyperdrive = true;
    hyperdrive = false;
  }
  if (k === "arrowdown" || k === "s") { inputDown = false; speedMultiplier = 1; }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});