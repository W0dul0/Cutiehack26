// Hitbox visuals: blue touch-area border (all views), grey hand square + 3D hand (front view), Alice's red bubble.
//
// The border, square and hand live in a flat HUD scene drawn on top of each view.
// HUD coords are -1..1 = the edges of a view, which are exactly the front-view coords handSquare() returns.
import { THREE } from "./libs.js";
import { HUD_LAYER } from "./hologramViews.js";
import {
  SHOW_HITBOXES, HAND_BOX_MAGNIFICATION, HAND_BOX_GROW, HAND_BOX_OPACITY, HAND_MODEL_SCALE,
  OVERLAY_FADE, BORDER_IDLE_OPACITY, BORDER_ACTIVE_OPACITY,
  INVERT_HAND,
} from "./config.js";

const HAND_DIR = INVERT_HAND ? -1 : 1; // -1 = hand-cam movement inverted

// Hand landmarks -> hitbox square in front-view coords (-1..1, y up, mirrored like the webcam).
// Covers thumb 2-4 + index 5-8, made square and grown by HAND_BOX_GROW.
export function handSquare(hand) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  for (let i = 2; i <= 8; i++) {
    const x = ((1 - hand[i].x) * 2 - 1) * HAND_DIR, y = (1 - hand[i].y * 2) * HAND_DIR;
    if (x < x1) x1 = x; if (x > x2) x2 = x;
    if (y < y1) y1 = y; if (y > y2) y2 = y;
  }
  const m = HAND_BOX_MAGNIFICATION;
  const cx = ((x1 + x2) / 2) * m, cy = ((y1 + y2) / 2) * m;
  const half = (Math.max(x2 - x1, y2 - y1) / 2) * HAND_BOX_GROW * m;
  return { x1: cx - half, x2: cx + half, y1: cy - half, y2: cy + half };
}

export function createHandOverlay() {
  const hudScene = new THREE.Scene();
  hudScene.add(new THREE.AmbientLight(0xffffff, 1.2)); // lights for the 3D hand
  const hudLight = new THREE.DirectionalLight(0xffffff, 1.5);
  hudLight.position.set(0.3, 0.5, 1);
  hudScene.add(hudLight);

  // Blue "touch area" border: everywhere the hand can reach. Dim while no hand is seen, bright while one is.
  const edge = HAND_BOX_MAGNIFICATION * 0.98; // nudged inside so the line isn't cut off at the view edge
  const borderMat = new THREE.LineBasicMaterial({
    color: 0x00ffff, transparent: true, opacity: BORDER_IDLE_OPACITY, depthTest: false,
  });
  hudScene.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-edge, -edge, 0), new THREE.Vector3(edge, -edge, 0),
      new THREE.Vector3(edge, edge, 0), new THREE.Vector3(-edge, edge, 0),
    ]),
    borderMat
  ));

  // Grey see-through hitbox square (front view only). Sits at the back so the 3D hand draws over it.
  const handBox = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x808080, transparent: true, opacity: HAND_BOX_OPACITY, depthWrite: false })
  );
  handBox.position.z = -0.9;
  handBox.visible = false;
  handBox.layers.set(HUD_LAYER);
  hudScene.add(handBox);

  // 3D hand on top of the square (front view only); added once hand.glb loads
  let handModel = null;

  // Alice's hitbox, shown in all 4 views: see-through red fill + red wire outline,
  // plus a glow shell that shines and pulses while the grey square is hitting her
  const onTop = { transparent: true, depthWrite: false, depthTest: false };
  const bubbleFillMat = new THREE.MeshBasicMaterial({ color: 0xff2020, opacity: 0.15, ...onTop });
  const bubbleWireMat = new THREE.MeshBasicMaterial({ color: 0xff3030, opacity: 0.4, wireframe: true, ...onTop });
  const bubbleGlowMat = new THREE.MeshBasicMaterial({
    color: 0xff0000, opacity: 0, side: THREE.BackSide, blending: THREE.AdditiveBlending, ...onTop,
  });
  let bubble = null;
  let bubbleSphere = null; // Alice's hitbox sphere; the bubble follows it when she moves
  let glow = 0;  // 0 = idle, 1 = fully shining (eases between them)
  let time = 0;
  let showHitboxes = SHOW_HITBOXES;

  return {
    hudScene, // pass to hologram.render()

    get hitboxesShown() {
      return showHitboxes;
    },

    // Show/hide the grey square and the red bubble (hit detection and the 3D hand keep working)
    setHitboxesShown(shown) {
      showHitboxes = shown;
      if (bubble) bubble.visible = shown;
    },

    // model = loadHandModel() result (fits a 1x1 square)
    setHandModel(model) {
      handModel = model;
      handModel.visible = false;
      handModel.traverse((o) => o.layers.set(HUD_LAYER));
      hudScene.add(handModel);
    },

    // Put the red bubble on Alice. parent = modelRoot, so it spins/tilts with her.
    showAliceBubble(parent, sphere) {
      const ball = new THREE.SphereGeometry(1, 24, 16);
      bubble = new THREE.Group();
      bubble.name = "AliceHitbox";
      const glowShell = new THREE.Mesh(ball, bubbleGlowMat);
      glowShell.scale.setScalar(1.25); // glow halo slightly outside the bubble
      bubble.add(glowShell, new THREE.Mesh(ball, bubbleFillMat), new THREE.Mesh(ball, bubbleWireMat));
      bubble.children.forEach((m, i) => { m.renderOrder = 996 + i; m.raycast = () => {}; });
      bubbleSphere = sphere;
      bubble.position.copy(sphere.center);
      bubble.scale.setScalar(sphere.radius);
      bubble.visible = showHitboxes;
      parent.add(bubble);
    },

    // Call every frame. square = handSquare(...) or null when no hand.
    update(dt, square, isHittingAlice) {
      // Red bubble: follows Alice, shines + pulses while hit, calm when not
      if (bubble) bubble.position.copy(bubbleSphere.center);
      time += dt;
      glow = THREE.MathUtils.damp(glow, isHittingAlice ? 1 : 0, 12, dt);
      const pulse = 0.75 + 0.25 * Math.sin(time * 8);
      bubbleFillMat.opacity = 0.15 + 0.45 * glow * pulse;
      bubbleWireMat.opacity = 0.4 + 0.6 * glow;
      bubbleGlowMat.opacity = 0.7 * glow * pulse;

      borderMat.opacity = THREE.MathUtils.damp(
        borderMat.opacity, square ? BORDER_ACTIVE_OPACITY : BORDER_IDLE_OPACITY, OVERLAY_FADE, dt
      );

      handBox.visible = showHitboxes && !!square;
      if (handModel) handModel.visible = !!square;
      if (!square) return;

      const cx = (square.x1 + square.x2) / 2, cy = (square.y1 + square.y2) / 2;
      const side = square.x2 - square.x1;
      handBox.position.x = cx;
      handBox.position.y = cy;
      handBox.scale.set(side, square.y2 - square.y1, 1);
      if (handModel) {
        handModel.position.set(cx, cy, 0);
        handModel.scale.setScalar(side * HAND_MODEL_SCALE);
      }
    },
  };
}
