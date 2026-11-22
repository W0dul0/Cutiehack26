// Every tunable number in one place.

// ---- Models ----
// The map and Alice come from the same export, so they share coordinates and scale.
export const MAP_URL = "/assets/scene.glb";
export const ALICE_URL = "/assets/scene%20(2).glb"; // "scene (2).glb" (space is URL-encoded)
export const REMOVE_MAP_ALICE = "alicia";  // the map has its own built-in Alice ("Alicia_98"); remove it so there's only one to find
                                           // (name prefix, any case; set to "" to keep her)
export const PICKUP_LIFT = 0.3;            // how far Alice rises while held, as a fraction of her height

// ---- Random hiding spot (new spot every page load) ----
// Alice is put somewhere on the map standing on the ground, with nothing else inside her footprint.
// "The floor" = the height her feet are at in scene (2).glb. Grass a little higher than that counts as ground too.
export const ALICE_CLEARANCE = 1.0;        // footprint checked under her, vs. her own size (higher = more space around her)
export const ALICE_FLATNESS = 0.2;         // how sloped/uneven the ground under her may be, as a fraction of her height
                                           // (the side gardens are grassy mounds, so this needs to allow gentle slopes)
export const ALICE_MAX_GROUND_RISE = 0.35; // how much higher than the floor she may stand (grass/hills), as a fraction of her height
                                           // (higher = more places, but she may end up on top of low objects)
export const ALICE_PLACE_ATTEMPTS = 1500;  // random spots tried before giving up and keeping her where she is
export const ALICE_MOVE_MIN_DISTANCE = 1;  // when she moves, how far from her old spot (in her own footprint widths)

// ---- Finding Alice ----
export const ALICE_TOUCHED_SECONDS = 2;    // aliceWasTouched stays true (and confetti plays) this long after a touch
export const ALICE_TOUCH_COOLDOWN = 3;     // seconds after a touch before touching her counts again (bubble dims meanwhile)

// ---- Hologram layout (4 views, one per pyramid face) ----
export const VIEW_SIZE = 0.33;   // each view's side as a fraction of the square canvas
export const CENTER_GAP = 0;     // px each view is pushed away from the center (room for the pyramid tip)
export const FOV = 45;
export const FLIP_VIEWS = true;  // true = every view upside down (Alice's head points outward, feet to the center)
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
export const INVERT_HAND = true;         // flip hand-cam movement left/right AND up/down
                                         // (true matches FLIP_VIEWS: hand right -> grey square right on the flipped views)

// ---- Hand overlay (front view) ----
// The grey square around thumb 2-4 + index 5-8 IS the hitbox: whatever it covers, the hand is hitting.
export const SHOW_HITBOXES = true;         // start with the grey square + Alice's red bubble shown (button toggles it)
export const HAND_BOX_MAGNIFICATION = 1.0; // how much of the front view the hand can reach (1 = all of it)
export const HAND_BOX_GROW = 1.3;          // square size vs. the fingers it covers (higher = bigger hitbox)
export const ALICE_BUBBLE_SCALE = 1.0;     // Alice's red hitbox bubble: 1 = just covers her height

// Confetti GIF shown across all 4 views for ALICE_TOUCHED_SECONDS after Alice is touched
export const HIT_GIF_URL = "/assets/cf506d6998d68de01e9171f30fc4e287.gif";
export const HIT_GIF_SIZE = 1.0;           // 1 = fills the blue border in each view

// 3D hand drawn on top of the grey square, scaled with it
export const HAND_GLB_URL = "/assets/hand.glb";
export const HAND_MODEL_SCALE = 1.0;         // 1 = hand fills the grey square
export const HAND_MODEL_ROTATION = [90, 0, 0]; // degrees (x, y, z); [90,0,0] stands the hand up, fingers to the top
export const HAND_BOX_OPACITY = 0.5;       // 0 = invisible, 1 = solid grey
export const OVERLAY_FADE = 13;            // how fast the blue border brightens/dims
export const BORDER_IDLE_OPACITY = 0.25;   // blue "touch area" border while no hand is seen
export const BORDER_ACTIVE_OPACITY = 0.9;  // ...and while a hand is tracked

// ---- ESP32 encoders ----
export const SERIAL_BAUD = 115200;
