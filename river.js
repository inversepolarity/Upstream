function addControlPoint(lastPos, lastAngle) {
  let angle = lastAngle + (Math.random() - 0.5) * Math.PI * 1.2;
  
  if (Math.random() < 0.067) {
    angle += Math.PI * 4;
  }
  
  let elevation =
      Math.sin(lastPos.x * 0.012 + Math.random() * 0.7) * 38
    + Math.sin(lastPos.z * 0.025 + Math.random() * 0.7) * 18
    + Math.sin(lastPos.x * 0.04 + lastPos.z * 0.04) * 12
    + (Math.random() - 0.5) * 10;
  let dir = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle)).normalize();
  let pos = lastPos.clone().add(dir.multiplyScalar(SEGMENT_LENGTH));
  pos.y = elevation;
  return { pos, angle };
}

function generateInitialRiver() {
  riverControlPoints = [];
  let pos = new THREE.Vector3(0, 0, 0), angle = 0;
  for (let i = 0; i < CONTROL_POINTS; i++) {
    let cp = addControlPoint(pos, angle);
    riverControlPoints.push(cp.pos);
    pos = cp.pos; angle = cp.angle;
  }
  updateRiverSpline();
}

function extendRiverIfNeeded() {
  while (playerDistance > riverTotalLength - MIN_POINTS_AHEAD * SEGMENT_LENGTH) {
    let lastIdx = riverControlPoints.length - 1;
    let lastPos = riverControlPoints[lastIdx], prevPos = riverControlPoints[lastIdx - 1];
    let lastAngle = Math.atan2(lastPos.x - prevPos.x, -(lastPos.z - prevPos.z));
    let cp = addControlPoint(lastPos, lastAngle);
    riverControlPoints.push(cp.pos);
    updateRiverSpline();
    createRiverMesh();
  }
}

function pruneRiverBehind() {
  let minDistance = playerDistance - MIN_POINTS_BEHIND * SEGMENT_LENGTH, removed = 0;
  while (riverLengths.length > 2 && riverLengths[1] < minDistance) {
    let removedLength = riverLengths[1] - riverLengths[0];
    riverControlPoints.shift(); riverLengths.shift();
    playerDistance -= removedLength;
    obstacles.forEach(obs => obs.userData.distance -= removedLength);
    riverGaps.forEach(gap => gap.distance -= removedLength);
    removed++;
  }
  if (removed > 0) { updateRiverSpline(); createRiverMesh(); }
}

function updateRiverSpline() {
  riverSpline = new THREE.CatmullRomCurve3(riverControlPoints);
  riverLengths = [0];
  let prev = riverControlPoints[0], total = 0;
  for (let i = 1; i < riverControlPoints.length; i++) {
    let seg = riverControlPoints[i].clone().sub(prev).length();
    total += seg; riverLengths.push(total); prev = riverControlPoints[i];
  }
  riverTotalLength = total;
}

function distanceToT(distance) {
  for (let i = 1; i < riverLengths.length; i++) {
    if (distance < riverLengths[i]) {
      let segStart = riverLengths[i-1], segEnd = riverLengths[i];
      let localT = (distance - segStart) / (segEnd - segStart);
      let t = (i-1 + localT) / (riverControlPoints.length - 1);
      return Math.max(0, Math.min(1, t));
    }
  }
  return 1;
}

function getRiverInfoByDistance(distance) {
  let t = distanceToT(distance);
  let point = riverSpline.getPoint(t);
  let tangent = riverSpline.getTangent(t).normalize();
  let up = new THREE.Vector3(0,1,0);
  let left = new THREE.Vector3().crossVectors(up, tangent).normalize();
  return { point, tangent, left, t };
}

function isOnRiver(offset) {
  return Math.abs(offset) < RIVER_WIDTH/2 - PLAYER_SIZE/2;
}

function spawnGap() {
  let dist = playerDistance + 80 + Math.random() * 180;
  let width = 4 + Math.random() * 4;
  riverGaps.push({ distance: dist, width: width });
  createRiverMesh();
}


// <!-- River Mesh & Rendering -->

function createRiverMesh() {
  riverMeshes.forEach(mesh => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  riverMeshes = [];

  let up = new THREE.Vector3(0, 1, 0);
  let camDir = camTarget.clone().sub(camPos).normalize();
  let camOrigin = camPos.clone();
  const STRAIGHTEN_START = 0.85;

  let visibleRanges = [], segStart = 0, segEnd = riverTotalLength;
  let gapsInSegment = riverGaps
    .filter(gap => !(gap.distance + gap.width/2 <= segStart || gap.distance - gap.width/2 >= segEnd))
    .sort((a, b) => (a.distance - a.width/2) - (b.distance - b.width/2));
  let cursor = segStart;
  for (let gap of gapsInSegment) {
    let gapStart = Math.max(segStart, gap.distance - gap.width/2);
    let gapEnd = Math.min(segEnd, gap.distance + gap.width/2);
    if (gapStart > cursor) visibleRanges.push([cursor, gapStart]);
    cursor = Math.max(cursor, gapEnd);
  }
  if (cursor < segEnd) visibleRanges.push([cursor, segEnd]);
  if (visibleRanges.length === 0) visibleRanges.push([segStart, segEnd]);

  for (let [rangeStart, rangeEnd] of visibleRanges) {
    if (rangeEnd - rangeStart < 1) continue;
    let segLen = rangeEnd - rangeStart;
    let segs = Math.max(2, Math.floor(PATH_SEGMENTS * segLen / riverTotalLength));
    let vertices = [], uvs = [], indices = [];
    for (let j = 0; j < segs; j++) {
      let d = rangeStart + (rangeEnd - rangeStart) * (j / (segs - 1));
      let t = distanceToT(d);
      let center = riverSpline.getPoint(t);
      let tNorm = d / riverTotalLength;
      if (tNorm > STRAIGHTEN_START) {
        let blend = (tNorm - STRAIGHTEN_START) / (1 - STRAIGHTEN_START);
        let straightDist = d;
        let straightPoint = camOrigin.clone().add(camDir.clone().multiplyScalar(straightDist));
        center.lerp(straightPoint, blend);
      }
      let tangent = riverSpline.getTangent(t).normalize();
      let left = new THREE.Vector3().crossVectors(up, tangent).normalize().multiplyScalar(RIVER_WIDTH/2);
      let right = left.clone().negate();
      vertices.push(center.x + left.x, center.y + left.y, center.z + left.z);
      vertices.push(center.x + right.x, center.y + right.y, center.z + right.z);
      uvs.push(0, j / (segs - 1)); uvs.push(1, j / (segs - 1));
    }
    for (let j = 0; j < segs-1; j++) {
      let a = j*2, b = j*2+1, c = j*2+2, d2 = j*2+3;
      indices.push(a, b, c, b, d2, c);
    }
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    if (!riverShaderMaterial) {
      riverShaderMaterial = new THREE.ShaderMaterial({
        uniforms: { 
          time: { value: 0.0 },
          hyperdrive: { value: 0.0 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float time, hyperdrive;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            float a = hash(i), b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
            vec2 u = f*f*(3.0-2.0*f);
            return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }
          float checker(vec2 uv) {
            float cx = step(0.5, fract(uv.x * 4.0));
            float cy = step(0.5, fract(uv.y * 4.0));
            return mod(cx + cy, 2.0);
          }
          float getHeight(vec2 uv, float t) {
            float wave1 = sin(uv.x * 18.0 + t * 1.5) * 0.08;
            float wave2 = sin(uv.x * 32.0 - t * 2.0) * 0.04;
            float wave3 = sin(uv.y * 24.0 + t * 2.5) * 0.06;
            float n1 = noise(uv * 8.0 + t * 0.5) * 0.08;
            float n2 = noise(uv * 16.0 - t * 0.8) * 0.04;
            float n3 = noise(uv * 32.0 + t * 1.2) * 0.02;
            return wave1 + wave2 + wave3 + n1 + n2 + n3;
          }
          void main() {
            vec2 uv = vUv; float t = time;
            float height = getHeight(uv, t);
            vec3 deep = vec3(0.07, 0.22, 0.45), shallow = vec3(0.18, 0.55, 0.95);
            float depth = clamp(uv.y + height * 0.5, 0.0, 1.0);
            vec3 color = mix(deep, shallow, depth);
            color = mix(color, vec3(0.1, 0.3, 0.5), 0.2 + 0.2*noise(uv*4.0 + t*0.2));
            float fresnel = pow(1.0 - abs(uv.y - 0.5) * 2.0, 2.0);
            color += vec3(0.25,0.35,0.45) * fresnel * 0.3;
            float foam = smoothstep(0.15, 0.22, abs(height)) * (1.0-depth);
            foam *= 0.5 + 0.5*sin(uv.x*60.0 + t*2.0 + noise(uv*12.0)*2.0);
            color += vec3(0.9,0.95,1.0) * foam * 0.18;
            
            if (hyperdrive > 0.5) {
              float c = checker(uv * 8.0);
              vec3 flagColor = mix(vec3(1.0), vec3(0.0), c);
              vec3 hyperColor = mix(vec3(1.0, 0.2, 0.2), vec3(1.0, 0.6, 0.3), 0.5 + 0.5*sin(t*2.0));
              color = mix(color, mix(hyperColor, flagColor, 0.7), 0.6);
            }
            
            gl_FragColor = vec4(color, 0.93);
          }
        `,
        transparent: true
      });
    }
    let mesh = new THREE.Mesh(geometry, riverShaderMaterial);
    scene.add(mesh); riverMeshes.push(mesh);
  }

  for (let gap of riverGaps) {
    if (!gap.edgeMesh) {
      let edgeGeo = new THREE.CylinderGeometry(RIVER_WIDTH/2, RIVER_WIDTH/2, 0.2, 32, 1, true);
      let edgeMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      let mesh1 = new THREE.Mesh(edgeGeo, edgeMat), mesh2 = new THREE.Mesh(edgeGeo, edgeMat);
      mesh1.rotation.x = mesh2.rotation.x = Math.PI/2;
      mesh1.position.copy(riverSpline.getPoint(distanceToT(gap.distance - gap.width/2)));
      mesh2.position.copy(riverSpline.getPoint(distanceToT(gap.distance + gap.width/2)));
      scene.add(mesh1); scene.add(mesh2);
      gap.edgeMesh = [mesh1, mesh2];
    }
  }
}
