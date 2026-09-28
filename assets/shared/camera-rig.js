import * as THREE from '../vendor/three/three.module.js';

// A 25° lens and a 34.2° elevated diagonal give the driving view its depth.
// Shared with the project preview so the Jeep and landscape keep one perspective.
export const CAMERA_FOV = 25;
export const CAMERA_ELEVATION = Math.PI * 0.19;
export const CAMERA_AZIMUTH = Math.PI / 4;

export function createCamera(aspect = 1) {
  return new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 450);
}

export function cameraOffset(distance) {
  return new THREE.Vector3().setFromSphericalCoords(
    distance,
    Math.PI / 2 - CAMERA_ELEVATION,
    CAMERA_AZIMUTH,
  );
}
