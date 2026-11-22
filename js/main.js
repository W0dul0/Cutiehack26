// Entry point: wires the pieces together and runs the single animation loop.
//
//   config.js        all tunable numbers
//   libs.js          CDN imports (Three.js, GLTFLoader, MediaPipe)
//   stage.js         scene, lights, modelRoot group
//   hologramViews.js renderer + the 4 camera angles
//   model.js         loads/centers the GLB, builds the pick-up hit sphere
//   controls.js      rotation/zoom state, keyboard
//   serial.js        ESP32 encoders over Web Serial
//   handTracking.js  webcam + MediaPipe landmarks
//   pinch.js         pinch detection
//   handOverlay.js   border, cursor, grey hand box
//   pickup.js        pinch raycast + lifting the character
//   ui.js            debug panel buttons
import { THREE } from "./libs.js";
import { FOV, MODEL_FILL } from "./config.js";
import { scene, keyLight, modelRoot } from "./stage.js";
import { createHologram, frontCamera, setCameraDistance } from "./hologramViews.js";
import { loadModel } from "./model.js";
import { view, applyControl, updateView, bindKeyboard, fitZoomTo } from "./controls.js";
import { connectEncoders } from "./serial.js";
import { startHandTracking } from "./handTracking.js";
import { createPinchDetector } from "./pinch.js";
import { createHandOverlay } from "./handOverlay.js";
import { createPickup } from "./pickup.js";
import { initDebugPanel } from "./ui.js";

const container = document.getElementById("Three.js");
if (!container) throw new Error('Could not find element with id="Three.js"');

const hologram = createHologram(container, scene, keyLight);
const overlay = createHandOverlay(scene, frontCamera);
const pickup = createPickup(frontCamera);
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

const pinch = createPinchDetector({
  onStart(point) {
    overlay.setPinching(true);
    const { hit, pickedUp } = pickup.grab(point);
    emit("pinchstart", { point, hit, count: pinch.state.count });
    if (pickedUp) emit("characterfound", { hit });
  },
  onEnd(point) {
    overlay.setPinching(false);
    emit("pinchend", { point, count: pinch.state.count });
    pickup.release();
  },
});

// Hooks for the console / other scripts
window.pinch = pinch.state;
window.castFromPinch = () => pickup.cast(pinch.state.point);
window.connectEncoders = () => connectEncoders(applyControl);

bindKeyboard();
initDebugPanel();
connectEncoders(applyControl, { askUser: false }); // reconnect an already-allowed ESP32 without a click

// ---------- One loop for everything ----------
let mixer = null;
let tracker = null;
const clock = new THREE.Clock();

hologram.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1); // cap so a background tab doesn't cause a jump

  const hand = tracker?.detect(); // undefined = no new webcam frame this time
  if (hand !== undefined) {
    pinch.update(hand);
    overlay.setHand(hand, pinch.state.point);
  }

  mixer?.update(dt);
  updateView(dt);
  modelRoot.rotation.set(view.tilt, view.spin, 0);
  setCameraDistance(view.distance);
  overlay.update(dt, view.distance);
  hologram.render();
});

// ---------- Load the model and start the webcam at the same time ----------
loadModel(modelRoot)
  .then(({ character, hitSphere, mixer: modelMixer, radius }) => {
    mixer = modelMixer;
    pickup.setTarget(character, hitSphere);

    // Place the camera so the model fills each view (MODEL_FILL in config.js sets how much)
    const fitDistance = radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2)) / MODEL_FILL;
    const zoom = fitZoomTo(fitDistance);
    hologram.setClipRange(fitDistance / 100, zoom.max + radius * 2);
    console.log(`Model radius ${radius.toFixed(2)} -> camera distance ${fitDistance.toFixed(2)}`);
  })
  .catch((err) => console.error("Failed to load the 3D model:", err));

startHandTracking(document.getElementById("webcam"))
  .then((t) => { tracker = t; })
  .catch((err) => console.error("Webcam / hand tracking failed to start:", err));
