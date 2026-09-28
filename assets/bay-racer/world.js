import * as THREE from '../vendor/three/three.module.js';

// A fictional, compact Tampa Bay race course; scenery is not a navigational map.
export function createBayWorld() {
  const group = new THREE.Group();
  group.name = 'Tampa Bay race course';
  const bounds = { minX: -110, maxX: 110, minZ: -105, maxZ: 105 };
  const centers = [
    [-62, 0],
    [-44, 51],
    [8, 65],
    [61, 35],
    [67, -22],
    [32, -61],
    [-24, -65],
    [-62, -39],
  ];
  const gates = centers.map(([x, z], index) => {
    const previous = centers[(index + centers.length - 1) % centers.length];
    const length = Math.hypot(x - previous[0], z - previous[1]);
    return {
      x,
      z,
      normal: { x: (x - previous[0]) / length, z: (z - previous[1]) / length },
      halfWidth: 9,
    };
  });
  const obstacles = [];
  const materials = new Map();
  const batches = new Map();
  const dummy = new THREE.Object3D();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const cone = new THREE.ConeGeometry(1, 1, 12);
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const palmTrunkGeometry = new THREE.CylinderGeometry(0.7, 1, 1, 7);
  let seed = 72591;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const material = (name, color, options = {}) => {
    if (!materials.has(name))
      materials.set(name, new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...options }));
    return materials.get(name);
  };
  const sand = material('sand', '#eedab0');
  const grass = material('grass', '#789e66');
  const cream = material('cream', '#faf2d6');
  const white = material('white', '#e7f3e3');
  const navy = material('navy', '#214749');
  const timber = material('timber', '#998366');
  const palmBark = material('palm-bark', '#988568');
  const leafDark = material('leaf-dark', '#347b65', { side: THREE.DoubleSide });
  const leafLight = material('leaf-light', '#619964', { side: THREE.DoubleSide });
  const coral = material('coral', '#e98767');
  const gold = material('gold', '#f4c964', { emissive: '#b98422', emissiveIntensity: 0.25 });
  const seafoam = material('seafoam', '#8ed6bf', { emissive: '#277369', emissiveIntensity: 0.1 });
  const glass = material('glass', '#70a8b0', { roughness: 0.34, metalness: 0.12 });
  const foam = material('foam', '#d1f1da', { transparent: true, opacity: 0.6, depthWrite: false });

  function instance(geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const key = `${geometry.uuid}/${mat.uuid}`;
    if (!batches.has(key)) batches.set(key, { geometry, mat, matrices: [] });
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const box = (mat, x, y, z, w, h, d, ry = 0) => instance(cube, mat, x, y, z, w, h, d, 0, ry);
  function mesh(geometry, mat, x, y, z, parent = group) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function distanceToSegment(x, z, a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
  }
  function clearOfCourse(x, z, radius) {
    return gates.every(
      (gate, index) =>
        distanceToSegment(x, z, gate, gates[(index + 1) % gates.length]) >= 15 + radius,
    );
  }

  // One locally shaded water mesh: gentle swells and broad color variations avoid
  // high-contrast texture shimmer at speed. No external maps or reflection passes.
  const waterGeometry = new THREE.PlaneGeometry(900, 900, 80, 80);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = material('water', '#32a9af', { roughness: 0.43, metalness: 0.09 });
  const waterTime = { value: 0 };
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.bayTime = waterTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float bayTime;\nvarying vec3 bayPosition;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nbayPosition = position;\ntransformed.y += sin(position.x * 0.065 + bayTime * 0.7) * 0.045 + cos(position.z * 0.052 - bayTime * 0.5) * 0.035;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float bayTime;\nvarying vec3 bayPosition;',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat bayWave = sin(bayPosition.x * 0.043 + bayPosition.z * 0.019 + bayTime * 0.1) * cos(bayPosition.z * 0.036 - bayTime * 0.08);\ndiffuseColor.rgb *= 1.0 + bayWave * 0.07;',
      );
  };
  const water = mesh(waterGeometry, waterMaterial, 0, -0.12, 0);
  water.castShadow = false;

  const rippleGeometry = new THREE.RingGeometry(1, 1.028, 64);
  rippleGeometry.rotateX(-Math.PI / 2);
  const islandRipples = [];
  function island(x, z, radius, green = true) {
    if (!clearOfCourse(x, z, radius)) throw new Error('Island would obstruct the race corridor');
    const rim = mesh(new THREE.CylinderGeometry(radius * 0.96, radius, 1.05, 48), sand, x, 0.02, z);
    rim.name = 'Sandy shoreline';
    if (green)
      mesh(new THREE.CylinderGeometry(radius * 0.79, radius * 0.9, 0.75, 40), grass, x, 0.84, z);
    const shoal = mesh(
      new THREE.CircleGeometry(radius * 1.16, 48),
      material('shallows', '#68c5bd', { roughness: 0.6 }),
      x,
      -0.035,
      z,
    );
    shoal.rotation.x = -Math.PI / 2;
    shoal.castShadow = false;
    const ripple = mesh(rippleGeometry, foam, x, 0.018, z);
    ripple.scale.setScalar(radius * 1.015);
    ripple.castShadow = false;
    islandRipples.push({ mesh: ripple, radius, phase: random() * Math.PI * 2 });
    obstacles.push({ x, z, radius });
  }
  island(0, 0, 22);
  island(-100, 79, 20);
  island(106, 86, 29);
  island(111, -92, 27);
  island(-114, -96, 27);

  // Curved, faceted palm fronds and trunks are batched to keep the scene light.
  const frondGeometry = new THREE.BufferGeometry();
  frondGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0, 0.38, 0.14, -0.14, 0.38, 0.19, 0, 0, 0, 0, 0.38, 0.19, 0, 0.38, 0.14, 0.14, 0.38,
        0.14, -0.14, 0.76, 0.045, -0.1, 0.38, 0.19, 0, 0.38, 0.19, 0, 0.76, 0.045, -0.1, 0.76,
        0.095, 0, 0.38, 0.19, 0, 0.76, 0.095, 0, 0.38, 0.14, 0.14, 0.38, 0.14, 0.14, 0.76, 0.095, 0,
        0.76, 0.045, 0.1, 0.76, 0.045, -0.1, 1, -0.27, 0, 0.76, 0.095, 0, 0.76, 0.095, 0, 1, -0.27,
        0, 0.76, 0.045, 0.1,
      ],
      3,
    ),
  );
  frondGeometry.computeVertexNormals();
  function palm(x, z, height = 7) {
    const lean = random() * Math.PI * 2;
    const bend = 0.45 + random() * 0.6;
    for (let segment = 0; segment < 3; segment++) {
      const t = (segment + 0.5) / 3;
      instance(
        palmTrunkGeometry,
        palmBark,
        x + Math.cos(lean) * bend * t * t,
        1.15 + height * t,
        z + Math.sin(lean) * bend * t * t,
        0.27 - segment * 0.033,
        height / 3 + 0.08,
        0.27 - segment * 0.033,
        (Math.sin(lean) * bend * t) / height,
        0,
        (-Math.cos(lean) * bend * t) / height,
      );
    }
    const leafSize = height * 0.64;
    for (let leaf = 0; leaf < 7; leaf++) {
      instance(
        frondGeometry,
        leaf % 2 ? leafDark : leafLight,
        x + Math.cos(lean) * bend,
        height + 1.15,
        z + Math.sin(lean) * bend,
        leafSize,
        leafSize,
        leafSize,
        0,
        lean + (leaf * Math.PI * 2) / 7,
        0.08,
      );
    }
    instance(
      rockGeometry,
      palmBark,
      x + Math.cos(lean) * bend,
      height + 0.9,
      z + Math.sin(lean) * bend,
      0.42,
      0.5,
      0.42,
    );
  }
  for (const [cx, cz, radius, count] of [
    [0, 0, 16, 14],
    [-100, 79, 15, 9],
    [106, 86, 23, 16],
    [111, -92, 21, 10],
    [-114, -96, 21, 12],
  ]) {
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963 + random() * 0.45;
      const r = Math.sqrt((i + 0.4) / count) * radius;
      const x = cx + Math.cos(angle) * r;
      const z = cz + Math.sin(angle) * r;
      if (cx === 0 && Math.hypot(x + 5, z - 2) < 6) continue;
      palm(x, z, 5.7 + random() * 3.6);
    }
  }

  function bungalow(x, z, color, heading = 0, size = 1) {
    // Geometry is composed around its pivot before batching, so roofs/window rows
    // rotate as one house while all instances still share the same draw batches.
    const house = material(`house-${color}`, color);
    const roof = material('roof', '#d18c70');
    const point = (lx, ly, lz) => [
      x + (lx * Math.cos(heading) + lz * Math.sin(heading)) * size,
      1.15 + ly * size,
      z + (-lx * Math.sin(heading) + lz * Math.cos(heading)) * size,
    ];
    const part = (mat, lx, ly, lz, w, h, d, tilt = 0) => {
      const [px, py, pz] = point(lx, ly, lz);
      instance(cube, mat, px, py, pz, w * size, h * size, d * size, tilt, heading);
    };
    part(cream, 0, 0.18, 0, 7.8, 0.35, 6.7);
    part(house, 0, 2, 0, 7, 3.6, 5.8);
    for (const side of [-1, 1]) part(roof, 0, 4.15, side * 1.65, 8, 0.22, 3.9, side * 0.32);
    part(navy, 0, 1.5, 2.94, 1.5, 2.7, 0.1);
    for (const side of [-1, 1]) {
      part(cream, side * 2.35, 2.25, 2.98, 1.7, 1.7, 0.12);
      part(glass, side * 2.35, 2.25, 3.06, 1.4, 1.4, 0.1);
    }
  }
  bungalow(-5, 2, '#edc28f', -0.5, 0.8);
  bungalow(96, 85, '#d9dcb4', -1.0, 1.25);
  bungalow(117, 83, '#e7b797', -0.7, 1);
  bungalow(-102, 77, '#d3dfc7', 0.3, 1);

  // A compact lighthouse marks the southern harbor entrance.
  const lighthouseX = 105,
    lighthouseZ = -86;
  instance(cylinder, cream, lighthouseX, 2.05, lighthouseZ, 4.2, 1.9, 4.2);
  instance(cylinder, white, lighthouseX, 7.4, lighthouseZ, 2.5, 10.1, 2.5);
  instance(cylinder, coral, lighthouseX, 8.3, lighthouseZ, 2.52, 2.4, 2.52);
  instance(cylinder, navy, lighthouseX, 12.7, lighthouseZ, 3.2, 0.55, 3.2);
  instance(cylinder, gold, lighthouseX, 14, lighthouseZ, 1.75, 2.2, 1.75);
  instance(cone, navy, lighthouseX, 15.9, lighthouseZ, 3, 2, 3);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    box(
      navy,
      lighthouseX + Math.cos(angle) * 1.75,
      14,
      lighthouseZ + Math.sin(angle) * 1.75,
      0.15,
      2.1,
      0.15,
    );
  }

  // Low-poly coastline, marina and distant skyline beyond the collision bounds.
  // Circular coastline pieces are collision-tested with their visible footprint.
  for (let i = 0; i < 7; i++) island(151 + Math.sin(i) * 9, -139 + i * 44, 31, true);
  box(timber, 112, 0.7, 27, 34, 0.9, 4.8);
  box(timber, 112, 0.7, 42, 34, 0.9, 4.8);
  box(timber, 95, 0.7, 34.5, 4.6, 0.9, 19.8);
  // Round support pilings also model the long pier collision footprint.
  for (const z of [27, 42])
    for (let x = 96; x <= 130; x += 3.6) {
      instance(cylinder, timber, x, 0.4, z, 0.25, 2.8, 0.25);
      obstacles.push({ x, z, radius: 2.7 });
    }
  for (let z = 29; z < 42; z += 3.2) obstacles.push({ x: 95, z, radius: 2.6 });
  for (const z of [27, 42])
    for (let x = 98; x <= 128; x += 7.5) {
      box(cream, x, 1.3, z - 2.1, 0.4, 1.4, 0.4);
      box(cream, x, 1.3, z + 2.1, 0.4, 1.4, 0.4);
    }
  for (let i = 0; i < 18; i++) {
    const x = 161 + (i % 3) * 16 + random() * 3;
    const z = -128 + Math.floor(i / 3) * 44 + random() * 8;
    const height = 12 + random() * 28;
    const width = 8 + random() * 8;
    const depth = 8 + random() * 8;
    const towerMat = material(
      `tower-${i % 4}`,
      ['#afc4be', '#c9d8cb', '#91b6b8', '#e2d8bf'][i % 4],
    );
    box(towerMat, x, height / 2 + 1, z, width, height, depth);
    box(white, x, height + 1.3, z, width + 0.5, 0.7, depth + 0.5);
    for (let row = 0; row < Math.floor(height / 3.3); row++) {
      box(glass, x - width / 2 - 0.035, row * 3.3 + 3.5, z, 0.08, 1.4, depth * 0.78);
      box(glass, x, row * 3.3 + 3.5, z + depth / 2 + 0.035, width * 0.78, 1.4, 0.08);
    }
  }

  // A distant cable-stayed span adds a Tampa Bay silhouette without obstructing
  // the race or becoming a collision target outside the playable bounds.
  const bridgeZ = -180;
  box(material('bridge', '#c6d6c6'), -15, 15, bridgeZ, 290, 1.8, 10);
  for (const x of [-78, 48]) {
    for (const z of [bridgeZ - 3.8, bridgeZ + 3.8]) {
      box(cream, x, 21, z, 2, 42, 2);
      for (const sign of [-1, 1])
        for (let n = 1; n < 7; n++) {
          const dx = sign * n * 8.5;
          const length = Math.hypot(dx, 24);
          instance(
            cylinder,
            cream,
            x + dx / 2,
            28,
            z,
            0.09,
            length,
            0.09,
            0,
            0,
            -Math.atan2(dx, 24),
          );
        }
    }
  }

  // Navigation gates use two floating markers; the center stays completely open.
  const gateObjects = [];
  const digitSegments = [
    [1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 0, 0],
    [1, 1, 0, 1, 1, 0, 1],
    [1, 1, 1, 1, 0, 0, 1],
    [0, 1, 1, 0, 0, 1, 1],
    [1, 0, 1, 1, 0, 1, 1],
    [1, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1],
  ];
  const digitRects = [
    [0, 0.64, 0.65, 0.12],
    [0.34, 0.33, 0.12, 0.57],
    [0.34, -0.33, 0.12, 0.57],
    [0, -0.64, 0.65, 0.12],
    [-0.34, -0.33, 0.12, 0.57],
    [-0.34, 0.33, 0.12, 0.57],
    [0, 0, 0.65, 0.12],
  ];
  const buoyBaseGeometry = new THREE.CylinderGeometry(1.1, 1.5, 0.95, 12);
  const buoyCapGeometry = new THREE.ConeGeometry(0.68, 1.1, 12);
  function combineGateParts(gateGroup, colored) {
    gateGroup.updateMatrixWorld(true);
    const inverse = gateGroup.matrixWorld.clone().invert();
    const parts = new Map();
    gateGroup.traverse((object) => {
      if (!object.isMesh) return;
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (!parts.has(object.material)) parts.set(object.material, { positions: [], normals: [] });
      const batch = parts.get(object.material);
      batch.positions.push(...geometry.attributes.position.array);
      batch.normals.push(...geometry.attributes.normal.array);
      geometry.dispose();
    });
    gateGroup.clear();
    colored.length = 0;
    for (const [mat, part] of parts) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
      const combined = mesh(geometry, mat, 0, 0, 0, gateGroup);
      if (mat === seafoam) colored.push(combined);
    }
  }
  for (let index = 0; index < gates.length; index++) {
    const gate = gates[index];
    const gateGroup = new THREE.Group();
    gateGroup.position.set(gate.x, 0, gate.z);
    gateGroup.rotation.y = Math.atan2(gate.normal.x, gate.normal.z);
    gateGroup.name = index === 0 ? 'Finish gate' : `Checkpoint ${index}`;
    group.add(gateGroup);
    const colored = [];
    for (const side of [-1, 1]) {
      const marker = new THREE.Group();
      marker.position.x = side * gate.halfWidth;
      gateGroup.add(marker);
      colored.push(mesh(buoyBaseGeometry, seafoam, 0, 0.5, 0, marker));
      mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.95, 10), white, 0, 1.25, 0, marker);
      colored.push(mesh(buoyCapGeometry, seafoam, 0, 2.15, 0, marker));
      mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.8, 6), navy, 0, 3, 0, marker);
      const sign = mesh(new THREE.BoxGeometry(2.15, 2.2, 0.16), seafoam, 0, 3.8, 0, marker);
      colored.push(sign);
      if (index === 0) {
        for (const face of [-1, 1])
          for (let row = 0; row < 4; row++)
            for (let column = 0; column < 4; column++) {
              const square = mesh(
                new THREE.PlaneGeometry(0.46, 0.46),
                (row + column) % 2 ? navy : white,
                (column - 1.5) * 0.46,
                3.8 + (row - 1.5) * 0.46,
                face * 0.091,
                marker,
              );
              square.rotation.y = face === -1 ? Math.PI : 0;
            }
      } else {
        for (let s = 0; s < 7; s++)
          if (digitSegments[index][s]) {
            const [x, y, w, h] = digitRects[s];
            for (const face of [-1, 1])
              mesh(new THREE.BoxGeometry(w, h, 0.025), navy, face * x, 3.8 + y, face * 0.1, marker);
          }
      }
    }
    combineGateParts(gateGroup, colored);
    const laneMat = new THREE.MeshBasicMaterial({
      color: '#a3e9cf',
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lane = mesh(
      new THREE.PlaneGeometry(gate.halfWidth * 2 - 1.8, 1.25),
      laneMat,
      0,
      0.07,
      0,
      gateGroup,
    );
    lane.rotation.x = -Math.PI / 2;
    lane.castShadow = false;
    const arrowGeometry = new THREE.BufferGeometry();
    arrowGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-1.3, 0, 0, 0, 0, 1.2, 1.3, 0, 0, 0.68, 0, 0, 0, 0, 0.62, -0.68, 0, 0],
        3,
      ),
    );
    arrowGeometry.setIndex([0, 1, 4, 0, 4, 5, 1, 2, 3, 1, 3, 4]);
    arrowGeometry.computeVertexNormals();
    const arrow = mesh(
      arrowGeometry,
      new THREE.MeshBasicMaterial({
        color: '#fff2bb',
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      0,
      0.11,
      -4.8,
      gateGroup,
    );
    arrow.castShadow = false;
    gateObjects.push({ group: gateGroup, colored, lane, arrow, phase: random() * Math.PI * 2 });
  }

  // Instanced wavelets give the open water readable motion.
  const waveletGeometry = new THREE.PlaneGeometry(1, 0.16);
  waveletGeometry.rotateX(-Math.PI / 2);
  const waveletMaterial = new THREE.MeshBasicMaterial({
    color: '#b2e6d6',
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
  });
  const wavelets = new THREE.InstancedMesh(waveletGeometry, waveletMaterial, 130);
  wavelets.frustumCulled = false;
  const waveletPoints = [];
  for (let i = 0; i < 130; i++)
    waveletPoints.push({
      x: -160 + random() * 300,
      z: -160 + random() * 320,
      length: 0.7 + random() * 2.8,
      phase: random() * 6.28,
    });
  group.add(wavelets);
  for (const batch of batches.values()) {
    const instances = new THREE.InstancedMesh(batch.geometry, batch.mat, batch.matrices.length);
    batch.matrices.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
    instances.castShadow = true;
    instances.receiveShadow = true;
    instances.computeBoundingSphere();
    group.add(instances);
  }

  let activeGate = 1;
  function setActiveGate(index) {
    activeGate = Number.isInteger(index) && index >= 0 && index < gates.length ? index : -1;
    gateObjects.forEach((object, i) => {
      const active = i === activeGate;
      object.colored.forEach((piece) => {
        piece.material = active ? gold : seafoam;
      });
      object.lane.material.color.set(active ? '#ffe298' : '#a3e9cf');
      object.lane.material.opacity = active ? 0.32 : 0.1;
      object.arrow.visible = active;
    });
  }
  function update(elapsed = 0) {
    waterTime.value = elapsed;
    for (const object of gateObjects) {
      object.group.position.y = Math.sin(elapsed * 1.8 + object.phase) * 0.065;
      object.group.rotation.z = Math.sin(elapsed * 1.2 + object.phase) * 0.008;
      if (object.arrow.visible) {
        object.arrow.position.z = -4.8 + Math.sin(elapsed * 2.4) * 0.45;
        object.arrow.material.opacity = 0.63 + Math.sin(elapsed * 3) * 0.18;
      }
    }
    for (const ripple of islandRipples)
      ripple.mesh.scale.setScalar(
        ripple.radius * (1.028 + Math.sin(elapsed * 0.8 + ripple.phase) * 0.01),
      );
    for (let i = 0; i < waveletPoints.length; i++) {
      const point = waveletPoints[i];
      dummy.position.set(
        point.x + Math.sin(elapsed * 0.15 + point.phase) * 1.6,
        0.07,
        point.z + Math.sin(elapsed * 0.19 + point.phase) * 0.8,
      );
      dummy.rotation.set(0, -0.32, 0);
      dummy.scale.set(point.length * (0.72 + Math.sin(elapsed + point.phase) * 0.27), 1, 1);
      dummy.updateMatrix();
      wavelets.setMatrixAt(i, dummy.matrix);
    }
    wavelets.instanceMatrix.needsUpdate = true;
  }
  setActiveGate(1);
  update(0);
  return { group, gates, obstacles, bounds, update, setActiveGate };
}
