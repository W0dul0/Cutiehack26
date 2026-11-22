// Entry point: wires the pieces together and runs the single animation loop.
//
//   config.js        all tunable numbers
//   libs.js          CDN imports (Three.js, GLTFLoader, MediaPipe)
//   stage.js         scene, lights, modelRoot group
//   hologramViews.js renderer + the 4 camera angles
//   model.js         loads/centers the GLB, finds Alice
//   controls.js      rotation/zoom state, keyboard
//   serial.js        ESP32 encoders over Web Serial
//   handTracking.js  webcam + MediaPipe landmarks
//   pinch.js         pinch detection
//   handOverlay.js   the grey hand hitbox square + front-view border
//   pickup.js        is the hitbox touching Alice? + pinch-to-lift
//   ui.js            debug panel buttons and cards
import { THREE } from "./libs.js";
import { FOV, MODEL_FILL } from "./config.js";
import { scene, keyLight, modelRoot } from "./stage.js";
import { createHologram, frontCamera, setCameraDistance } from "./hologramViews.js";
import { loadModel } from "./model.js";
import { view, applyControl, updateView, bindKeyboard, fitZoomTo } from "./controls.js";
import { connectEncoders } from "./serial.js";
import { startHandTracking } from "./handTracking.js";
import { createPinchDetector } from "./pinch.js";
import { createHandOverlay, handSquare } from "./handOverlay.js";
import { createPickup } from "./pickup.js";
import { initDebugPanel } from "./ui.js";

const container = document.getElementById("Three.js");
if (!container) throw new Error('Could not find element with id="Three.js"');

const hologram = createHologram(container, scene, keyLight);
const overlay = createHandOverlay(scene, frontCamera);
const pickup = createPickup(frontCamera, modelRoot);
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

// true while the grey hand hitbox overlaps Alice (shown in the debug panel's "Hitting Alice" card)
const hitState = { isHittingAlice: false };

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
window.connectEncoders = () => connectEncoders(applyControl);

bindKeyboard();
initDebugPanel();
connectEncoders(applyControl, { askUser: false }); // reconnect an already-allowed ESP32 without a click

// ---------- One loop for everything ----------
let mixer = null;
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

  mixer?.update(dt);
  updateView(dt);
  modelRoot.rotation.set(view.tilt, view.spin, 0);
  setCameraDistance(view.distance);

  const hitting = pickup.touches(square);
  if (hitting !== hitState.isHittingAlice) {
    hitState.isHittingAlice = hitting;
    emit("alicehit", { isHittingAlice: hitting });
  }

  overlay.update(dt, view.distance, square);
  hologram.render();
});

// ---------- Load the model and start the webcam at the same time ----------
loadModel(modelRoot)
  .then((loaded) => {
    mixer = loaded.mixer;
    pickup.setTarget(loaded);

    // Place the camera so the model fills each view (MODEL_FILL in config.js sets how much)
    const fitDistance = loaded.radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2)) / MODEL_FILL;
    const zoom = fitZoomTo(fitDistance);
    hologram.setClipRange(fitDistance / 100, zoom.max + loaded.radius * 2);
    console.log(`Model radius ${loaded.radius.toFixed(2)} -> camera distance ${fitDistance.toFixed(2)}`);
  })
  .catch((err) => console.error("Failed to load the 3D model:", err));

startHandTracking(document.getElementById("webcam"))
  .then((t) => { tracker = t; })
  .catch((err) => console.error("Webcam / hand tracking failed to start:", err));
