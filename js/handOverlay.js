// The hand hitbox: a grey see-through square around thumb + index finger, shown in the front view.
import { THREE } from "./libs.js";
import { HUD_LAYER } from "./hologramViews.js";
import {
  SHOW_HAND_BOX, HAND_BOX_MAGNIFICATION, HAND_BOX_GROW, HAND_BOX_OPACITY,
  OVERLAY_FADE, START_DISTANCE,
} from "./config.js";

// Hand landmarks -> hitbox square in front-view coords (-1..1, y up, mirrored like the webcam).
// Covers thumb 2-4 + index 5-8, made square and grown by HAND_BOX_GROW.
export function handSquare(hand) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  for (let i = 2; i <= 8; i++) {
    const x = (1 - hand[i].x) * 2 - 1, y = 1 - hand[i].y * 2;
    if (x < x1) x1 = x; if (x > x2) x2 = x;
    if (y < y1) y1 = y; if (y > y2) y2 = y;
  }
  const m = HAND_BOX_MAGNIFICATION;
  const cx = ((x1 + x2) / 2) * m, cy = ((y1 + y2) / 2) * m;
  const half = (Math.max(x2 - x1, y2 - y1) / 2) * HAND_BOX_GROW * m;
  return { x1: cx - half, x2: cx + half, y1: cy - half, y2: cy + half };
}

export function createHandOverlay(scene, camera) {
  const ignoreRaycast = () => {};

  // Cyan outline around the front view; fades in while a hand is tracked
  const borderMat = new THREE.LineBasicMaterial({
    color: 0x00ffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false,
  });
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(7.2, 7.2)), borderMat);
  border.layers.set(HUD_LAYER);
  border.raycast = ignoreRaycast;
  scene.add(border);

  // The hitbox square: grey, see-through, drawn on top of everything, front view only
  const handBox = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x808080, transparent: true, opacity: HAND_BOX_OPACITY,
      side: THREE.DoubleSide, depthWrite: false, depthTest: false,
    })
  );
  handBox.renderOrder = 999;
  handBox.visible = false;
  handBox.layers.set(HUD_LAYER);
  handBox.raycast = ignoreRaycast;
  scene.add(handBox);

  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  return {
    // Call every frame. square = handSquare(...) or null when no hand.
    update(dt, distance, square) {
      const k = distance / START_DISTANCE; // border was sized for START_DISTANCE
      border.scale.setScalar(k);
      border.position.z = 4 * k;
      borderMat.opacity = THREE.MathUtils.damp(borderMat.opacity, square ? 0.85 : 0, OVERLAY_FADE, dt);

      handBox.visible = SHOW_HAND_BOX && !!square;
      if (!handBox.visible) return;
      // Front-view coords -> world units on the z=0 plane the front camera looks at
      const unitH = distance * tanHalfFov, unitW = unitH * camera.aspect;
      handBox.position.set(((square.x1 + square.x2) / 2) * unitW, ((square.y1 + square.y2) / 2) * unitH, 0);
      handBox.scale.set((square.x2 - square.x1) * unitW, (square.y2 - square.y1) * unitH, 1);
    },
  };
}
