// Entry point: wires the pieces together and runs the single animation loop.
//
//   config.js        all tunable numbers
//   libs.js          CDN imports (Three.js, GLTFLoader, MediaPipe)
//   stage.js         scene, lights, modelRoot group
//   hologramViews.js renderer + the 4 camera angles
//   model.js         loads/centers the scene, finds Alice; loads the 3D hand
//   controls.js      rotation/zoom state, keyboard
//   serial.js        ESP32 encoders over Web Serial
//   handTracking.js  webcam + MediaPipe landmarks
//   pinch.js         pinch detection
//   handOverlay.js   blue border, grey hand square + 3D hand, Alice's red bubble
//   pickup.js        is the hitbox touching Alice? + pinch-to-lift
//   ui.js            debug panel buttons and cards
//   hitGif.js        confetti GIF over all 4 views after the hand touches Alice
import { THREE } from "./libs.js";
import { FOV, MODEL_FILL, ALICE_TOUCHED_SECONDS, ALICE_TOUCH_COOLDOWN } from "./config.js";
import { scene, keyLight, modelRoot } from "./stage.js";
import { createHologram, frontCamera, setCameraDistance } from "./hologramViews.js";
import { loadWorld, loadHandModel } from "./model.js";
import { view, applyControl, updateView, bindKeyboard, fitZoomTo } from "./controls.js";
import { connectEncoders } from "./serial.js";
import { startHandTracking } from "./handTracking.js";
import { createPinchDetector } from "./pinch.js";
import { createHandOverlay, handSquare } from "./handOverlay.js";
import { createPickup } from "./pickup.js";
import { initDebugPanel } from "./ui.js";
import { createHitGif } from "./hitGif.js";

const container = document.getElementById("Three.js");
if (!container) throw new Error('Could not find element with id="Three.js"');

const hologram = createHologram(container, scene, keyLight);
const hitGif = createHitGif(container, hologram);
const overlay = createHandOverlay();
const pickup = createPickup(frontCamera, modelRoot);
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

// isHittingAlice:  true while the grey hand hitbox overlaps Alice's red bubble
// aliceWasTouched: true for ALICE_TOUCHED_SECONDS after a touch (confetti plays, Alice has already moved)
// isOnCooldown:    true for ALICE_TOUCH_COOLDOWN after a touch; touching her doesn't count meanwhile
const hitState = { isHittingAlice: false, aliceWasTouched: false, isOnCooldown: false };
let cooldownEnds = 0; // performance.now() time the touch cooldown is over
let touchedTimer = 0; // turns aliceWasTouched back off
let world = null; // loadWorld() result, once the models are in

// Hide Alice somewhere new (the "Move Alice" button, and automatically after she's touched)
function moveAlice() {
  if (!world) return;
  pickup.release(); // drop her first if a pinch is holding her
  world.moveAlice();
  emit("alicemoved");
}

function onAliceTouched() {
  cooldownEnds = performance.now() + ALICE_TOUCH_COOLDOWN * 1000;
  hitState.aliceWasTouched = true;
  hitGif.setShown(true);
  emit("alicetouched", { aliceWasTouched: true });
  moveAlice();
  clearTimeout(touchedTimer); // a new touch restarts the 2 seconds (only possible if the cooldown is shorter)
  touchedTimer = setTimeout(() => {
    hitState.aliceWasTouched = false;
    hitGif.setShown(false);
    emit("alicetouched", { aliceWasTouched: false });
  }, ALICE_TOUCHED_SECONDS * 1000);
}

const pinch = createPinchDetector({
  onStart(point) {
    emit("pinchstart", { point, isHittingAlice: hitState.isHittingAlice, count: pinch.state.count });
    if (hitState.isHittingAlice && pickup.grab()) emit("characterfound");
  },
  onEnd(point) {
    emit("pinchend", { point, count: pinch.state.count });
    pickup.release();
  },
});

// Hooks for the console / other scripts
window.pinch = pinch.state;
window.hitState = hitState;
window.moveAlice = moveAlice;
window.connectEncoders = () => connectEncoders(applyControl);

bindKeyboard();
const panel = initDebugPanel({
  hitboxesShown: overlay.hitboxesShown,
  onToggleHitboxes: (shown) => overlay.setHitboxesShown(shown),
  onMoveAlice: moveAlice,
});
connectEncoders(applyControl, { askUser: false }); // reconnect an already-allowed ESP32 without a click

// ---------- One loop for everything ----------
let tracker = null;
let square = null; // the hand hitbox in front-view coords, or null when no hand
const clock = new THREE.Clock();

hologram.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1); // cap so a background tab doesn't cause a jump

  const hand = tracker?.detect(); // undefined = no new webcam frame this time
  if (hand !== undefined) {
    pinch.update(hand);
    square = hand ? handSquare(hand) : null;
  }

  updateView(dt);
  modelRoot.rotation.set(view.tilt, view.spin, 0);
  setCameraDistance(view.distance);

  // Touch cooldown: counts down after each touch; touching her doesn't count until it's over
  const cooldownLeft = Math.max(0, (cooldownEnds - performance.now()) / 1000);
  const onCooldown = cooldownLeft > 0;
  if (onCooldown !== hitState.isOnCooldown) {
    hitState.isOnCooldown = onCooldown;
    emit("alicecooldown", { isOnCooldown: onCooldown });
  }
  panel.setCooldown(cooldownLeft);

  const hitting = pickup.touches(square);
  if (hitting !== hitState.isHittingAlice) {
    hitState.isHittingAlice = hitting;
    emit("alicehit", { isHittingAlice: hitting });
  }
  if (hitting && !onCooldown) onAliceTouched(); // she moves away at once, so this fires once per find

  overlay.update(dt, square, hitting, onCooldown);
  hologram.render(overlay.hudScene);
});

// ---------- Load the model and start the webcam at the same time ----------
loadWorld(modelRoot)
  .then((loaded) => {
    world = loaded;
    pickup.setTarget(loaded);
    overlay.showAliceBubble(modelRoot, loaded.characterSphere);

    // Place the camera so the model fills each view (MODEL_FILL in config.js sets how much)
    const fitDistance = loaded.radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2)) / MODEL_FILL;
    const zoom = fitZoomTo(fitDistance);
    hologram.setClipRange(fitDistance / 100, zoom.max + loaded.radius * 2);
    console.log(`Model radius ${loaded.radius.toFixed(2)} -> camera distance ${fitDistance.toFixed(2)}`);
  })
  .catch((err) => console.error("Failed to load the 3D model:", err));

loadHandModel()
  .then((hand) => overlay.setHandModel(hand))
  .catch((err) => console.error("Failed to load hand.glb (the grey square still works):", err));

startHandTracking(document.getElementById("webcam"))
  .then((t) => { tracker = t; })
  .catch((err) => console.error("Webcam / hand tracking failed to start:", err));
