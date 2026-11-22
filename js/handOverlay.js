// Hitbox visuals in the front view: the hand's grey square and Alice's red bubble.
import { THREE } from "./libs.js";
import { HUD_LAYER } from "./hologramViews.js";
import {
  SHOW_HITBOXES, HAND_BOX_MAGNIFICATION, HAND_BOX_GROW, HAND_BOX_OPACITY,
  OVERLAY_FADE, BORDER_IDLE_OPACITY, BORDER_ACTIVE_OPACITY,
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

  // Blue "touch area" border: outlines everywhere the hand hitbox can reach.
  // Lives in its own flat HUD scene (coords -1..1 = the edges of a view), drawn on top of ALL 4 views.
  // Dim while no hand is seen, bright while one is.
  const hudScene = new THREE.Scene();
  const edge = HAND_BOX_MAGNIFICATION * 0.98; // hand reach, nudged inside so the line isn't cut off at the view edge
  const borderMat = new THREE.LineBasicMaterial({
    color: 0x00ffff, transparent: true, opacity: BORDER_IDLE_OPACITY, depthTest: false,
  });
  const border = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-edge, -edge, 0), new THREE.Vector3(edge, -edge, 0),
      new THREE.Vector3(edge, edge, 0), new THREE.Vector3(-edge, edge, 0),
    ]),
    borderMat
  );
  hudScene.add(border);

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

  // Alice's hitbox: see-through red bubble, brighter while the hand is hitting it
  const bubbleMat = new THREE.MeshBasicMaterial({
    color: 0xff0000, transparent: true, opacity: 0.2, depthWrite: false, depthTest: false,
  });
  let bubble = null;

  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let showHitboxes = SHOW_HITBOXES;

  return {
    hudScene, // pass to hologram.render() so the border appears on every view

    get hitboxesShown() {
      return showHitboxes;
    },

    // Show/hide the grey square and the red bubble (hit detection keeps working either way)
    setHitboxesShown(shown) {
      showHitboxes = shown;
      if (bubble) bubble.visible = shown;
    },

    // Put the red bubble on Alice. parent = modelRoot, so it spins/tilts with her.
    showAliceBubble(parent, sphere) {
      bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), bubbleMat);
      bubble.position.copy(sphere.center);
      bubble.scale.setScalar(sphere.radius);
      bubble.renderOrder = 998;
      bubble.layers.set(HUD_LAYER);
      bubble.raycast = ignoreRaycast;
      bubble.visible = showHitboxes;
      parent.add(bubble);
    },

    // Call every frame. square = handSquare(...) or null when no hand.
    update(dt, distance, square, isHittingAlice) {
      bubbleMat.opacity = isHittingAlice ? 0.45 : 0.2;

      borderMat.opacity = THREE.MathUtils.damp(
        borderMat.opacity, square ? BORDER_ACTIVE_OPACITY : BORDER_IDLE_OPACITY, OVERLAY_FADE, dt
      );

      handBox.visible = showHitboxes && !!square;
      if (!handBox.visible) return;
      // Front-view coords -> world units on the z=0 plane the front camera looks at
      const unitH = distance * tanHalfFov, unitW = unitH * camera.aspect;
      handBox.position.set(((square.x1 + square.x2) / 2) * unitW, ((square.y1 + square.y2) / 2) * unitH, 0);
      handBox.scale.set((square.x2 - square.x1) * unitW, (square.y2 - square.y1) * unitH, 1);
    },
  };
}
