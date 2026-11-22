// Pinch-to-pick-up: raycast from the front camera at the character's hit sphere.
import { THREE } from "./libs.js";
import { PICKUP_LIFT } from "./config.js";

export function createPickup(camera) {
  const ray = new THREE.Raycaster();
  const screenPoint = new THREE.Vector2();
  let character = null;
  let hitSphere = null;
  let isHolding = false;

  // What the pinch point touches: { object, name, point, distance } or null
  function cast(point) {
    if (!point || !hitSphere) return null;
    ray.setFromCamera(screenPoint.set(point.x, point.y), camera);
    const h = ray.intersectObject(hitSphere)[0];
    return h ? { object: h.object, name: h.object.name, point: h.point, distance: h.distance } : null;
  }

  return {
    cast,

    setTarget(newCharacter, newHitSphere) {
      character = newCharacter;
      hitSphere = newHitSphere;
    },

    // Lifts the character if the pinch touches it. pickedUp = true only on the pinch that lifted it.
    grab(point) {
      const hit = cast(point);
      const pickedUp = !!hit && !isHolding;
      if (pickedUp) {
        isHolding = true;
        character.position.y += PICKUP_LIFT;
      }
      return { hit, pickedUp };
    },

    release() {
      if (!isHolding) return;
      character.position.y -= PICKUP_LIFT;
      isHolding = false;
    },
  };
}
