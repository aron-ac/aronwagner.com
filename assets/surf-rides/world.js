import * as THREE from '../vendor/three/three.module.js';

// A compact, fictional arcade map inspired by Nosara and Playa Guiones.
// Distances and businesses are gameplay scenery, not a street map.
export function createWorld() {
  const group = new THREE.Group();
  group.name = 'Nosara arcade coast';
  const bounds = { minX: -62, maxX: 64, minZ: -68, maxZ: 68 };
  const spawn = { x: 0, z: 5, heading: 0 };
  const dropoff = { x: -53, z: 0, name: 'Playa Guiones' };
  const pickups = [
    { id: 'hostel', name: 'Surf Hostel', x: -38, z: -44 },
    { id: 'cafe', name: 'Jungle Café', x: 0, z: -44 },
    { id: 'boards', name: 'Board Shack', x: 38, z: -44 },
    { id: 'yoga', name: 'Yoga Garden', x: 38, z: 0 },
    { id: 'palms', name: 'Palm Court', x: 38, z: 44 },
    { id: 'stay', name: 'North Stay', x: 0, z: 44 },
  ];
  const roads = [
    ...[-38, 0, 38].map((x) => ({ x1: x, z1: -58, x2: x, z2: 58, width: 10 })),
    ...[-44, 0, 44].map((z) => ({ x1: -53, z1: z, x2: 50, z2: z, width: 10 })),
  ];
  const obstacles = [];
  const mats = {};
  const mat = (name, color, extra = {}) =>
    (mats[name] ||= new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra }));
  const green = mat('grass', '#92ac67');
  const sand = mat('sand', '#f1dab0');
  const wood = mat('wood', '#775942');
  const darkWood = mat('darkWood', '#493f32');
  const windowMat = mat('window', '#294f50', { roughness: 0.42 });
  const cream = mat('cream', '#f8edd2');
  const seaMat = mat('sea', '#299fae', { roughness: 0.42, metalness: 0.05 });
  const water = [];

  function mesh(geometry, material, x, y, z, parent = group) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function box(w, h, d, material, x, y, z, parent = group) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  function surface(w, d, material, x, z, y = 0) {
    const m = mesh(new THREE.PlaneGeometry(w, d), material, x, y, z);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    return m;
  }
  function distToSegment(x, z, road) {
    const dx = road.x2 - road.x1;
    const dz = road.z2 - road.z1;
    const t = Math.max(
      0,
      Math.min(1, ((x - road.x1) * dx + (z - road.z1) * dz) / (dx * dx + dz * dz)),
    );
    return Math.hypot(x - road.x1 - t * dx, z - road.z1 - t * dz);
  }
  let seed = 21426;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  // Plenty of ocean and land beyond the playable area keeps the camera framed.
  surface(400, 400, seaMat, -235, 0, -0.18);
  surface(239, 310, green, 50.5, 0);
  surface(23, 310, sand, -57.5, 0, 0.015);
  surface(5.5, 310, mat('wetSand', '#d5c79e'), -68, 0, -0.04);
  surface(9, 310, mat('shallows', '#54bdc1', { roughness: 0.45 }), -75, 0, -0.12);
  surface(18, 310, mat('midWater', '#38aeba', { roughness: 0.48 }), -88.5, 0, -0.15);

  // Broken wave bands drift shoreward, without animated textures or external art.
  const foamGeometry = new THREE.PlaneGeometry(0.32, 1);
  const foamMat = mat('foam', '#d7f4e4', { transparent: true, opacity: 0.65, depthWrite: false });
  for (let band = 0; band < 6; band++) {
    const wave = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const foam = mesh(
        foamGeometry,
        foamMat,
        Math.sin(i * 1.7 + band) * 1.1,
        0,
        -105 + i * 26,
        wave,
      );
      foam.rotation.x = -Math.PI / 2;
      foam.scale.y = 13 + random() * 8;
      foam.castShadow = false;
    }
    wave.position.set(-77 - band * 11, -0.08, 0);
    wave.userData.baseX = wave.position.x;
    group.add(wave);
    water.push(wave);
  }

  const roadEdgeMat = mat('roadEdge', '#baac7b');
  const roadMat = mat('road', '#d9c598');
  for (const road of roads) {
    const length = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
    const vertical = road.x1 === road.x2;
    const x = (road.x1 + road.x2) / 2;
    const z = (road.z1 + road.z2) / 2;
    surface(
      vertical ? road.width + 1.2 : length + 1.2,
      vertical ? length + 1.2 : road.width + 1.2,
      roadEdgeMat,
      x,
      z,
      0.025,
    );
    surface(vertical ? road.width : length, vertical ? length : road.width, roadMat, x, z, 0.045);
  }
  // Open sandy arrival court at the beach, and turnarounds at the road ends.
  const court = mesh(new THREE.CircleGeometry(10, 32), sand, -53, 0.06, 0);
  court.rotation.x = -Math.PI / 2;
  court.castShadow = false;
  for (const x of [-38, 0, 38]) {
    for (const z of [-58, 58]) {
      const circle = mesh(new THREE.CircleGeometry(5, 20), roadMat, x, 0.05, z);
      circle.rotation.x = -Math.PI / 2;
      circle.castShadow = false;
    }
  }

  function roofGeometry(w, d, h) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          -w / 2,
          0,
          -d / 2,
          w / 2,
          0,
          -d / 2,
          0,
          h,
          -d / 2,
          -w / 2,
          0,
          d / 2,
          w / 2,
          0,
          d / 2,
          0,
          h,
          d / 2,
        ],
        3,
      ),
    );
    geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3]);
    const flat = geometry.toNonIndexed();
    flat.computeVertexNormals();
    geometry.dispose();
    return flat;
  }
  function building(x, z, wallColor, roofColor, rotate = 0, scale = 1) {
    const house = new THREE.Group();
    house.position.set(x, 0, z);
    house.rotation.y = rotate;
    house.scale.setScalar(scale);
    group.add(house);
    const walls = mat(`wall-${wallColor}`, wallColor);
    const roofMat = mat(`roof-${roofColor}`, roofColor);
    box(10, 4, 8, walls, 0, 2.2, 0, house);
    box(11, 0.35, 9, mat('foundation', '#c6b98f'), 0, 0.2, 0, house);
    mesh(roofGeometry(11.5, 9.5, 2.1), roofMat, 0, 4.2, 0, house);
    box(2.1, 3.1, 0.12, wood, 0, 1.92, 4.07, house);
    for (const wx of [-3.25, 3.25]) {
      box(2.55, 1.8, 0.12, cream, wx, 2.65, 4.08, house);
      box(2.2, 1.45, 0.14, windowMat, wx, 2.65, 4.15, house);
      box(0.12, 1.5, 0.16, cream, wx, 2.65, 4.23, house);
    }
    box(9, 0.25, 3.6, wood, 0, 0.45, 5.2, house);
    const awning = box(9.5, 0.18, 3.7, roofMat, 0, 3.75, 5.1, house);
    awning.rotation.x = 0.12;
    for (const px of [-4.1, 4.1]) box(0.2, 3.35, 0.2, cream, px, 1.9, 6.4, house);
    obstacles.push({ x, z, radius: 8.5 * scale });
    return house;
  }
  building(-19, -23, '#ecd2a0', '#d66f50', Math.PI, 1);
  building(19, -23, '#e7bd80', '#398785', Math.PI, 0.94);
  building(-19, 22, '#c2d5bc', '#478e90', 0, 0.98);
  building(19, 22, '#edd0b1', '#ce795b', 0, 1);
  building(-19, -60, '#d2d6b1', '#637d65', 0, 0.66);
  building(19, -60, '#e9bd91', '#c78362', 0, 0.66);
  building(-19, 60, '#e4d0a4', '#3b8386', Math.PI, 0.64);
  building(19, 60, '#c9d5ba', '#c07358', Math.PI, 0.64);
  building(56, -23, '#e5cdb3', '#459498', -Math.PI / 2, 0.65);
  building(56, 22, '#cbd1ae', '#c58260', -Math.PI / 2, 0.65);

  // Open-air beach palapas and a small surfboard rack.
  function palapa(x, z, roofColor) {
    const hut = new THREE.Group();
    hut.position.set(x, 0, z);
    group.add(hut);
    box(7, 0.18, 7, wood, 0, 0.12, 0, hut);
    for (const px of [-2.5, 2.5])
      for (const pz of [-2.5, 2.5]) box(0.24, 3.7, 0.24, darkWood, px, 1.9, pz, hut);
    const roof = mesh(
      new THREE.ConeGeometry(5.5, 2.2, 4),
      mat('thatch', roofColor),
      0,
      4.7,
      0,
      hut,
    );
    roof.rotation.y = Math.PI / 4;
    box(4.5, 0.2, 0.8, wood, 0, 1.4, -1.9, hut);
    obstacles.push({ x, z, radius: 4.4 });
  }
  palapa(-55, -24, '#bca36b');
  palapa(-55, 25, '#bca36b');
  for (let i = 0; i < 4; i++) {
    const surfMat = mat(`board-${i}`, ['#e97962', '#f3cb62', '#58a8a1', '#f4efe0'][i]);
    const board = mesh(new THREE.SphereGeometry(1, 10, 8), surfMat, -59 + i * 1.05, 1.85, 30);
    board.scale.set(0.42, 1.85, 0.14);
    board.rotation.z = -0.15;
  }
  box(5, 0.13, 0.15, wood, -57.5, 1.5, 30.25);

  // Add a few patio umbrellas and café tables inside the building blocks.
  for (const [x, z, color] of [
    [-11, -14, '#df8461'],
    [10, -15, '#4d9e9d'],
    [-10, 13, '#e5bc5e'],
    [10, 13, '#e08160'],
  ]) {
    mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 12), wood, x, 1, z);
    mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.7, 6), cream, x, 1.85, z);
    mesh(new THREE.ConeGeometry(2.3, 0.85, 8), mat(`umbrella-${color}`, color), x, 3.6, z);
    obstacles.push({ x, z, radius: 1 });
  }

  // Small entrance signs are scenery; the game draws the active destination.
  function sign(x, z, color) {
    box(0.16, 2.3, 0.16, darkWood, x, 1.15, z);
    box(2.3, 0.95, 0.14, mat(`sign-${color}`, color), x, 2.05, z);
    box(1.3, 0.1, 0.02, cream, x, 2.15, z + 0.085);
    box(0.8, 0.08, 0.02, cream, x - 0.25, 1.9, z + 0.085);
  }
  sign(-46, -8.8, '#408c89');
  sign(7, -36.5, '#d58160');
  sign(46, 8, '#408c89');

  const zoneClear = (x, z, margin = 0) =>
    ![...pickups, dropoff, spawn].some((p) => Math.hypot(p.x - x, p.z - z) < 8 + margin);
  const clear = (x, z, r = 1) =>
    zoneClear(x, z, r) &&
    !roads.some((road) => distToSegment(x, z, road) < road.width / 2 + r + 1.5) &&
    !obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + r + 1.2);

  const palmPositions = [];
  for (let attempt = 0; attempt < 1800 && palmPositions.length < 83; attempt++) {
    const x = -60 + random() * 121;
    const z = -65 + random() * 130;
    if (!clear(x, z, 1.1)) continue;
    const height = 5.5 + random() * 3;
    palmPositions.push({
      x,
      z,
      height,
      lean: random() * Math.PI * 2,
      amount: 0.3 + random() * 0.7,
    });
    obstacles.push({ x, z, radius: 0.7 });
  }
  // Taller background groves soften the edges without blocking the roads.
  for (let i = 0; i < 66; i++) {
    const edge = i % 3;
    const x = edge === 0 ? 74 + random() * 31 : -37 + random() * 112;
    const z = edge === 0 ? -94 + random() * 188 : (edge === 1 ? -1 : 1) * (79 + random() * 29);
    palmPositions.push({
      x,
      z,
      height: 7 + random() * 3,
      lean: random() * Math.PI * 2,
      amount: 0.5,
    });
  }
  const trunkGeometry = new THREE.CylinderGeometry(0.19, 0.3, 1, 6);
  const trunks = new THREE.InstancedMesh(
    trunkGeometry,
    mat('palmTrunk', '#a88a63'),
    palmPositions.length,
  );
  const leavesGeometry = new THREE.BufferGeometry();
  leavesGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0, 0.64, 0.08, 1.1, 0.48, -0.42, 2.6, 0, -1.14, 3.65, -0.48, -0.42, 2.6, -0.64, 0.08,
        1.1, 0, 0.3, 1.35,
      ],
      3,
    ),
  );
  leavesGeometry.setIndex([0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
  leavesGeometry.computeVertexNormals();
  const leaves = new THREE.InstancedMesh(
    leavesGeometry,
    mat('palmLeaf', '#3f805c', { side: THREE.DoubleSide }),
    palmPositions.length * 7,
  );
  const object = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  palmPositions.forEach((p, i) => {
    const shiftX = Math.cos(p.lean) * p.amount;
    const shiftZ = Math.sin(p.lean) * p.amount;
    const dir = new THREE.Vector3(shiftX, p.height, shiftZ);
    const length = dir.length();
    object.position.set(p.x + shiftX / 2, p.height / 2, p.z + shiftZ / 2);
    object.quaternion.setFromUnitVectors(up, dir.normalize());
    object.scale.set(1, length, 1);
    object.updateMatrix();
    trunks.setMatrixAt(i, object.matrix);
    for (let leaf = 0; leaf < 7; leaf++) {
      object.position.set(p.x + shiftX, p.height, p.z + shiftZ);
      object.rotation.set(0, (leaf / 7) * Math.PI * 2 + p.lean, 0);
      const s = 0.8 + (p.height - 5) * 0.1;
      object.scale.setScalar(s);
      object.updateMatrix();
      leaves.setMatrixAt(i * 7 + leaf, object.matrix);
    }
  });
  trunks.castShadow = true;
  leaves.castShadow = true;
  group.add(trunks, leaves);

  // Clumped low vegetation uses one draw call and stays outside all routes.
  const bushPositions = [];
  for (let attempt = 0; attempt < 650 && bushPositions.length < 96; attempt++) {
    const x = -42 + random() * 104;
    const z = -65 + random() * 130;
    if (!clear(x, z, 0.6)) continue;
    bushPositions.push({ x, z, scale: 0.6 + random() * 0.8 });
  }
  const bushes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    mat('bush', '#5d9262'),
    bushPositions.length,
  );
  bushPositions.forEach((p, i) => {
    object.position.set(p.x, p.scale * 0.55, p.z);
    object.rotation.set(0, random() * 6, 0);
    object.scale.set(p.scale * 1.1, p.scale * 0.8, p.scale);
    object.updateMatrix();
    bushes.setMatrixAt(i, object.matrix);
  });
  bushes.castShadow = true;
  bushes.receiveShadow = true;
  group.add(bushes);

  // Faceted hills beyond the town give the small world a tropical silhouette.
  for (const [x, z, s] of [
    [110, -80, 29],
    [123, -25, 38],
    [110, 54, 33],
    [91, 108, 22],
    [51, -119, 20],
  ]) {
    const hill = mesh(new THREE.IcosahedronGeometry(1, 1), mat('hill', '#76965c'), x, -6, z);
    hill.scale.set(s, s * 0.65, s);
    hill.castShadow = false;
  }

  return {
    group,
    obstacles,
    roads,
    pickups,
    dropoff,
    bounds,
    spawn,
    update(_dt, elapsed) {
      water.forEach((wave, i) => {
        wave.position.x = wave.userData.baseX + Math.sin(elapsed * 0.3 + i * 0.65) * 1.2;
        wave.position.z = Math.sin(elapsed * 0.12 + i) * 1.8;
      });
    },
  };
}
