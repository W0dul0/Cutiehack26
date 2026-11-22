// The "you found Alice!" confetti GIF: shown on top of all 4 views for a moment after the hand touches her.
// WebGL can't play animated GIFs, so these are plain <img> elements laid over each view and rotated to match it.
import { HIT_GIF_URL, HIT_GIF_SIZE, HAND_BOX_MAGNIFICATION } from "./config.js";

// The blue border's square, as a fraction of a view (same as in handOverlay.js)
const BORDER_FRACTION = HAND_BOX_MAGNIFICATION * 0.98;

export function createHitGif(container, hologram) {
  if (getComputedStyle(container).position === "static") container.style.position = "relative";

  const images = hologram.viewRects().map(() => {
    const img = document.createElement("img");
    img.src = HIT_GIF_URL;
    img.alt = "";
    Object.assign(img.style, {
      position: "absolute",
      objectFit: "cover", // fill the whole square (crops the GIF's edges instead of leaving empty bars)
      pointerEvents: "none",
      mixBlendMode: "screen", // black parts of the GIF become see-through, like the rest of the hologram
      display: "none",
    });
    container.appendChild(img);
    return img;
  });

  // Fills the blue border's square in each view, turned the same way (so the GIF's top points where Alice's head does)
  function layout() {
    hologram.viewRects().forEach((r, i) => {
      const s = r.size * BORDER_FRACTION * HIT_GIF_SIZE;
      Object.assign(images[i].style, {
        left: `${r.left + (r.size - s) / 2}px`,
        top: `${r.top + (r.size - s) / 2}px`,
        width: `${s}px`,
        height: `${s}px`,
        transform: `rotate(${r.roll}rad)`,
      });
    });
  }
  layout();
  hologram.onResize(layout);

  let shown = false;
  return {
    setShown(on) {
      if (on === shown) return;
      shown = on;
      for (const img of images) {
        if (on) img.src = HIT_GIF_URL; // restart the animation from the first frame
        img.style.display = on ? "block" : "none";
      }
    },
  };
}
