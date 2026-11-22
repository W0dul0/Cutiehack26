// Every tunable number in one place.

// ---- Model ----
export const MODEL_URL = "/assets/scene.glb";
export const MODEL_SCALE = 0.1;
export const CHARACTER_NAME = "character"; // node the pinch can pick up (falls back to the whole model)
export const PICKUP_LIFT = 1.5;            // how far the character rises while held

// ---- Hologram layout (4 views, one per pyramid face) ----
export const VIEW_SIZE = 0.33;   // each view's side as a fraction of the square canvas
export const CENTER_GAP = 0;     // px each view is pushed away from the center (room for the pyramid tip)
export const FOV = 45;
export const LIGHT_OFFSET = [3, 5, 4]; // key light position relative to each view's camera

// ---- Camera distance (zoom) ----
// Once the model loads, the camera is placed to fit it. Everything below is relative to that fit.
export const MODEL_FILL = 2.0;  // how big the model looks at start: 1 = whole model just fits while spinning,
                                 // higher = bigger image (edges may clip when turned), lower = smaller
export const MIN_ZOOM = 0.5;     // closest zoom, as a fraction of the start distance
export const MAX_ZOOM = 1.6;     // farthest zoom, as a fraction of the start distance
export const ZOOM_STEP = 0.04;   // per encoder click / key press, as a fraction of the start distance
export const START_DISTANCE = 20; // only used until the model has loaded

// ---- Model rotation ----
export const ROTATE_STEP = 0.12; // radians per encoder click / key press
export const MAX_TILT = 0.85;    // radians the model can tilt up/down
export const TURNTABLE_SPEED = 0; // radians/sec auto-spin (0 = off)
export const SMOOTHING = 13;     // how fast rotation/zoom catch up (higher = snappier)

// ---- Hand tracking ----
export const WRIST_HEIGHT_CUTOFF = 0.78; // ignore hands whose wrist is below this (0 = top of webcam, 1 = bottom)
export const PINCH_DISTANCE = 0.045;     // thumb-to-index distance that counts as a pinch
export const PINCH_HOLD_FRAMES = 4;      // frames the pinch must be held before it starts
export const PINCH_SENSITIVITY_X = 2.2;  // >1 = small hand moves cover the whole front view
export const PINCH_SENSITIVITY_Y = 2.0;

// ---- Hand overlay (front view) ----
export const SHOW_HAND_BOX = true;        // grey box around thumb + index finger (false = off)
export const HAND_BOX_MAGNIFICATION = 0.5; // 1 = full front view; lower = smaller box
export const OVERLAY_FADE = 13;           // how fast the border/cursor fade in and out
export const CURSOR_FOLLOW = 10;          // how fast the cursor follows the pinch point

// ---- ESP32 encoders ----
export const SERIAL_BAUD = 115200;
