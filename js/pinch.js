// Thumb + index pinch detection. Pure logic: no Three.js, no DOM.
import { PINCH_DISTANCE, PINCH_HOLD_FRAMES, PINCH_SENSITIVITY_X, PINCH_SENSITIVITY_Y } from "./config.js";

const THUMB_TIP = 4;
const INDEX_TIP = 8;
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

// onStart(point) / onEnd(point) fire once per pinch.
// state.point is the pinch position in front-view screen coords: x/y in -1..1, y up, mirrored like the webcam.
export function createPinchDetector({ onStart, onEnd }) {
  const state = { isPinching: false, point: null, distance: 0, count: 0, holdFrames: 0 };

  const release = () => {
    if (!state.isPinching) return;
    state.isPinching = false;
    onEnd(state.point);
  };

  return {
    state,
    update(hand) {
      if (!hand) {
        state.point = null;
        state.holdFrames = 0;
        release();
        return;
      }

      const thumb = hand[THUMB_TIP], index = hand[INDEX_TIP];
      state.point = {
        x: clamp1(((1 - (thumb.x + index.x) / 2) * 2 - 1) * PINCH_SENSITIVITY_X),
        y: clamp1((1 - (thumb.y + index.y)) * PINCH_SENSITIVITY_Y),
      };
      state.distance = Math.hypot(thumb.x - index.x, thumb.y - index.y);

      if (state.distance < PINCH_DISTANCE) {
        state.holdFrames++;
        if (state.holdFrames === PINCH_HOLD_FRAMES && !state.isPinching) {
          state.isPinching = true;
          state.count++;
          onStart(state.point);
        }
      } else {
        state.holdFrames = 0;
        release();
      }
    },
  };
}
