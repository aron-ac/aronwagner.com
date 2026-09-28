/* Render a homepage thumbnail from Bay Racer's own boat, water and course geometry. */
const { renderPreview } = require('./lib/preview.cjs');

renderPreview('bay-racer', async () => {
  const THREE = await import('./assets/vendor/three/three.module.js');
  const { createBayWorld } = await import('./assets/bay-racer/world.js');
  const { createBoatModel } = await import('./assets/bay-racer/boat-model.js');
  const { createCamera, cameraOffset } = await import('./assets/shared/camera-rig.js');
  document.body.replaceChildren();
  document.body.style = 'margin:0;overflow:hidden';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(1200, 600);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x91c5c9);
  scene.fog = new THREE.Fog(0x91c5c9, 120, 280);
  scene.add(new THREE.HemisphereLight(0xfff6df, 0x477b88, 2.6));
  const sun = new THREE.DirectionalLight(0xfff0db, 3.3);
  sun.position.set(-94, 62, 36);
  sun.target.position.set(-62, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -30,
    right: 30,
    top: 30,
    bottom: -30,
    near: 1,
    far: 155,
  });
  sun.shadow.normalBias = 0.055;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const world = createBayWorld();
  scene.add(world.group);
  world.setActiveGate(1);
  world.update(0);
  const boat = createBoatModel({ driver: true });
  boat.position.set(-62, 0, 0);
  boat.rotation.y = Math.atan2(18, 51);
  scene.add(boat);
  const camera = createCamera(2);
  const look = new THREE.Vector3(-62, 1.0, 0);
  camera.position.copy(look).add(cameraOffset(25));
  camera.lookAt(look);
  renderer.render(scene, camera);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
