import * as THREE from 'three';
import { state } from './state.js';
import river_default_vertex from './shaders/river/vertex.glsl';
import river_default_frag from './shaders/river/fragment.glsl';
import { PLAYER_SIZE, MIN_POINTS_BEHIND, MIN_POINTS_AHEAD, CONTROL_POINTS, RIVER_WIDTH, SEGMENT_LENGTH, PATH_SEGMENTS  } from './constants.js';

// Check if two 2D line segments intersect
function segmentsIntersect(p1, q1, p2, q2) {
  function orientation(p, q, r) {
    let val = (q.z - p.z) * (r.x - q.x) - (q.x - p.x) * (r.z - q.z);
    if (Math.abs(val) < 0.001) return 0; // collinear
    return (val > 0) ? 1 : 2; // clockwise or counterclockwise
  }
  
  function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
           q.z <= Math.max(p.z, r.z) && q.z >= Math.min(p.z, r.z);
  }
  
  let o1 = orientation(p1, q1, p2);
  let o2 = orientation(p1, q1, q2);
  let o3 = orientation(p2, q2, p1);
  let o4 = orientation(p2, q2, q1);
  
  if (o1 != o2 && o3 != o4) return true;
  if (o1 == 0 && onSegment(p1, p2, q1)) return true;
  if (o2 == 0 && onSegment(p1, q2, q1)) return true;
  if (o3 == 0 && onSegment(p2, p1, q2)) return true;
  if (o4 == 0 && onSegment(p2, q1, q2)) return true;
  
  return false;
}

function addControlPoint(lastPos, lastAngle) {
  const MAX_ATTEMPTS = 50;
  const MIN_DISTANCE = RIVER_WIDTH * 3; // Minimum distance from existing segments
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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
    
    // Check for intersections with existing segments
    let intersects = false;
    
    if (state.riverControlPoints.length >= 3) {
      for (let i = 0; i < state.riverControlPoints.length - 2; i++) {
        let segStart = state.riverControlPoints[i];
        let segEnd = state.riverControlPoints[i + 1];
        
        // Skip adjacent segments
        if (i >= state.riverControlPoints.length - 3) continue;
        
        // Check intersection
        if (segmentsIntersect(lastPos, pos, segStart, segEnd)) {
          intersects = true;
          break;
        }
        
        // Check minimum distance
        let distToSeg = distancePointToSegment(pos, segStart, segEnd);
        if (distToSeg < MIN_DISTANCE) {
          intersects = true;
          break;
        }
      }
    }
    
    if (!intersects) {
      return { pos, angle };
    }
    
    // If intersection detected, try smaller angle deviation
    if (attempt > MAX_ATTEMPTS / 2) {
      angle = lastAngle + (Math.random() - 0.5) * Math.PI * 0.3;
    }
  }
  
  // Fallback: continue straight with slight deviation
  let angle = lastAngle + (Math.random() - 0.5) * 0.1;
  let dir = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle)).normalize();
  let pos = lastPos.clone().add(dir.multiplyScalar(SEGMENT_LENGTH));
  pos.y = lastPos.y + (Math.random() - 0.5) * 5;
  
  return { pos, angle };
}

function distancePointToSegment(point, segStart, segEnd) {
  let A = point.x - segStart.x;
  let B = point.z - segStart.z;
  let C = segEnd.x - segStart.x;
  let D = segEnd.z - segStart.z;
  
  let dot = A * C + B * D;
  let lenSq = C * C + D * D;
  let param = lenSq != 0 ? dot / lenSq : -1;
  
  let xx, zz;
  if (param < 0) {
    xx = segStart.x;
    zz = segStart.z;
  } else if (param > 1) {
    xx = segEnd.x;
    zz = segEnd.z;
  } else {
    xx = segStart.x + param * C;
    zz = segStart.z + param * D;
  }
  
  let dx = point.x - xx;
  let dz = point.z - zz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function generateInitialRiver() {
  state.riverControlPoints = [];
  let pos = new THREE.Vector3(0, 0, 0), angle = 0;
  for (let i = 0; i < CONTROL_POINTS; i++) {
    let cp = addControlPoint(pos, angle);
    state.riverControlPoints.push(cp.pos);
    pos = cp.pos; angle = cp.angle;
  }
  updateRiverSpline();
}

export function extendRiverIfNeeded() {
  while (state.playerDistance > state.riverTotalLength - MIN_POINTS_AHEAD * SEGMENT_LENGTH) {
    let lastIdx = state.riverControlPoints.length - 1;
    let lastPos = state.riverControlPoints[lastIdx], prevPos = state.riverControlPoints[lastIdx - 1];
    let lastAngle = Math.atan2(lastPos.x - prevPos.x, -(lastPos.z - prevPos.z));
    let cp = addControlPoint(lastPos, lastAngle);
    state.riverControlPoints.push(cp.pos);
    updateRiverSpline();
    createRiverMesh();
  }
}

export function pruneRiverBehind() {
  let minDistance = state.playerDistance - MIN_POINTS_BEHIND * SEGMENT_LENGTH, removed = 0;
  while (state.riverLengths.length > 2 && state.riverLengths[1] < minDistance) {
    let removedLength = state.riverLengths[1] - state.riverLengths[0];
    state.riverControlPoints.shift(); 
    state.riverLengths.shift();
    state.playerDistance -= removedLength;
    state.obstacles.forEach(obs => obs.userData.distance -= removedLength);
    state.riverGaps.forEach(gap => gap.distance -= removedLength);
    removed++;
  }
  if (removed > 0) { updateRiverSpline(); createRiverMesh(); }
}

function updateRiverSpline() {
  state.riverSpline = new THREE.CatmullRomCurve3(state.riverControlPoints);
  state.riverLengths = [0];
  let prev = state.riverControlPoints[0], total = 0;
  for (let i = 1; i < state.riverControlPoints.length; i++) {
    let seg = state.riverControlPoints[i].clone().sub(prev).length();
    total += seg; state.riverLengths.push(total); prev = state.riverControlPoints[i];
  }
  state.riverTotalLength = total;
}

function distanceToT(distance) {
  for (let i = 1; i < state.riverLengths.length; i++) {
    if (distance < state.riverLengths[i]) {
      let segStart = state.riverLengths[i-1], segEnd = state.riverLengths[i];
      let localT = (distance - segStart) / (segEnd - segStart);
      let t = (i-1 + localT) / (state.riverControlPoints.length - 1);
      return Math.max(0, Math.min(1, t));
    }
  }
  return 1;
}

export function getRiverInfoByDistance(distance) {
  let t = distanceToT(distance);
  let point = state.riverSpline.getPoint(t);
  let tangent = state.riverSpline.getTangent(t).normalize();
  let up = new THREE.Vector3(0,1,0);
  let left = new THREE.Vector3().crossVectors(up, tangent).normalize();
  return { point, tangent, left, t };
}

export function isOnRiver(offset) {
  return Math.abs(offset) < RIVER_WIDTH/2 - PLAYER_SIZE/2;
}

export function spawnGap() {
  let dist = state.playerDistance + 80 + Math.random() * 180;
  let width = 4 + Math.random() * 4;
  state.riverGaps.push({ distance: dist, width: width });
  createRiverMesh();
}


// <!-- River Mesh & Rendering -->
export function createRiverMesh() {
  state.riverMeshes.forEach(mesh => {
    state.scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  state.riverMeshes = [];

  let up = new THREE.Vector3(0, 1, 0);
  let camDir = state.camTarget.clone().sub(state.camPos).normalize();
  let camOrigin = state.camPos.clone();
  const STRAIGHTEN_START = 0.85;

  let visibleRanges = [], segStart = 0, segEnd = state.riverTotalLength;
  let gapsInSegment = state.riverGaps
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
    let segs = Math.max(2, Math.floor(PATH_SEGMENTS * segLen / state.riverTotalLength));
    let vertices = [], uvs = [], indices = [];
    for (let j = 0; j < segs; j++) {
      let d = rangeStart + (rangeEnd - rangeStart) * (j / (segs - 1));
      let t = distanceToT(d);
      let center = state.riverSpline.getPoint(t);
      let tNorm = d / state.riverTotalLength;
      if (tNorm > STRAIGHTEN_START) {
        let blend = (tNorm - STRAIGHTEN_START) / (1 - STRAIGHTEN_START);
        let straightDist = d;
        let straightPoint = camOrigin.clone().add(camDir.clone().multiplyScalar(straightDist));
        center.lerp(straightPoint, blend);
      }
      let tangent = state.riverSpline.getTangent(t).normalize();
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

    if (!state.riverShaderMaterial) {
      state.riverShaderMaterial = new THREE.ShaderMaterial({
        uniforms: { 
          time: { value: 0.0 },
          hyperdrive: { value: 0.0 }
        },
        vertexShader: river_default_vertex,
        fragmentShader: river_default_frag,
        transparent: true
      });
    }

    let mesh = new THREE.Mesh(geometry, state.riverShaderMaterial);
    state.scene.add(mesh); state.riverMeshes.push(mesh);
  }

  for (let gap of state.riverGaps) {
    if (!gap.edgeMesh) {
      let edgeGeo = new THREE.CylinderGeometry(RIVER_WIDTH/2, RIVER_WIDTH/2, 0.2, 32, 1, true);
      let edgeMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      let mesh1 = new THREE.Mesh(edgeGeo, edgeMat), mesh2 = new THREE.Mesh(edgeGeo, edgeMat);
      mesh1.rotation.x = mesh2.rotation.x = Math.PI/2;
      mesh1.position.copy(state.riverSpline.getPoint(distanceToT(gap.distance - gap.width/2)));
      mesh2.position.copy(state.riverSpline.getPoint(distanceToT(gap.distance + gap.width/2)));
      state.scene.add(mesh1); 
      state.scene.add(mesh2);
      gap.edgeMesh = [mesh1, mesh2];
    }
  }
}
