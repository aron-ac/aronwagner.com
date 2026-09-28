# Sea-Doo 230 Wake model

`boat-model.js` builds an original, simplified low-poly version of Mark's 23-foot 2011 Sea-Doo 230 Wake for the Bay Racer demo. It uses the project's vendored Three.js and does not request external textures or libraries.

## Reference review

All three reference photographs in the owner’s private `Mark Hammonds Photos/Boat` folder outside the repository were inspected before modeling:

- `150499-fbfa2ebbede657f4338363c3dd98200a.jpg`: side profile, white upper hull, black lower hull, raked black tower and Wake branding.
- `150501-2c72c5f0ebdec7d71410ae9683e6ac49.jpg`: front three-quarter view, pointed bow, open red-and-white seating, wraparound windshield, red-accented tower and side board racks.
- `2000000003.jpg`: cockpit and bow seating arrangement, silver windshield trim, tower speakers, stern red/black graphics and rear seating.

The files were already JPEGs, so no image conversion was necessary. Personal reference images remain outside the public repository. The model combines the characteristic visible details across these references; small trim and graphics are simplified for legibility at game scale.

## Geometry and materials

The game model retains the red upholstery and hull graphics from the reference photos, with the wake tower and its top accent kept black at Mark's request.

- Shaped longitudinal hull stations form the pointed bow and V-shaped black underside; the boat is not a box or billboard.
- A white deck rim surrounds an open cockpit and bow with an unobstructed center walkway, red bolsters, ivory cushions, helm seats, cupholders and console controls.
- The windshield consists of five translucent panes, slim silver frames and a center walk-through panel.
- A rear-raked black wake tower carries a narrow black canopy, four silver speakers, a tow attachment and silver board racks.
- The stern has an upholstered aft bench, swim platform, traction pad, ladder and twin jet nozzles.
- Native geometric red/black stern graphics accompany locally generated `SEA-DOO / 230 WAKE` canvas lettering. No photo textures are included.
- A simple optional seated driver has a dark shirt and sunglasses.

Static details are combined by material. The default browser model contains 22 meshes and about 20,600 vertices, including the driver, helm and generated side labels. The reference files are low resolution; this is a stylized arcade model rather than a dimensionally exact engineering asset.

## Public interface

```js
import { createBoatModel } from './boat-model.js';

const boat = createBoatModel({ driver: true }); // driver defaults to true
scene.add(boat);

// Optional helm animation; the model itself never changes root position/rotation.
boat.userData.steeringWheel.rotation.z = steeringInput * 0.6;
```

Coordinates: bow/forward is `+Z`, up is `+Y`, and the waterline is `y=0`. The hull beam is approximately 2.6 units; board racks widen the overall envelope to 3.21. Length including the platform is about 7.14, keel depth is approximately -0.57, and the highest tow attachment is around 2.75. The game can scale, pitch, roll and translate the returned `THREE.Group` freely.

`boat.userData.model` contains the name, year, nominal length/beam, waterline and forward direction. `boat.userData.steeringWheel` references the separate helm group. Browser canvas support adds the two side decals; geometry still works in environments without `document`.

## Validation

The module passed `node --check` and was rendered in Chrome from bow and stern three-quarter views. Those checks verified open interior visibility, windshield transparency, seat fit inside the narrowing bow, forward hull-face orientation, stern equipment and readable branding. Reference photos and temporary inspection screenshots were not added to the site.
