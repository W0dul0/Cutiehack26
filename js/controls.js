// Rotation + zoom: what the encoders/keys ask for, smoothed into what is shown.
import { THREE } from "./libs.js";
import {
  START_DISTANCE, MIN_DISTANCE, MAX_DISTANCE, ZOOM_STEP,
  ROTATE_STEP, MAX_TILT, TURNTABLE_SPEED, SMOOTHING,
} from "./config.js";

const { clamp, damp } = THREE.MathUtils;

// `view` is what's on screen; `target` is where the controls want it. view eases toward target.
export const view = { spin: 0, tilt: 0, distance: START_DISTANCE };
const target = { ...view };

// encoderId: "E1".."E3"; action: RIGHT/LEFT/UP/DOWN/ZOOM_IN/ZOOM_OUT; amount: clicks
export function applyControl(encoderId, action, amount = 1) {
  switch (action) {
    case "RIGHT":    target.spin += amount * ROTATE_STEP; break;
    case "LEFT":     target.spin -= amount * ROTATE_STEP; break;
    case "UP":       target.tilt = clamp(target.tilt - amount * ROTATE_STEP, -MAX_TILT, MAX_TILT); break;
    case "DOWN":     target.tilt = clamp(target.tilt + amount * ROTATE_STEP, -MAX_TILT, MAX_TILT); break;
    case "ZOOM_IN":  target.distance = clamp(target.distance - amount * ZOOM_STEP, MIN_DISTANCE, MAX_DISTANCE); break;
    case "ZOOM_OUT": target.distance = clamp(target.distance + amount * ZOOM_STEP, MIN_DISTANCE, MAX_DISTANCE); break;
    default: return;
  }
  window.dispatchEvent(new CustomEvent("encoderinput", { detail: { encoderId, action, amount } }));
}

// Call once per frame. Frame-rate independent, so it feels the same at 30 or 144 fps.
export function updateView(dt) {
  if (TURNTABLE_SPEED) target.spin += TURNTABLE_SPEED * dt;
  view.spin = damp(view.spin, target.spin, SMOOTHING, dt);
  view.tilt = damp(view.tilt, target.tilt, SMOOTHING, dt);
  view.distance = damp(view.distance, target.distance, SMOOTHING, dt);
}

// Keyboard stand-ins for the 3 encoders
const KEY_ACTIONS = {
  ArrowRight: ["E1", "RIGHT"], ArrowLeft: ["E1", "LEFT"],
  ArrowUp:    ["E2", "UP"],    ArrowDown: ["E2", "DOWN"],
  w:          ["E3", "ZOOM_IN"], s:       ["E3", "ZOOM_OUT"],
};

export function bindKeyboard() {
  window.addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const control = KEY_ACTIONS[key];
    if (control) applyControl(control[0], control[1], 1);
  });
}
