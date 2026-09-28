/* Render the homepage thumbnail from the game's own geometry and camera lens. */
const { renderPreview } = require('./lib/preview.cjs');

renderPreview('surf-rides', async () => {
  const THREE = await import('./assets/vendor/three/three.module.js');
  const { createWorld } = await import('./assets/surf-rides/world.js');
  const { createJeepModel } = await import('./assets/surf-rides/jeep-model.js');
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
  scene.background = new THREE.Color(0xadcdbb);
  scene.fog = new THREE.Fog(0xadcdbb, 95, 230);
  scene.add(new THREE.HemisphereLight(0xfff8db, 0x527354, 2.6));
  const sun = new THREE.DirectionalLight(0xffead0, 3.4);
  sun.position.set(-90, 62, 36);
  sun.target.position.set(-58, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -28,
    right: 28,
    top: 28,
    bottom: -28,
    near: 1,
    far: 155,
  });
  sun.shadow.normalBias = 0.055;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const world = createWorld();
  scene.add(world.group);
  const jeep = createJeepModel();
  jeep.position.set(-57.5, 0, -10);
  jeep.rotation.y = 0.08;
  scene.add(jeep);
  const camera = createCamera(2);
  const look = new THREE.Vector3(-59.5, 1.2, -8);
  camera.position.copy(look).add(cameraOffset(21));
  camera.lookAt(look);
  renderer.render(scene, camera);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
