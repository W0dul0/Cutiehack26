// Loads the map + Alice, hides Alice at a random spot on the floor, and loads the 3D hand.
import { THREE, GLTFLoader } from "./libs.js";
import {
  MAP_URL, ALICE_URL, REMOVE_MAP_ALICE, PICKUP_LIFT, ALICE_BUBBLE_SCALE,
  ALICE_CLEARANCE, ALICE_FLOOR_TOLERANCE, ALICE_PLACE_ATTEMPTS, ALICE_MOVE_MIN_DISTANCE,
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

  // Alice's hitbox bubble, in parent space. Kept up to date in place, so everyone holding it sees moves.
  const characterSphere = new THREE.Sphere(new THREE.Vector3(), (Math.max(aliceSize.x, aliceSize.y, aliceSize.z) / 2) * ALICE_BUBBLE_SCALE);
  const centerOffset = new THREE.Vector3(0, aliceSize.y / 2, 0); // her pivot is at her feet
  const updateSphere = () => characterSphere.center.copy(alice.position).add(centerOffset).add(world.position);
  updateSphere();

  return {
    radius: mapSphere.radius,
    character: alice,
    characterSphere,
    liftAmount: aliceSize.y * PICKUP_LIFT,

    // Hide Alice somewhere new, away from where she is now. characterSphere follows.
    moveAlice() {
      parent.updateWorldMatrix(true, true);
      hide({ awayFrom: alice.position.clone() });
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

// Returns hide({ awayFrom }): tries random spots until one has flat, empty floor under Alice's whole footprint.
// Rays are dropped straight down from above the map: if any lands higher than the floor (a rock, the house,
// a mushroom...) or misses the map entirely (off the edge), that spot is rejected.
// With awayFrom, the new spot must also be ALICE_MOVE_MIN_DISTANCE footprints away (or as far as the map allows).
// Works in `world`'s own coordinates, so it still works after the map has been spun/tilted.
function createHider(world, map, alice, aliceSize, floorY) {
  const meshes = [];
  map.traverse((o) => { if (o.isMesh) meshes.push(o); });
  world.updateMatrixWorld(true);
  const mapBox = new THREE.Box3().setFromObject(map); // world is at the origin right now, so this is in world-local coords
  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const down = new THREE.Vector3();
  const footRadius = (Math.hypot(aliceSize.x, aliceSize.z) / 2) * ALICE_CLEARANCE; // covers her at any rotation
  const tolerance = aliceSize.y * ALICE_FLOOR_TOLERANCE;

  // Height (world-local) of the first thing a ray dropped at (x, z) hits, or null if it misses the map
  const surfaceAt = (x, z) => {
    from.set(x, mapBox.max.y + 1, z).applyMatrix4(world.matrixWorld);
    down.set(0, -1, 0).transformDirection(world.matrixWorld);
    ray.set(from, down);
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? world.worldToLocal(hit.point).y : null;
  };

  // Footprint samples: center, an inner ring and an outer ring
  const offsets = [[0, 0]];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    offsets.push([Math.cos(a) * footRadius, Math.sin(a) * footRadius]);
    offsets.push([Math.cos(a + 0.4) * footRadius * 0.5, Math.sin(a + 0.4) * footRadius * 0.5]);
  }

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const minDistance = footRadius * 2 * ALICE_MOVE_MIN_DISTANCE;

  return function hide({ awayFrom = null } = {}) {
    let best = null; // farthest clear spot so far: { x, y, z, distance }
    for (let attempt = 1; attempt <= ALICE_PLACE_ATTEMPTS; attempt++) {
      const x = rand(mapBox.min.x + footRadius, mapBox.max.x - footRadius);
      const z = rand(mapBox.min.z + footRadius, mapBox.max.z - footRadius);

      let highest = -Infinity;
      const clear = offsets.every(([dx, dz]) => {
        const y = surfaceAt(x + dx, z + dz);
        if (y === null || Math.abs(y - floorY) > tolerance) return false;
        highest = Math.max(highest, y);
        return true;
      });
      if (!clear) continue;

      const distance = awayFrom ? Math.hypot(x - awayFrom.x, z - awayFrom.z) : Infinity;
      if (!best || distance > best.distance) best = { x, y: highest, z, distance };
      if (distance >= minDistance) break; // far enough, done
    }

    if (!best) {
      console.warn("No clear spot found for Alice; she stays where she is");
      return;
    }
    alice.position.set(best.x, best.y, best.z); // feet exactly on the floor
    alice.rotation.y = Math.random() * Math.PI * 2;
    console.log(`Alice hidden at (${best.x.toFixed(2)}, ${best.z.toFixed(2)})`);
  };
}
