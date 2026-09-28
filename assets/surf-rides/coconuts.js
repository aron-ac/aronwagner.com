import * as THREE from '../vendor/three/three.module.js';

// One coconut per spot per shift: driving a route beats camping a respawn.
export function createCoconuts(collectibles) {
  const group = new THREE.Group();
  group.name = 'Collectible_Coconuts';
  const shell = new THREE.MeshStandardMaterial({
    color: '#795034',
    roughness: 1,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const flesh = new THREE.MeshStandardMaterial({
    color: '#fff5d9',
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const rim = new THREE.MeshStandardMaterial({ color: '#a77849', roughness: 1 });
  const halo = new THREE.MeshBasicMaterial({
    color: '#ffd276',
    transparent: true,
    opacity: 0.85,
    toneMapped: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadow = new THREE.MeshBasicMaterial({
    color: '#64502e',
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  const shellGeometry = new THREE.SphereGeometry(
    0.78,
    12,
    6,
    0,
    Math.PI * 2,
    Math.PI / 2,
    Math.PI / 2,
  );
  const fleshGeometry = new THREE.CircleGeometry(0.69, 12);
  const rimGeometry = new THREE.TorusGeometry(0.735, 0.045, 4, 12);
  const haloGeometry = new THREE.RingGeometry(0.95, 1.04, 24);
  const shadowGeometry = new THREE.CircleGeometry(0.77, 16);
  const items = collectibles.map((collectible, index) => {
    const { x, z } = collectible;
    const mesh = new THREE.Group();
    mesh.name = `Coconut_${index + 1}`;
    mesh.position.set(x, 0, z);
    const fruit = new THREE.Group();
    const husk = new THREE.Mesh(shellGeometry, shell);
    husk.castShadow = true;
    fruit.add(husk);
    const cut = new THREE.Mesh(fleshGeometry, flesh);
    cut.rotation.x = -Math.PI / 2;
    cut.position.y = 0.018;
    fruit.add(cut);
    const edge = new THREE.Mesh(rimGeometry, rim);
    edge.rotation.x = -Math.PI / 2;
    fruit.add(edge);
    fruit.position.y = 1.6;
    fruit.rotation.set(0.38, index * 0.65, -0.2);
    mesh.add(fruit);
    const ring = new THREE.Mesh(haloGeometry, halo);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.11;
    mesh.add(ring);
    const shade = new THREE.Mesh(shadowGeometry, shadow);
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = 0.1;
    mesh.add(shade);
    group.add(mesh);
    return {
      x,
      z,
      get active() {
        return collectible.active;
      },
      mesh,
      fruit,
      ring,
      phase: index * 0.8,
      burst: 0,
    };
  });

  function reset() {
    group.visible = true;
    for (const item of items) {
      item.burst = 0;
      item.mesh.visible = true;
      item.fruit.visible = true;
      item.ring.scale.setScalar(1);
    }
  }

  function collect(index) {
    const item = items[index];
    item.fruit.visible = false;
    item.burst = 0.35;
  }

  function update(dt, state) {
    if (state.mode !== 'playing') return;
    for (const item of items) {
      if (item.active) {
        item.fruit.position.y = 1.55 + Math.sin(state.elapsed * 2.8 + item.phase) * 0.16;
        item.fruit.rotation.y += dt * 0.6;
      } else if (item.burst > 0) {
        item.burst = Math.max(0, item.burst - dt);
        item.ring.scale.setScalar(1 + (1 - item.burst / 0.35) * 1.5);
        item.mesh.visible = item.burst > 0;
      }
    }
  }

  group.visible = false;
  return { group, items, reset, collect, update };
}
