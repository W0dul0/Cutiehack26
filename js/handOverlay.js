// What the hand looks like in the hologram: front-view border, ring cursor, grey hand box.
import { THREE } from "./libs.js";
import { HUD_LAYER } from "./hologramViews.js";
import { SHOW_HAND_BOX, HAND_BOX_MAGNIFICATION, OVERLAY_FADE, CURSOR_FOLLOW } from "./config.js";

const CYAN = 0x00ffff;
const MAGENTA = 0xff00ff;
const ignoreRaycast = () => {};

export function createHandOverlay(scene, camera) {
  // Cyan outline around the front view; fades in while a hand is tracked
  const borderMat = new THREE.LineBasicMaterial({
    color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false,
  });
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(7.2, 7.2)), borderMat);
  border.position.z = 4;
  border.layers.set(HUD_LAYER);
  border.raycast = ignoreRaycast;
  scene.add(border);

  // Ring that follows the pinch point; turns magenta while pinching
  const cursorMat = new THREE.MeshBasicMaterial({
    color: CYAN, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthTest: false,
  });
  const cursor = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 32), cursorMat);
  cursor.renderOrder = 1000;
  cursor.raycast = ignoreRaycast;
  scene.add(cursor);

  // Grey see-through box around thumb 2-4 + index 5-8 (front view only, drawn on top of everything)
  const handBox = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x808080, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, depthTest: false,
    })
  );
  handBox.renderOrder = 999;
  handBox.visible = false;
  handBox.layers.set(HUD_LAYER);
  handBox.raycast = ignoreRaycast;
  scene.add(handBox);

  // Flat plane at the model's depth the cursor slides along. Only raycast, never drawn or added to the scene.
  const cursorPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40));
  const ray = new THREE.Raycaster();
  const screenPoint = new THREE.Vector2();
  const halfHeightAt1 = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * HAND_BOX_MAGNIFICATION;

  let hand = null;
  let point = null;

  function placeHandBox(distance) {
    const halfH = distance * halfHeightAt1;
    const halfW = halfH * camera.aspect;
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    for (let i = 2; i <= 8; i++) {
      const x = (1 - hand[i].x) * 2 - 1, y = 1 - hand[i].y * 2; // mirrored, y up, -1..1
      if (x < x1) x1 = x; if (x > x2) x2 = x;
      if (y < y1) y1 = y; if (y > y2) y2 = y;
    }
    handBox.position.set(((x1 + x2) / 2) * halfW, ((y1 + y2) / 2) * halfH, 0);
    handBox.scale.set((x2 - x1) * halfW, (y2 - y1) * halfH, 1);
  }

  return {
    // New hand data (call on each new webcam frame)
    setHand(newHand, pinchPoint) {
      hand = newHand;
      point = pinchPoint;
    },

    setPinching(isPinching) {
      cursorMat.color.setHex(isPinching ? MAGENTA : CYAN);
      cursor.scale.setScalar(isPinching ? 1.35 : 1);
    },

    // Call every frame
    update(dt, distance) {
      const active = !!(hand && point);
      borderMat.opacity = THREE.MathUtils.damp(borderMat.opacity, active ? 0.85 : 0, OVERLAY_FADE, dt);
      cursorMat.opacity = THREE.MathUtils.damp(cursorMat.opacity, active ? 1 : 0, OVERLAY_FADE, dt);

      if (active) {
        ray.setFromCamera(screenPoint.set(point.x, point.y), camera);
        const hit = ray.intersectObject(cursorPlane)[0];
        if (hit) cursor.position.lerp(hit.point, 1 - Math.exp(-CURSOR_FOLLOW * dt));
      }

      handBox.visible = SHOW_HAND_BOX && active;
      if (handBox.visible) placeHandBox(distance);
    },
  };
}
