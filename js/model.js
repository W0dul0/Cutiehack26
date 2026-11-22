// Loads the map + Alice, hides Alice at a random spot on the floor, and loads the 3D hand.
import { THREE, GLTFLoader } from "./libs.js";
import {
  MAP_URL, ALICE_URL, REMOVE_MAP_ALICE, PICKUP_LIFT, ALICE_BUBBLE_SCALE,
  ALICE_CLEARANCE, ALICE_FLATNESS, ALICE_MAX_GROUND_RISE, ALICE_PLACE_ATTEMPTS, ALICE_MOVE_MIN_DISTANCE,
  HAND_GLB_URL, HAND_MODEL_ROTATION,
} from "./config.js";

const loader = new GLTFLoader();

// The 3D hand, stood up (HAND_MODEL_ROTATION) and fitted into a 1x1 square centered on the origin,
// so scaling it by the grey square's size makes it match the square.
export async function loadHandModel() {
  const hand = (await loader.loadAsync(HAND_GLB_URL)).scene;
  hand.rotation.set(...HAND_MODEL_ROTATION.map(THREE.MathUtils.degToRad));
  hand.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); // skinned meshes can be culled by mistake

  const holder = new THREE.Group();
  holder.add(hand);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(hand);
  const size = box.getSize(new THREE.Vector3());
  const fit = 1 / Math.max(size.x, size.y);
  hand.scale.multiplyScalar(fit);
  hand.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-fit));
  return holder;
}

// Loads both models into `parent` (modelRoot). Returns what the rest of the app needs:
//   radius          size of the map, for fitting the camera
//   character       Alice (move her .position to lift her)
//   characterSphere her hitbox bubble, in parent space
//   liftAmount      how far a pinch lifts her
export async function loadWorld(parent) {
  const [mapGltf, aliceGltf] = await Promise.all([loader.loadAsync(MAP_URL), loader.loadAsync(ALICE_URL)]);
  const map = mapGltf.scene;

  // Build everything in a standalone group (no parent rotation yet) so "down" really is down
  const world = new THREE.Group();
  world.add(map);
  removeBuiltInAlice(map);

  // Alice sits in a pivot at her feet, so she can be moved and turned around her own center
  const alice = new THREE.Group();
  alice.name = "Alice";
  world.add(alice);
  alice.add(aliceGltf.scene);
  world.updateMatrixWorld(true);
  const original = new THREE.Box3().setFromObject(aliceGltf.scene);
  const feet = new THREE.Vector3((original.min.x + original.max.x) / 2, original.min.y, (original.min.z + original.max.z) / 2);
  aliceGltf.scene.position.sub(feet);
  alice.position.copy(feet);

  const hide = createHider(world, map, alice, original.getSize(new THREE.Vector3()), feet.y);
  hide();

  // Measure Alice and the map while `world` is still standalone at the origin
  world.updateMatrixWorld(true);
  const aliceSize = new THREE.Box3().setFromObject(alice).getSize(new THREE.Vector3());
  const mapSphere = new THREE.Box3().setFromObject(map).getBoundingSphere(new THREE.Sphere());

  // Center the map on the parent so it spins in place
  world.position.copy(mapSphere.center).negate();
  parent.add(world);

  // The map and Alice's own parts never move relative to their parents: bake their matrices once instead of
  // recomputing them every frame. Only `world` and Alice's pivot (`alice`) still update, since those do move.
  for (const still of [map, aliceGltf.scene]) {
    still.traverse((o) => {
      o.updateMatrix();
      o.matrixAutoUpdate = false;
    });
  }

  // Alice's hitbox bubble, in parent space. Kept up to date in place, so everyone holding it sees moves.
  const characterSphere = new THREE.Sphere(new THREE.Vector3(), (Math.max(aliceSize.x, aliceSize.y, aliceSize.z) / 2) * ALICE_BUBBLE_SCALE);
  const centerOffset = new THREE.Vector3(0, aliceSize.y / 2, 0); // her pivot is at her feet
  const updateSphere = () => characterSphere.center.copy(alice.position).add(centerOffset).add(world.position);
  updateSphere();
  const lastSpot = new THREE.Vector3();

  return {
    radius: mapSphere.radius,
    character: alice,
    characterSphere,
    liftAmount: aliceSize.y * PICKUP_LIFT,

    // Hide Alice somewhere new, away from where she is now. characterSphere follows.
    moveAlice() {
      parent.updateWorldMatrix(true, true);
      hide({ awayFrom: lastSpot.copy(alice.position) });
      updateSphere();
    },
  };
}

// The map ships with its own Alice; remove her (raycasts would still hit her if she were only hidden)
function removeBuiltInAlice(map) {
  if (!REMOVE_MAP_ALICE) return;
  const prefix = REMOVE_MAP_ALICE.toLowerCase();
  const found = [];
  map.traverse((o) => { if (o.name.toLowerCase().startsWith(prefix)) found.push(o); });
  found.forEach((o) => o.removeFromParent());
}

// Returns hide({ awayFrom }): tries random spots + facings until the ground under Alice's whole footprint is clear.
// Rays are dropped straight down from above the map over a grid covering her footprint (turned the way she'll
// face). If any ray lands on something sticking up (a rock, the house, a mushroom...), on a slope that's too
// steep, or misses the map (off the edge), that spot is rejected. Using her real rectangle (not a circle around
// her) lets her fit the narrow side gardens beside and behind the house.
// With awayFrom, the new spot must also be ALICE_MOVE_MIN_DISTANCE footprints away (or as far as the map allows).
// Works in `world`'s own coordinates, so it still works after the map has been spun/tilted.
function createHider(world, map, alice, aliceSize, floorY) {
  const meshes = [];
  map.traverse((o) => { if (o.isMesh) meshes.push(o); });
  world.updateMatrixWorld(true);
  const mapBox = new THREE.Box3().setFromObject(map); // world is at the origin right now, so this is in world-local coords

  const halfW = (aliceSize.x / 2) * ALICE_CLEARANCE; // her footprint rectangle, before turning
  const halfD = (aliceSize.z / 2) * ALICE_CLEARANCE;
  const flatness = aliceSize.y * ALICE_FLATNESS;                      // max height difference under her
  const lowestGround = floorY - flatness;                             // ground can't be lower than the floor...
  const highestGround = floorY + aliceSize.y * ALICE_MAX_GROUND_RISE; // ...or much higher (grass yes, rooftops no)
  const minDistance = Math.hypot(halfW, halfD) * 2 * ALICE_MOVE_MIN_DISTANCE;

  // Footprint grid: center first (cheapest early reject), then a 4x4 grid over her rectangle
  const grid = [[0, 0]];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) grid.push([(-1 + (2 * i) / 3) * halfW, (-1 + (2 * j) / 3) * halfD]);

  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const down = new THREE.Vector3();
  const toLocal = new THREE.Matrix4();
  const hitLocal = new THREE.Vector3();
  // Rays start just above her head at the highest ground she may stand on: roofs and branches overhead
  // don't block her, but anything she'd actually bump into is still in the rays' way.
  const top = highestGround + aliceSize.y * 1.05;

  // Height (world-local) of the first thing a ray dropped at (x, z) hits, or null if it misses the map
  const surfaceAt = (x, z) => {
    ray.set(from.set(x, top, z).applyMatrix4(world.matrixWorld), down);
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? hitLocal.copy(hit.point).applyMatrix4(toLocal).y : null;
  };

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  return function hide({ awayFrom = null } = {}) {
    // The map's current spin/tilt, worked out once per hide instead of once per ray
    world.updateWorldMatrix(true, false);
    toLocal.copy(world.matrixWorld).invert();
    down.set(0, -1, 0).transformDirection(world.matrixWorld);

    let best = null; // farthest clear spot so far: { x, y, z, yaw, distance }
    for (let attempt = 1; attempt <= ALICE_PLACE_ATTEMPTS; attempt++) {
      const x = rand(mapBox.min.x, mapBox.max.x); // off-map rays miss, so no margin needed
      const z = rand(mapBox.min.z, mapBox.max.z);
      const yaw = Math.random() * Math.PI * 2;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);

      // Clear = every ray hits ground-height surface, all within `flatness` of each other
      let lowest = Infinity, highest = -Infinity, centerY = 0;
      const clear = grid.every(([u, v], k) => {
        const y = surfaceAt(x + u * cos + v * sin, z - u * sin + v * cos); // same turn as alice.rotation.y = yaw
        if (y === null || y < lowestGround || y > highestGround) return false;
        if (k === 0) centerY = y;
        if (y < lowest) lowest = y;
        if (y > highest) highest = y;
        return highest - lowest <= flatness;
      });
      if (!clear) continue;

      const distance = awayFrom ? Math.hypot(x - awayFrom.x, z - awayFrom.z) : Infinity;
      if (!best || distance > best.distance) best = { x, y: centerY, z, yaw, distance };
      if (distance >= minDistance) break; // far enough, done
    }

    if (!best) {
      console.warn("No clear spot found for Alice; she stays where she is");
      return;
    }
    // Feet planted at the middle of her footprint, so on a slope she doesn't float over the low side
    alice.position.set(best.x, best.y, best.z);
    alice.rotation.y = best.yaw;
    console.log(`Alice hidden at (${best.x.toFixed(2)}, ${best.z.toFixed(2)})`);
  };
}
