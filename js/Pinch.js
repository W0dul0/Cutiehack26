// pinch.js — detects an index-finger + thumb "pinch" from MediaPipe hand landmarks.
// Pure JS: no DOM, no Three.js, no globals (safe to import anywhere, incl. plain Node).

/*
================================ QUICK NOTES ================================

WHERE TO READ THE RESULTS  (one shared object; main.mjs exposes it as window.pinch)
  state.value      0-100.  0 = fingertips touching, 100 = a full hand-size apart.  null = no hand.
  state.connected  true while pinching
  state.count      how many separate pinches since page load
  state.point      where you're pinching on screen: {x, y}, each -1..1, y up (null = no hand)
  state.hit        what that point "touches" in the 3D scene (Three.js raycast). Filled in by
                   main.mjs on pinchstart / pinchend. null = nothing hit / no hand.
                   Shape: { object, name, point, distance, uv, face }

EVENTS  (fired once each by main.mjs on window; e.detail = { value, count, point, hit })
  "pinchstart"  pinch began          "pinchend"  pinch ended (also if the hand disappears)

HOW IT WORKS
  1. value = (thumb tip 4 <-> index tip 8 distance) / hand size (wrist 0 <-> middle knuckle 9) * 100
     -> same value whether your hand is near or far from the camera.
  2. point = midpoint of the two fingertips, mirrored left/right (mirror: true by default).
  3. Pinch starts when value <= 25 and ends when value >= 35. The 25-34 gap is a dead zone,
     so it can't flicker on and off at the boundary. Change them via createPinchDetector({...}).

SAFETY  Bad/missing landmarks -> value is null (never throws). A throwing callback is caught.
        A lost hand ends any active pinch. If this file fails to load, main.mjs logs it and carries on.

TESTS   node pinch.test.mjs
=============================================================================
*/

export const THUMB_TIP = 4;
export const INDEX_TIP = 8;
export const WRIST = 0;
export const MIDDLE_MCP = 9; // knuckle of middle finger; wrist->this = "hand size"

/**
 * Pinch value: integer 0-100 (0 = touching, 100 = a hand-size apart or more), or null if unusable.
 * @param landmarks  one hand: result.landmarks[0] from MediaPipe (array of {x,y}, normalized 0..1)
 * @param aspect     videoWidth / videoHeight. Needed because MediaPipe normalizes x and y separately;
 *                   without it a non-square video distorts distances. Default 1.
 */
export function calculatePinchValue(landmarks, aspect = 1) {
  if (!Array.isArray(landmarks) || landmarks.length <= MIDDLE_MCP) return null;
  const t = landmarks[THUMB_TIP], i = landmarks[INDEX_TIP];
  const w = landmarks[WRIST], m = landmarks[MIDDLE_MCP];
  if (![t, i, w, m].every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;

  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const dist = (p, q) => Math.hypot((p.x - q.x) * a, p.y - q.y);

  const handSize = dist(w, m);
  if (handSize < 1e-6) return null; // degenerate frame, avoid divide-by-zero

  const ratio = dist(t, i) / handSize;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * Pinch location: midpoint of thumb tip and index tip as Three.js screen coords ({x,y}, each -1..1,
 * y up). Pass straight to raycaster.setFromCamera(new THREE.Vector2(p.x, p.y), camera).
 * Returns null if unusable.
 * @param mirror  true (default): moving your hand right moves the point right (like a mirror).
 *                false: raw camera image orientation.
 */
export function getPinchPoint(landmarks, { mirror = true } = {}) {
  if (!Array.isArray(landmarks) || landmarks.length <= INDEX_TIP) return null;
  const t = landmarks[THUMB_TIP], i = landmarks[INDEX_TIP];
  if (![t, i].every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;

  const nx = (t.x + i.x) / 2;          // 0..1 across the camera image, left -> right
  const ny = (t.y + i.y) / 2;          // 0..1 down the camera image, top -> bottom
  const clamp = v => Math.max(-1, Math.min(1, v));
  return { x: clamp((mirror ? 1 - nx : nx) * 2 - 1), y: clamp(-(ny * 2 - 1)) };
}

/**
 * Stateful detector. Call detector.update(landmarks, aspect) once per new video frame.
 * Options: connectBelow (25), releaseAbove (35), onStart(state), onEnd(state), mirror (true).
 * Callbacks fire once per pinch start/end, AFTER state is fully updated, and a throwing callback
 * is caught so it can't corrupt the detector or crash the caller.
 * state.hit is never touched here; it belongs to the caller (main.mjs stores its raycast there).
 */
export function createPinchDetector({ connectBelow = 25, releaseAbove = 35, onStart, onEnd, mirror = true } = {}) {
  if (!(connectBelow < releaseAbove)) throw new Error("connectBelow must be < releaseAbove");
  const state = { value: null, connected: false, count: 0, point: null, hit: null };

  const fire = (cb) => {
    if (typeof cb !== "function") return;
    try { cb(state); } catch (err) { console.error("pinch callback error:", err); }
  };

  return {
    state,
    update(landmarks, aspect = 1) {
      const v = calculatePinchValue(landmarks, aspect);
      if (v === null) {            // hand lost or bad data: end any active pinch (not counted)
        const wasConnected = state.connected;
        state.value = null;
        state.point = null;
        state.connected = false;
        if (wasConnected) fire(onEnd);
        return state;
      }
      state.value = v;
      state.point = getPinchPoint(landmarks, { mirror });
      if (!state.connected && v <= connectBelow) { state.connected = true; state.count++; fire(onStart); }
      else if (state.connected && v >= releaseAbove) { state.connected = false; fire(onEnd); }
      return state;
    },
  };
}