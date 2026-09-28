# Mark's Jeep

`mark-jeep.glb` is a self-contained glTF 2.0 binary model with geometry and materials embedded. It has no external images, fonts, textures, or network dependencies. Import it into Blender, a glTF viewer, or a game engine. The portable model includes the white hard-shell roof underneath the empty black cargo rack; the playable game adds surfboards when a passenger boards.

The original procedural source is `jeep-model.js`. It was built from four owner-provided Jeep photographs: `IMG_1731`, `IMG_3871`, `IMG_3873`, and `IMG_3875`. Their HEIC originals were retained, and full-resolution JPEG copies were created with macOS `sips` in the private `Mark Hammonds Photos/Jeep/JPG/` folder outside the repository. Personal reference photographs are not included in the website or model.

## Design

The model preserves the olive four-door Wrangler body, white hard-shell roof, black cargo platform with low angular side rails, and full-width windshield light bar with 16 tightly spaced squared LED pods and end brackets. The white top has beveled edges, a dark gasket and removable-panel seams; it remains visible below the rack with or without passenger boards. The olive rear side panels match the photographs. No separate roof luggage box has been invented.

Other details include lifted suspension, chunky off-road tires, black flares and side steps, dark glass, external door hinges, hood scoop, seven-slot grille, round headlights, winch and bull bar, red recovery shackles, and full-size rear spare. Details are deliberately simplified for the game's illustrated arcade style. License plates are omitted.

- Orientation: Y is up; the front faces +Z; the tires rest at approximately Y = 0.
- Dimensions: approximately 2.73 wide × 2.88 high × 5.27 long, including mirrors, tread blocks, spare and bumpers. Passenger boards raise the height to approximately 3.04. These are game units, not engineering measurements.
- Portable GLB: 753,324 bytes, 34 mesh batches, 10,100 triangles, no image textures.
- Four named wheel pivots and their wheel children are retained for animation; left/right brake lamps are named separately.

## Procedural API

```js
import { createJeepModel } from './jeep-model.js';
const jeep = createJeepModel();
scene.add(jeep);

jeep.userData.wheels.forEach((wheel) => {
  wheel.rotation.x += distance / 0.66;
});
jeep.userData.frontSteering.forEach((pivot) => {
  pivot.rotation.y = steeringAngle;
});
jeep.userData.surfboards.visible = carryingPassenger;
jeep.userData.brakeLights.forEach((light) => {
  light.material.emissiveIntensity = braking ? 1.2 : 0.24;
});
```

`wheelRadius` is also available in `userData`. The procedural object's animation references in `userData` are live Three.js objects; remove those references before serializing it. The GLB has already been exported with clean metadata. Surfboards are a separate group in the procedural source and start hidden.

## Provenance and validation

All vehicle geometry was created specifically for this project; no third-party mesh was downloaded. This document does not assign an additional license to the project's original model. Three.js and its export/import utilities are MIT-licensed; see the [dependency's license](../vendor/three/LICENSE). The Jeep name identifies the vehicle depicted; the model is an unofficial stylized depiction.

Exported using Three.js `GLTFExporter` 0.180.0 and successfully loaded back through `GLTFLoader` 0.180.0, checking finite mesh data, white-shell and LED-bar materials, and all four named wheel pivots. Export/import utilities were used as temporary development tools and are not runtime dependencies. The revised source model was rendered in Chrome from front and rear perspectives and with passenger boards to inspect the roof contrast, light bar, rack clearance, materials and shadow.
