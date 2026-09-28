import * as THREE from '../vendor/three/three.module.js';

/**
 * Photo-inspired 2011 Sea-Doo 230 Wake. Bow +Z, up +Y, waterline y=0.
 * Dimensions are deliberately simplified for the arcade game: 7.1 × 2.6 units.
 * Static geometry is batched by material; there are no network/image dependencies.
 */
export function createBoatModel({ driver = true } = {}) {
  const boat = new THREE.Group();
  boat.name = 'Marks_SeaDoo_230_Wake';
  const material = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
  const mats = {
    hull: material('#fafbf5', { roughness: 0.3, metalness: 0.13 }),
    inner: material('#dfe6df'),
    black: material('#192127', { roughness: 0.35, metalness: 0.15 }),
    rubber: material('#253137'),
    red: material('#e83439', { roughness: 0.56 }),
    canopyUnderside: material('#101619'),
    seat: material('#fff9ed', { roughness: 0.85 }),
    seam: material('#cbd2ca', { roughness: 0.9 }),
    floor: material('#b8b9aa', { roughness: 0.95 }),
    metal: material('#c0ccd0', { roughness: 0.25, metalness: 0.8 }),
    darkMetal: material('#4c6066', { roughness: 0.38, metalness: 0.7 }),
    glass: material('#7bb6c5', {
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.39,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    green: material('#5bedb7', { emissive: '#35b990', emissiveIntensity: 0.45 }),
    lamp: material('#ff4e4e', { emissive: '#b83131', emissiveIntensity: 0.45 }),
    skin: material('#e4ac80'),
    hair: material('#392922'),
    shirt: material('#272e33'),
    shorts: material('#39656c'),
  };
  Object.entries(mats).forEach(([name, mat]) => {
    mat.name = `boat_${name}`;
  });

  function batch(parent) {
    const buckets = new Map();
    function add(geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) {
      const baked = geometry.index ? geometry.toNonIndexed() : geometry;
      if (baked !== geometry) geometry.dispose();
      baked.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(...position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
          new THREE.Vector3(1, 1, 1),
        ),
      );
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(baked);
    }
    function box(size, pos, mat, rotation) {
      add(new THREE.BoxGeometry(...size), mat, pos, rotation);
    }
    function rod(a, b, radius, mat, sides = 8) {
      const from = new THREE.Vector3(...a),
        to = new THREE.Vector3(...b),
        delta = to.clone().sub(from);
      const geo = new THREE.CylinderGeometry(radius, radius, delta.length(), sides);
      geo.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()),
      );
      add(geo, mat, from.add(to).multiplyScalar(0.5).toArray());
    }
    function panel(points, mat) {
      const vertices = [];
      for (let i = 1; i < points.length - 1; i++)
        vertices.push(...points[0], ...points[i], ...points[i + 1]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      add(geometry, mat);
    }
    function pillow(w, h, d, pos, mat, rotation = [0, 0, 0], bevel = 0.045) {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 + bevel, -h / 2 + bevel);
      shape.lineTo(w / 2 - bevel, -h / 2 + bevel);
      shape.lineTo(w / 2 - bevel, h / 2 - bevel);
      shape.lineTo(-w / 2 + bevel, h / 2 - bevel);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.01, d - bevel * 2),
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 2,
        steps: 1,
      });
      geo.translate(0, 0, -d / 2 + bevel);
      add(geo, mat, pos, rotation);
    }
    function finish() {
      for (const [mat, pieces] of buckets) {
        const length = pieces.reduce(
          (total, geo) => total + geo.attributes.position.array.length,
          0,
        );
        const positions = new Float32Array(length),
          normals = new Float32Array(length);
        let offset = 0;
        for (const geo of pieces) {
          positions.set(geo.attributes.position.array, offset);
          normals.set(geo.attributes.normal.array, offset);
          offset += geo.attributes.position.array.length;
          geo.dispose();
        }
        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.name = mat.name;
        mesh.castShadow = mat !== mats.glass;
        mesh.receiveShadow = true;
        parent.add(mesh);
      }
    }
    return { add, box, rod, panel, pillow, finish };
  }
  const body = batch(boat);

  // Longitudinal hull stations. The bow rises and narrows into an actual V,
  // while the transom stays broad enough for the twin-jet swim platform.
  const stations = [
    [-3.22, 0.98, 0.63],
    [-2.75, 1.19, 0.72],
    [-1.75, 1.29, 0.8],
    [-0.55, 1.3, 0.83],
    [0.65, 1.22, 0.85],
    [1.6, 1.04, 0.88],
    [2.35, 0.79, 0.89],
    [2.92, 0.44, 0.86],
    [3.38, 0.045, 0.75],
  ];
  const point = (station, xFactor, y) => [
    station[1] * xFactor,
    typeof y === 'function' ? y(station) : y,
    station[0],
  ];
  function strip(aFactor, aY, bFactor, bY, mat, reverse = false) {
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i],
        b = stations[i + 1];
      const points = [
        point(a, aFactor, aY),
        point(b, aFactor, aY),
        point(b, bFactor, bY),
        point(a, bFactor, bY),
      ];
      body.panel(reverse ? points.reverse() : points, mat);
    }
  }
  for (const side of [-1, 1]) {
    const reverse = side < 0;
    strip(
      side,
      (s) => s[2],
      side * 0.945,
      (s) => 0.08 + Math.max(0, s[0] - 2.2) * 0.46,
      mats.hull,
      reverse,
    );
    strip(
      side * 0.945,
      (s) => 0.08 + Math.max(0, s[0] - 2.2) * 0.46,
      side * 0.71,
      (s) => -0.34 + Math.max(0, s[0] - 2.0) * 0.43,
      mats.black,
      reverse,
    );
    strip(
      side * 0.71,
      (s) => -0.34 + Math.max(0, s[0] - 2.0) * 0.43,
      0,
      (s) => -0.57 + Math.max(0, s[0] - 1.9) * 0.52,
      mats.black,
      reverse,
    );
    strip(
      side,
      (s) => s[2],
      side * 0.845,
      (s) => s[2] - 0.025,
      mats.hull,
      !reverse,
    );
    strip(side * 0.845, (s) => s[2] - 0.025, side * 0.76, 0.19, mats.inner, !reverse);
    // Continuous thin dark rub rail around the white upper hull.
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i],
        b = stations[i + 1];
      body.rod(
        [side * a[1] * 1.006, a[2] - 0.12, a[0]],
        [side * b[1] * 1.006, b[2] - 0.12, b[0]],
        0.019,
        mats.rubber,
        5,
      );
    }
  }
  // Interior floor and closed transom/foredeck; cockpit is genuinely open.
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i],
      b = stations[i + 1];
    body.panel(
      [
        [-a[1] * 0.76, 0.19, a[0]],
        [-b[1] * 0.76, 0.19, b[0]],
        [b[1] * 0.76, 0.19, b[0]],
        [a[1] * 0.76, 0.19, a[0]],
      ],
      mats.floor,
    );
  }
  body.panel(
    [
      [-0.98, 0.63, -3.22],
      [0.98, 0.63, -3.22],
      [0.93, 0.08, -3.22],
      [0.7, -0.34, -3.22],
      [0, -0.57, -3.22],
      [-0.7, -0.34, -3.22],
      [-0.93, 0.08, -3.22],
    ],
    mats.hull,
  );
  body.panel(
    [
      [-0.44, 0.86, 2.92],
      [-0.045, 0.75, 3.38],
      [0.045, 0.75, 3.38],
      [0.44, 0.86, 2.92],
    ],
    mats.hull,
  );

  // Broad stern swim platform with traction pads and stainless boarding ladder.
  body.pillow(2.05, 0.17, 0.66, [0, 0.27, -3.42], mats.hull);
  body.pillow(1.8, 0.035, 0.46, [0, 0.374, -3.43], mats.rubber, [0, 0, 0], 0.012);
  for (let i = 0; i < 5; i++)
    body.box([1.61, 0.013, 0.012], [0, 0.396, -3.61 + i * 0.078], mats.darkMetal);
  for (const x of [0.49, 0.89]) body.rod([x, 0.3, -3.67], [x, -0.12, -3.71], 0.024, mats.metal);
  for (const y of [-0.1, 0.1]) body.rod([0.49, y, -3.71], [0.89, y, -3.71], 0.024, mats.metal);
  // Twin jet nozzles rather than a propeller/outboard: distinctive to the Sea-Doo.
  for (const x of [-0.43, 0.43]) {
    body.add(
      new THREE.CylinderGeometry(0.145, 0.17, 0.22, 12),
      mats.darkMetal,
      [x, -0.18, -3.29],
      [Math.PI / 2, 0, 0],
    );
    body.add(
      new THREE.CylinderGeometry(0.108, 0.108, 0.016, 12),
      mats.black,
      [x, -0.18, -3.408],
      [Math.PI / 2, 0, 0],
    );
  }

  // Red bolsters and soft white cushions fill the open bow. The center aisle
  // stays open all the way between the split consoles and windshield.
  for (const side of [-1, 1]) {
    body.pillow(0.38, 0.19, 1.18, [side * 0.635, 0.43, 1.65], mats.seat, [0, side * -0.16, 0]);
    body.pillow(0.15, 0.4, 1.2, [side * 0.83, 0.68, 1.65], mats.red, [
      0,
      side * -0.21,
      side * -0.12,
    ]);
    body.pillow(0.3, 0.19, 0.6, [side * 0.28, 0.44, 2.57], mats.seat, [0, side * -0.55, 0]);
    body.pillow(0.12, 0.3, 0.64, [side * 0.46, 0.69, 2.5], mats.red, [
      0,
      side * -0.56,
      side * -0.16,
    ]);
    body.box([0.023, 0.014, 0.98], [side * 0.635, 0.538, 1.65], mats.seam, [0, side * -0.16, 0]);
    // Cockpit side lounges with red backrests, followed by the aft bench.
    body.pillow(0.45, 0.19, 1.39, [side * 0.85, 0.45, -1.6], mats.seat);
    body.pillow(0.17, 0.39, 1.44, [side * 1.082, 0.72, -1.61], mats.red, [0, 0, side * -0.12]);
    body.pillow(0.1, 0.21, 0.51, [side * 0.98, 0.61, -1.68], mats.seat);
    body.pillow(0.27, 0.08, 0.75, [side * 1.08, 0.925, -1.75], mats.seat);
  }
  body.pillow(1.94, 0.2, 0.66, [0, 0.46, -2.53], mats.seat);
  body.pillow(1.89, 0.4, 0.19, [0, 0.76, -2.81], mats.red, [-0.12, 0, 0]);
  body.pillow(0.59, 0.34, 0.205, [0, 0.76, -2.795], mats.seat, [-0.12, 0, 0]);
  body.pillow(1.91, 0.13, 0.37, [0, 0.865, -3.02], mats.red);
  for (const x of [-0.33, 0.33]) body.box([0.012, 0.01, 0.49], [x, 0.565, -2.53], mats.seam);

  // Two separate helm seats and sculpted consoles behind the low windshield.
  for (const side of [-1, 1]) {
    const x = side * 0.65;
    body.add(new THREE.CylinderGeometry(0.075, 0.1, 0.22, 8), mats.metal, [x, 0.31, -0.52]);
    body.pillow(0.54, 0.15, 0.57, [x, 0.51, -0.48], mats.seat);
    body.pillow(0.54, 0.46, 0.16, [x, 0.78, -0.76], mats.seat, [-0.13, 0, 0]);
    body.pillow(0.34, 0.31, 0.023, [x, 0.81, -0.668], mats.red, [-0.13, 0, 0], 0.011);
    body.pillow(0.63, 0.3, 0.55, [x, 0.73, 0.32], mats.hull, [-0.12, 0, 0]);
    body.pillow(0.57, 0.055, 0.34, [x, 0.897, 0.23], mats.black, [-0.18, 0, 0], 0.015);
    // Cupholders on the console, side benches and bow rails.
    for (const z of [-2.13, 1.37]) {
      const cx = side * (z > 0 ? 0.995 : 1.11);
      body.add(new THREE.CylinderGeometry(0.064, 0.064, 0.02, 12), mats.metal, [
        cx,
        z > 0 ? 0.87 : 0.923,
        z,
      ]);
      body.add(new THREE.CylinderGeometry(0.043, 0.043, 0.024, 12), mats.black, [
        cx,
        z > 0 ? 0.873 : 0.926,
        z,
      ]);
    }
  }

  // Wraparound windshield with center walk-through panel and slim silver trim.
  const panes = [
    [
      [-0.13, 0.87, 0.93],
      [-1.09, 0.83, 0.8],
      [-1.06, 1.25, 0.09],
      [-0.13, 1.36, 0.31],
    ],
    [
      [0.13, 0.87, 0.93],
      [0.13, 1.36, 0.31],
      [1.06, 1.25, 0.09],
      [1.09, 0.83, 0.8],
    ],
    [
      [-0.13, 0.87, 0.93],
      [-0.13, 1.36, 0.31],
      [0.13, 1.36, 0.31],
      [0.13, 0.87, 0.93],
    ],
    [
      [-1.09, 0.83, 0.8],
      [-1.15, 0.8, -0.56],
      [-1.06, 1.25, 0.09],
    ],
    [
      [1.09, 0.83, 0.8],
      [1.06, 1.25, 0.09],
      [1.15, 0.8, -0.56],
    ],
  ];
  for (const pane of panes) {
    body.panel(pane, mats.glass);
    for (let i = 0; i < pane.length; i++)
      body.rod(pane[i], pane[(i + 1) % pane.length], 0.018, mats.metal, 5);
  }
  body.pillow(0.24, 0.13, 0.065, [-0.17, 1.33, 0.24], mats.black, [0, -0.16, 0], 0.012);

  // Raked black wake tower, black canopy accent and double side braces.
  const towerPaths = [];
  for (const side of [-1, 1]) {
    const tower = [
      [side * 1.13, 0.8, -2.38],
      [side * 1.17, 1.25, -1.97],
      [side * 1.07, 2.28, -0.88],
      [side * 0.88, 2.5, -0.68],
    ];
    towerPaths.push(tower);
    for (let i = 0; i < tower.length - 1; i++)
      body.rod(tower[i], tower[i + 1], 0.062, mats.black, 8);
    body.rod([side * 1.11, 0.82, -1.9], [side * 1.07, 2.25, -0.85], 0.037, mats.black, 7);
    body.rod([side * 1.145, 1.12, -2.05], [side * 1.12, 1.53, -1.62], 0.037, mats.metal);
    body.pillow(
      0.23,
      0.12,
      0.38,
      [side * 1.12, 0.82, -2.25],
      mats.black,
      [0, 0, side * -0.12],
      0.025,
    );
    // Side-mounted silver wakeboard forks, visible beyond the hull outline.
    body.rod([side * 1.14, 1.53, -1.65], [side * 1.5, 1.53, -1.65], 0.04, mats.metal);
    for (const z of [-1.89, -1.62, -1.35]) {
      body.rod([side * 1.26, 1.51, z], [side * 1.57, 1.64, z], 0.026, mats.metal);
      body.rod([side * 1.57, 1.64, z], [side * 1.58, 1.74, z], 0.026, mats.metal);
    }
  }
  body.rod([-0.88, 2.5, -0.68], [0.88, 2.5, -0.68], 0.065, mats.black, 10);
  const canopy = [
    [-0.91, 2.52, -0.66],
    [-0.98, 2.47, -1.37],
    [0.98, 2.47, -1.37],
    [0.91, 2.52, -0.66],
  ];
  body.panel([...canopy].reverse(), mats.black);
  body.panel(canopy, mats.canopyUnderside);
  for (let i = 0; i < canopy.length; i++)
    body.rod(canopy[i], canopy[(i + 1) % canopy.length], 0.035, mats.black);
  body.rod([0, 2.51, -0.83], [0, 2.7, -0.83], 0.023, mats.metal);
  body.add(new THREE.SphereGeometry(0.055, 8, 6), mats.metal, [0, 2.69, -0.83]);
  // Four polished tower speakers point aft toward a wakeboard rider.
  for (const x of [-0.7, -0.39, 0.39, 0.7]) {
    body.rod([x, 2.49, -0.69], [x, 2.29, -0.7], 0.028, mats.metal);
    body.add(
      new THREE.CylinderGeometry(0.12, 0.105, 0.2, 12),
      mats.metal,
      [x, 2.28, -0.72],
      [Math.PI / 2, 0, 0],
    );
    body.add(
      new THREE.CylinderGeometry(0.09, 0.09, 0.013, 12),
      mats.black,
      [x, 2.28, -0.831],
      [Math.PI / 2, 0, 0],
    );
    body.add(
      new THREE.CylinderGeometry(0.039, 0.039, 0.016, 10),
      mats.darkMetal,
      [x, 2.28, -0.842],
      [Math.PI / 2, 0, 0],
    );
  }

  // Native geometric red/black rear slash graphics from the photographs.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = -2.63 + i * 0.18;
      const x = side * (1.224 + i * 0.013);
      const points = [
        [x, 0.14, z],
        [x, 0.14, z + 0.11],
        [x + side * 0.035, 0.68, z + 0.34],
        [x + side * 0.03, 0.69, z + 0.22],
      ];
      body.panel(side > 0 ? points.reverse() : points, i === 1 ? mats.red : mats.black);
    }
    // Bow hand rails, cleats and a small red/green navigation lamp.
    const rail = [
      [side * 0.95, 1.02, 1.35],
      [side * 0.83, 1.05, 2.06],
      [side * 0.44, 1.0, 2.82],
    ];
    for (let i = 0; i < rail.length - 1; i++) body.rod(rail[i], rail[i + 1], 0.024, mats.metal);
    for (const p of [rail[0], rail[2]]) body.rod([p[0], p[1] - 0.14, p[2]], p, 0.024, mats.metal);
    for (const [x, y, z] of [
      [side * 0.76, 0.91, 2.27],
      [side * 1.18, 0.855, -0.03],
      [side * 1.02, 0.8, -2.85],
    ]) {
      body.rod([x, y, z], [x, y + 0.05, z], 0.028, mats.metal);
      body.rod([x, y + 0.05, z - 0.09], [x, y + 0.05, z + 0.09], 0.027, mats.metal);
    }
    body.pillow(
      0.075,
      0.035,
      0.13,
      [side * 0.51, 0.89, 2.83],
      side < 0 ? mats.green : mats.lamp,
      [0, 0, 0],
      0.012,
    );
  }

  // Starboard helm: a separate wheel group lets the game animate steering.
  const steering = new THREE.Group();
  steering.name = 'Helm_Wheel';
  steering.position.set(-0.65, 0.92, -0.02);
  steering.rotation.x = -0.42;
  const helm = batch(steering);
  helm.add(new THREE.TorusGeometry(0.14, 0.023, 5, 16), mats.black);
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    helm.rod([0, 0, 0], [Math.sin(angle) * 0.13, Math.cos(angle) * 0.13, 0], 0.014, mats.metal, 5);
  }
  helm.add(
    new THREE.CylinderGeometry(0.036, 0.036, 0.04, 8),
    mats.black,
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
  );
  helm.finish();
  boat.add(steering);
  boat.userData.steeringWheel = steering;
  for (const x of [-0.78, -0.52])
    body.add(
      new THREE.CylinderGeometry(0.049, 0.049, 0.012, 12),
      mats.metal,
      [x, 0.929, 0.16],
      [-0.22, 0, 0],
    );
  body.rod([-0.97, 0.76, -0.15], [-0.97, 0.93, -0.12], 0.016, mats.metal);
  body.add(new THREE.SphereGeometry(0.035, 8, 5), mats.black, [-0.97, 0.93, -0.12]);

  if (driver) {
    // A simple friendly seated driver; keep the open red/white cockpit readable.
    body.pillow(0.35, 0.48, 0.26, [-0.65, 0.86, -0.48], mats.shirt, [0.05, 0, 0], 0.06);
    body.pillow(0.4, 0.14, 0.33, [-0.65, 0.63, -0.37], mats.shorts);
    body.add(new THREE.SphereGeometry(0.17, 10, 8), mats.skin, [-0.65, 1.23, -0.46]);
    body.add(
      new THREE.SphereGeometry(0.173, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.49),
      mats.hair,
      [-0.65, 1.27, -0.46],
    );
    body.box([0.27, 0.052, 0.045], [-0.65, 1.245, -0.307], mats.black);
    for (const side of [-1, 1]) {
      const shoulder = [-0.65 + side * 0.19, 1.01, -0.46];
      const elbow = [-0.65 + side * 0.23, 0.85, -0.22];
      const hand = [-0.65 + side * 0.115, 0.95, -0.02];
      body.rod(shoulder, elbow, 0.057, mats.skin);
      body.rod(elbow, hand, 0.046, mats.skin);
      body.add(new THREE.SphereGeometry(0.055, 8, 6), mats.skin, hand);
      body.rod(
        [-0.65 + side * 0.12, 0.59, -0.3],
        [-0.65 + side * 0.13, 0.32, -0.04],
        0.065,
        mats.skin,
      );
    }
  }
  body.finish();

  // Small canvas labels retain crisp type without publishing reference photos.
  // Node/SSR consumers still receive the complete geometric model.
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      context.font = 'italic 900 95px Arial, sans-serif';
      context.fillStyle = '#151d22';
      context.fillText('SEA-DOO', 20, 107);
      context.fillStyle = '#d92136';
      context.fillRect(24, 134, 145, 18);
      context.font = 'italic 900 104px Arial, sans-serif';
      context.fillStyle = '#1a2227';
      context.fillText('230 WAKE', 210, 218);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const labelMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        roughness: 0.5,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      labelMaterial.name = 'SeaDoo_Wake_Graphics';
      for (const side of [-1, 1]) {
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 0.365), labelMaterial);
        decal.name = 'SeaDoo_230_Wake_Side_Decal';
        decal.position.set(side * 1.291, 0.446, -0.92);
        decal.rotation.y = (side * Math.PI) / 2;
        boat.add(decal);
      }
    }
  }
  boat.userData.model = {
    name: 'Sea-Doo 230 Wake',
    year: 2011,
    length: 7.1,
    beam: 2.6,
    waterline: 0,
    forward: '+Z',
  };
  return boat;
}
