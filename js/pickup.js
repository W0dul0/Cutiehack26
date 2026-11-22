// Is the hand hitbox touching Alice's hitbox bubble? And pinch-to-lift while it is.
import { THREE } from "./libs.js";

export function createPickup(camera, modelRoot) {
  let character = null;
  let characterSphere = null; // Alice's hitbox bubble, inside modelRoot
  let liftAmount = 0;
  let isHolding = false;
  const center = new THREE.Vector3();
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  return {
    setTarget(target) {
      ({ character, characterSphere, liftAmount } = target);
    },

    // True when the hand square (front-view coords -1..1) overlaps Alice's bubble as seen from the front camera.
    // Follows spin, tilt and zoom because the bubble lives inside modelRoot.
    touches(square) {
      if (!square || !characterSphere) return false;
      center.copy(characterSphere.center).applyMatrix4(modelRoot.matrixWorld);
      const radiusY = characterSphere.radius / (center.distanceTo(camera.position) * tanHalfFov); // on-screen radius
      const radiusX = radiusY / camera.aspect;
      center.project(camera);

      // Closest point of the square to the bubble's center, then "is it inside the bubble?"
      const dx = (center.x - THREE.MathUtils.clamp(center.x, square.x1, square.x2)) / radiusX;
      const dy = (center.y - THREE.MathUtils.clamp(center.y, square.y1, square.y2)) / radiusY;
      return dx * dx + dy * dy <= 1;
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
