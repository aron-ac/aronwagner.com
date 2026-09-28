import * as THREE from '../vendor/three/three.module.js';

/**
 * Mark's olive four-door Wrangler, modeled from the four Jeep reference photos.
 * Front is +Z; wheel centers sit 0.66 units above the ground. No image textures.
 * Static details are combined by material to keep this little model inexpensive.
 */
export function createJeepModel() {
  const jeep = new THREE.Group();
  jeep.name = 'Marks_Olive_Wrangler';
  const material = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...extra });
  const mats = {
    olive: material('#697751', { roughness: 0.47, metalness: 0.18 }),
    oliveLight: material('#859064', { roughness: 0.48, metalness: 0.12 }),
    whiteShell: material('#f3f1e8', { roughness: 0.42, metalness: 0.08 }),
    black: material('#20282a'),
    rubber: material('#151b1b'),
    tread: material('#2a3030'),
    metal: material('#394347', { metalness: 0.65, roughness: 0.38 }),
    silver: material('#becaca', { metalness: 0.78, roughness: 0.3 }),
    glass: material('#183d46', { metalness: 0.38, roughness: 0.24, side: THREE.DoubleSide }),
    glint: material('#4e7277', { metalness: 0.35, roughness: 0.3, side: THREE.DoubleSide }),
    lamp: material('#fff7be', { emissive: '#ffe2a4', emissiveIntensity: 0.35 }),
    led: material('#eefbff', { emissive: '#c5ebff', emissiveIntensity: 0.6, roughness: 0.22 }),
    red: material('#db4638', { roughness: 0.42, metalness: 0.25 }),
    amber: material('#f5b953', { emissive: '#db750b', emissiveIntensity: 0.18 }),
    board: material('#ffb44c'),
    boardBlue: material('#43bec6'),
    cream: material('#fff5dd'),
  };
  for (const [name, mat] of Object.entries(mats)) mat.name = name;

  // A tiny geometry batcher: detail remains real geometry, without hundreds of draw calls.
  function batch(parent) {
    const sets = new Map();
    function add(geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) {
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(...position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
        new THREE.Vector3(1, 1, 1),
      );
      const baked = geometry.index ? geometry.toNonIndexed() : geometry;
      if (baked !== geometry) geometry.dispose();
      baked.applyMatrix4(matrix);
      if (!sets.has(mat)) sets.set(mat, []);
      sets.get(mat).push(baked);
    }
    function box(size, position, mat, rotation) {
      add(new THREE.BoxGeometry(...size), mat, position, rotation);
    }
    function rod(a, b, radius, mat, sides = 6) {
      const start = new THREE.Vector3(...a),
        end = new THREE.Vector3(...b);
      const delta = end.clone().sub(start);
      const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), sides);
      geometry.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()),
      );
      add(geometry, mat, start.add(end).multiplyScalar(0.5).toArray());
    }
    function panel(points, mat) {
      const vertices = [];
      for (let i = 1; i < points.length - 1; i++)
        vertices.push(...points[0], ...points[i], ...points[i + 1]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.computeVertexNormals();
      add(geo, mat);
    }
    function finish() {
      for (const [mat, chunks] of sets) {
        const count = chunks.reduce((n, chunk) => n + chunk.attributes.position.count, 0);
        const positions = new Float32Array(count * 3),
          normals = new Float32Array(count * 3);
        let offset = 0;
        for (const chunk of chunks) {
          positions.set(chunk.attributes.position.array, offset);
          normals.set(chunk.attributes.normal.array, offset);
          offset += chunk.attributes.position.array.length;
          chunk.dispose();
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.name = `${parent.name || 'Jeep'}_${mat.name || 'Detail'}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
      }
    }
    return { add, box, rod, panel, finish };
  }

  const body = batch(jeep);
  // Lifted frame, skid plate and solid axles.
  body.box([1.4, 0.18, 4.05], [0, 0.72, -0.03], mats.black);
  body.box([1.0, 0.13, 0.88], [0, 0.65, 1.63], mats.metal, [-0.15, 0, 0]);
  for (const z of [-1.5, 1.54]) {
    body.rod([-1.02, 0.65, z], [1.02, 0.65, z], 0.09, mats.metal);
    body.add(new THREE.SphereGeometry(0.18, 8, 6), mats.black, [0, 0.65, z]);
    for (const x of [-0.73, 0.73]) body.rod([x, 0.69, z], [x, 1.15, z + 0.1], 0.04, mats.amber);
  }

  // Olive four-door body with the low white hard shell visible beneath the rack.
  body.box([1.79, 0.61, 4.2], [0, 1.18, -0.08], mats.olive);
  body.box([1.75, 0.27, 1.48], [0, 1.58, 1.32], mats.olive);
  body.box([1.81, 0.09, 1.47], [0, 1.745, 1.34], mats.oliveLight);
  body.box([1.78, 0.84, 2.95], [0, 1.93, -0.7], mats.olive);
  body.box([1.78, 0.04, 3.03], [0, 2.36, -0.74], mats.black);
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.87, -1.475);
  roofShape.lineTo(0.87, -1.475);
  roofShape.lineTo(0.895, -1.43);
  roofShape.lineTo(0.895, 1.43);
  roofShape.lineTo(0.85, 1.475);
  roofShape.lineTo(-0.85, 1.475);
  roofShape.lineTo(-0.895, 1.43);
  roofShape.lineTo(-0.895, -1.43);
  roofShape.closePath();
  body.add(
    new THREE.ExtrudeGeometry(roofShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.04,
      bevelSegments: 1,
      steps: 1,
    }),
    mats.whiteShell,
    [0, 2.41, -0.73],
    [-Math.PI / 2, 0, 0],
  );
  // The front removable panels have a fine center seam and rear gasket.
  body.box([0.013, 0.007, 0.7], [0, 2.493, 0.35], mats.black);
  body.box([1.77, 0.008, 0.012], [0, 2.493, -0.015], mats.black);
  // Hood scoop, vents and latches.
  body.box([0.87, 0.15, 0.76], [0, 1.855, 1.25], mats.olive, [-0.06, 0, 0]);
  body.box([0.67, 0.085, 0.025], [0, 1.885, 1.64], mats.black);
  for (const x of [-0.72, 0.72]) {
    for (let i = 0; i < 3; i++)
      body.box([0.15, 0.025, 0.07], [x, 1.802, 1.0 + i * 0.18], mats.black, [
        0,
        0.2 * Math.sign(x),
        0,
      ]);
    body.box([0.055, 0.21, 0.075], [x * 1.22, 1.65, 1.83], mats.black);
  }

  // Windshield is a real sloping plane, edged by the pillars.
  body.panel(
    [
      [-0.8, 1.76, 0.99],
      [0.8, 1.76, 0.99],
      [0.8, 2.36, 0.73],
      [-0.8, 2.36, 0.73],
    ],
    mats.glass,
  );
  body.panel(
    [
      [-0.7, 2.24, 0.783],
      [0.75, 2.24, 0.783],
      [0.75, 2.3, 0.757],
      [-0.7, 2.3, 0.757],
    ],
    mats.glint,
  );
  body.rod([-0.86, 1.71, 1.015], [-0.86, 2.4, 0.715], 0.058, mats.olive);
  body.rod([0.86, 1.71, 1.015], [0.86, 2.4, 0.715], 0.058, mats.olive);
  body.box([1.75, 0.075, 0.075], [0, 1.746, 1.02], mats.black);
  for (const x of [-0.43, 0.39])
    body.rod([x - 0.26, 1.8, 0.987], [x + 0.25, 1.84, 0.97], 0.016, mats.black);

  for (const side of [-1, 1]) {
    const x = side * 0.9;
    // Front and back door windows, and the long rear quarter glass.
    body.panel(
      [
        [x, 1.72, -0.11],
        [x, 1.72, 0.76],
        [x, 2.32, 0.56],
        [x, 2.32, -0.11],
      ],
      mats.glass,
    );
    body.panel(
      [
        [x, 1.72, -1.08],
        [x, 1.72, -0.23],
        [x, 2.32, -0.23],
        [x, 2.32, -1.08],
      ],
      mats.glass,
    );
    body.panel(
      [
        [x, 1.72, -2.06],
        [x, 1.72, -1.2],
        [x, 2.32, -1.2],
        [x, 2.32, -2.06],
      ],
      mats.glass,
    );
    body.panel(
      [
        [x * 1.003, 2.23, -2.0],
        [x * 1.003, 2.23, -0.28],
        [x * 1.003, 2.28, -0.28],
        [x * 1.003, 2.28, -2.0],
      ],
      mats.glint,
    );
    // Door seams, handles and chunky external hinges.
    for (const z of [-1.14, -0.17, 0.83])
      body.box([0.015, 0.66, 0.016], [side * 0.903, 1.38, z], mats.black);
    for (const z of [-0.91, 0.03])
      body.box([0.055, 0.063, 0.23], [side * 0.935, 1.565, z], mats.black);
    for (const z of [-0.2, 0.81])
      for (const y of [1.16, 1.43]) body.box([0.085, 0.135, 0.12], [side * 0.93, y, z], mats.metal);
    body.rod([side * 0.9, 1.66, 0.7], [side * 1.15, 1.76, 0.73], 0.046, mats.black);
    body.box([0.2, 0.3, 0.22], [side * 1.17, 1.86, 0.75], mats.black);
    body.box([0.024, 0.2, 0.13], [side * 1.28, 1.88, 0.74], mats.glint);
    // Side steps/rock sliders leave a visible gap over the lifted suspension.
    body.rod([side * 1.0, 0.86, -1.08], [side * 1.0, 0.86, 1.11], 0.065, mats.black);
    body.rod([side * 1.15, 0.74, -0.94], [side * 1.15, 0.74, 0.92], 0.053, mats.black);
    for (const z of [-0.89, 0.02, 0.89])
      body.rod([side * 0.89, 0.88, z], [side * 1.15, 0.74, z], 0.044, mats.black);
    // Angular aftermarket fender flares follow the top half of each wheel arch.
    for (const z of [-1.5, 1.54]) {
      body.box([0.37, 0.11, 1.04], [side * 1.035, 1.52, z], mats.black);
      for (const direction of [-1, 1])
        body.box([0.37, 0.11, 0.48], [side * 1.035, 1.36, z + direction * 0.67], mats.black, [
          direction * 0.65,
          0,
          0,
        ]);
    }
    body.box([0.26, 0.035, 0.22], [side * 1.08, 1.56, 1.97], mats.amber);
    // Slender limb risers seen in the reference photos.
    body.rod([side * 0.86, 1.81, 1.93], [side * 0.88, 2.53, 0.71], 0.009, mats.metal, 4);
  }

  // Seven-slot grille and round headlights.
  body.box([1.74, 0.66, 0.105], [0, 1.395, 2.085], mats.oliveLight);
  for (let slot = -3; slot <= 3; slot++)
    body.box([0.082, 0.48, 0.015], [slot * 0.145, 1.41, 2.145], mats.black);
  for (const x of [-0.688, 0.688]) {
    body.add(
      new THREE.CylinderGeometry(0.19, 0.19, 0.06, 16),
      mats.black,
      [x, 1.535, 2.159],
      [Math.PI / 2, 0, 0],
    );
    body.add(
      new THREE.CylinderGeometry(0.145, 0.145, 0.068, 16),
      mats.lamp,
      [x, 1.535, 2.171],
      [Math.PI / 2, 0, 0],
    );
    body.box([0.125, 0.083, 0.02], [x, 1.21, 2.16], mats.amber);
  }
  // Winch bumper, bull bar and the characteristic red recovery shackles.
  body.box([1.96, 0.26, 0.36], [0, 0.99, 2.22], mats.black);
  body.box([0.83, 0.23, 0.25], [0, 1.17, 2.225], mats.metal);
  body.box([0.54, 0.1, 0.09], [0, 1.075, 2.421], mats.silver);
  body.box([0.36, 0.041, 0.015], [0, 1.075, 2.47], mats.black);
  body.rod([-0.51, 1.08, 2.42], [-0.51, 1.46, 2.32], 0.05, mats.black);
  body.rod([0.51, 1.08, 2.42], [0.51, 1.46, 2.32], 0.05, mats.black);
  body.rod([-0.51, 1.46, 2.32], [0.51, 1.46, 2.32], 0.05, mats.black);
  for (const x of [-0.73, 0.73]) {
    body.add(new THREE.TorusGeometry(0.09, 0.026, 5, 10), mats.red, [x, 0.865, 2.422]);
    body.box([0.16, 0.046, 0.05], [x, 0.962, 2.426], mats.red);
  }

  // Rear glass, spare carrier, bumper and tow hitch.
  body.box([1.57, 0.62, 0.015], [0, 2.03, -2.183], mats.glass);
  body.box([1.97, 0.23, 0.31], [0, 0.98, -2.23], mats.black);
  body.box([0.27, 0.16, 0.25], [0, 0.78, -2.35], mats.metal);
  body.box([0.55, 0.58, 0.2], [0, 1.53, -2.29], mats.black);
  for (const x of [-0.75, 0.75]) {
    body.box([0.23, 0.32, 0.095], [x, 1.39, -2.22], mats.black);
    body.add(new THREE.TorusGeometry(0.065, 0.025, 5, 10), mats.red, [x, 0.88, -2.398]);
  }

  // Flat Rhino-style cargo platform and low angular rails from the photographs.
  for (const x of [-0.78, 0.78]) {
    for (const z of [-1.86, -0.85, 0.18]) {
      body.box([0.15, 0.145, 0.22], [x, 2.53, z], mats.black);
      body.add(
        new THREE.CylinderGeometry(0.019, 0.019, 0.016, 6),
        mats.silver,
        [x + Math.sign(x) * 0.083, 2.535, z],
        [0, 0, Math.PI / 2],
      );
    }
    body.box([0.105, 0.12, 2.65], [x, 2.655, -0.78], mats.black);
    body.box([0.065, 0.075, 2.27], [x, 2.835, -0.84], mats.black);
    for (const z of [-1.94, -0.96, 0.25])
      body.rod([x, 2.685, z - 0.075], [x, 2.835, z], 0.034, mats.black, 4);
  }
  for (const z of [-2.06, 0.48]) body.box([1.66, 0.12, 0.1], [0, 2.655, z], mats.black);
  for (let z = -1.92; z < 0.44; z += 0.32)
    body.box([1.52, 0.065, 0.065], [0, 2.635, z], mats.metal);
  // Full-width windshield light bar: closely spaced squared LED pods, black
  // common housing and end brackets, rather than separate round spotlights.
  body.box([1.92, 0.105, 0.18], [0, 2.505, 0.805], mats.black);
  for (const side of [-1, 1]) {
    body.box([0.075, 0.19, 0.22], [side * 0.958, 2.505, 0.765], mats.metal);
    body.add(
      new THREE.CylinderGeometry(0.028, 0.028, 0.012, 6),
      mats.silver,
      [side * 1.002, 2.54, 0.79],
      [0, 0, Math.PI / 2],
    );
  }
  for (let i = 0; i < 16; i++) {
    const x = (i - 7.5) * 0.112;
    body.box([0.101, 0.18, 0.135], [x, 2.63, 0.8], mats.black, [-0.1, 0, 0]);
    body.box([0.078, 0.13, 0.019], [x, 2.634, 0.872], mats.silver, [-0.1, 0, 0]);
    body.box([0.058, 0.102, 0.02], [x, 2.634, 0.884], mats.led, [-0.1, 0, 0]);
    body.box([0.018, 0.023, 0.021], [x, 2.634, 0.896], mats.glint, [-0.1, 0, 0]);
  }
  body.finish();

  function makeWheel(name) {
    const wheel = new THREE.Group();
    wheel.name = name;
    const detail = batch(wheel);
    detail.add(
      new THREE.CylinderGeometry(0.61, 0.61, 0.44, 18),
      mats.rubber,
      [0, 0, 0],
      [0, 0, Math.PI / 2],
    );
    // Alternating blocks create a proper off-road tread silhouette when rolling.
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      for (const side of [-1, 1]) {
        const a = angle + side * 0.044;
        detail.box(
          [0.2, 0.072, 0.135],
          [side * 0.116, Math.cos(a) * 0.619, Math.sin(a) * 0.619],
          mats.tread,
          [a, side * 0.15, 0],
        );
      }
    }
    for (const side of [-1, 1]) {
      const x = side * 0.23;
      detail.add(
        new THREE.CylinderGeometry(0.355, 0.355, 0.032, 16),
        mats.black,
        [x, 0, 0],
        [0, 0, Math.PI / 2],
      );
      detail.add(
        new THREE.TorusGeometry(0.328, 0.024, 5, 16),
        mats.metal,
        [side * 0.256, 0, 0],
        [0, Math.PI / 2, 0],
      );
      detail.add(
        new THREE.CylinderGeometry(0.108, 0.108, 0.065, 8),
        mats.metal,
        [side * 0.267, 0, 0],
        [0, 0, Math.PI / 2],
      );
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        detail.box(
          [0.035, 0.052, 0.255],
          [side * 0.253, Math.cos(angle) * 0.2, Math.sin(angle) * 0.2],
          mats.metal,
          [angle + Math.PI / 2, 0, 0],
        );
      }
    }
    detail.finish();
    return wheel;
  }
  const wheels = [],
    frontSteering = [];
  for (const z of [-1.5, 1.54])
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.name = `${z > 0 ? 'Front' : 'Rear'}_${side < 0 ? 'Left' : 'Right'}_Wheel_Pivot`;
      pivot.position.set(side * 1.065, 0.66, z);
      const wheel = makeWheel(`${z > 0 ? 'Front' : 'Rear'}_${side < 0 ? 'Left' : 'Right'}_Wheel`);
      pivot.add(wheel);
      jeep.add(pivot);
      wheels.push(wheel);
      if (z > 0) frontSteering.push(pivot);
    }
  const spare = makeWheel('Full_Size_Rear_Spare');
  spare.rotation.y = Math.PI / 2;
  spare.position.set(0, 1.65, -2.49);
  jeep.add(spare);

  const brakeLights = [];
  const brakeMaterial = material('#d53b31', { emissive: '#e52e23', emissiveIntensity: 0.24 });
  for (const x of [-0.75, 0.75]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.164, 0.239, 0.025), brakeMaterial.clone());
    lamp.name = `${x < 0 ? 'Left' : 'Right'}_Brake_Light`;
    lamp.position.set(x, 1.39, -2.276);
    jeep.add(lamp);
    brakeLights.push(lamp);
  }

  // A pair of colorful boards makes a passenger's pickup visible at game scale.
  const surfboards = new THREE.Group();
  surfboards.name = 'Passenger_Surfboards';
  const boards = batch(surfboards);
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.66);
    shape.bezierCurveTo(0.42, 1.25, 0.36, -0.88, 0.19, -1.42);
    shape.quadraticCurveTo(0, -1.56, -0.19, -1.42);
    shape.bezierCurveTo(-0.36, -0.88, -0.42, 1.25, 0, 1.66);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.085,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.027,
      bevelThickness: 0.02,
      curveSegments: 8,
    });
    boards.add(
      geometry,
      side < 0 ? mats.board : mats.boardBlue,
      [side * 0.34, 2.88, -0.88],
      [-Math.PI / 2, 0, side * 0.025],
    );
    boards.box([0.042, 0.014, 2.55], [side * 0.34, 2.995, -0.8], mats.cream);
    boards.box([0.08, 0.035, 0.67], [side * 0.34, 3.02, -1.18], mats.black);
  }
  boards.finish();
  surfboards.visible = false;
  jeep.add(surfboards);

  jeep.userData = {
    wheels,
    frontSteering,
    surfboards,
    brakeLights,
    wheelRadius: 0.66,
    reference:
      'Olive four-door lifted Wrangler, white hard shell roof, black cargo platform, windshield LED light bar, scoop, winch and red recovery shackles',
  };
  return jeep;
}
