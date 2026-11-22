// Is the hand hitbox touching Alice? And pinch-to-lift while it is.
import { THREE } from "./libs.js";

export function createPickup(camera, modelRoot) {
  let character = null;
  let characterBox = null; // Alice's bounds inside modelRoot
  let liftAmount = 0;
  let isHolding = false;
  const corner = new THREE.Vector3();

  return {
    setTarget(target) {
      ({ character, characterBox, liftAmount } = target);
    },

    // True when the hand square (front-view coords -1..1) overlaps Alice as seen from the front camera.
    // Projects the 8 corners of her box to the screen, so it follows spin, tilt and zoom.
    touches(square) {
      if (!square || !characterBox) return false;
      let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
      const { min, max } = characterBox;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z)
          .applyMatrix4(modelRoot.matrixWorld)
          .project(camera);
        if (corner.x < x1) x1 = corner.x; if (corner.x > x2) x2 = corner.x;
        if (corner.y < y1) y1 = corner.y; if (corner.y > y2) y2 = corner.y;
      }
      return x1 <= square.x2 && x2 >= square.x1 && y1 <= square.y2 && y2 >= square.y1;
    },

    // Lift Alice. Returns true only on the pinch that picked her up.
    grab() {
      if (isHolding || !character) return false;
      isHolding = true;
      character.position.y += liftAmount;
      return true;
    },

    release() {
      if (!isHolding) return;
      character.position.y -= liftAmount;
      isHolding = false;
    },
  };
}
