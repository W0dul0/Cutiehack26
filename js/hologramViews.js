// Camera angles: draws the scene 4 times (front/right/back/left), one view per pyramid face.
import { THREE } from "./libs.js";
import { VIEW_SIZE, CENTER_GAP, FOV, START_DISTANCE, LIGHT_OFFSET } from "./config.js";

export const HUD_LAYER = 1; // objects on this layer only appear in the front view

// angle = where the camera sits around the model (0 = front)
// roll  = turns the image so the model's top points at the screen center (the pyramid tip)
const VIEWS = [
  { slot: "bottom", angle: 0,            roll: 0,            front: true },
  { slot: "right",  angle: Math.PI / 2,  roll: -Math.PI / 2 },
  { slot: "top",    angle: Math.PI,      roll: Math.PI },
  { slot: "left",   angle: -Math.PI / 2, roll: Math.PI / 2 },
];

// Front camera: matches the bottom view. Pinch raycasts and the hand overlay aim through it.
export const frontCamera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
const viewCamera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100); // reused for all 4 views
const hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1); // flat overlays: -1..1 = a view's edges
const origin = new THREE.Vector3();
const lightOffset = new THREE.Vector3(...LIGHT_OFFSET);
let distance = START_DISTANCE;

export function setCameraDistance(d) {
  distance = d;
  frontCamera.position.set(0, 0, d);
  frontCamera.updateMatrixWorld();
}
setCameraDistance(START_DISTANCE);

export function createHologram(container, scene, light) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(1);      // plenty sharp for a glass reflection, far cheaper on Retina screens
  renderer.autoClear = false;     // cleared once per frame, not once per view
  renderer.setScissorTest(true);  // each view only draws inside its own square
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  // Canvas is a square; each view is a smaller square centered on one edge.
  // WebGL measures y from the BOTTOM, so "bottom" is y = gap.
  let size = 0, viewSize = 0;
  function resize() {
    size = Math.min(container.clientWidth || 660, container.clientHeight || 660);
    renderer.setSize(size, size);
    viewSize = Math.floor(size * VIEW_SIZE);
    const mid = Math.floor((size - viewSize) / 2), far = size - viewSize - CENTER_GAP, g = CENTER_GAP;
    const corners = { bottom: [mid, g], top: [mid, far], left: [g, mid], right: [far, mid] };
    for (const v of VIEWS) [v.x, v.y] = corners[v.slot];
  }
  resize();
  new ResizeObserver(resize).observe(container);

  return {
    renderer,

    // How close/far the cameras can see; set from the model's size so nothing is cut off
    setClipRange(near, far) {
      for (const cam of [frontCamera, viewCamera]) {
        cam.near = near;
        cam.far = far;
        cam.updateProjectionMatrix();
      }
    },

    // hudScene (optional): flat overlay drawn on top of every view, e.g. the blue touch-area border
    render(hudScene) {
      scene.updateMatrixWorld(); // once for all 4 views
      renderer.setScissor(0, 0, size, size);
      renderer.clear();

      for (const v of VIEWS) {
        viewCamera.position.set(Math.sin(v.angle) * distance, 0, Math.cos(v.angle) * distance);
        viewCamera.up.set(0, 1, 0);
        viewCamera.lookAt(origin);
        viewCamera.rotateZ(v.roll);
        viewCamera.layers.set(0);
        if (v.front) viewCamera.layers.enable(HUD_LAYER);

        light.position.copy(viewCamera.position).add(lightOffset);
        light.updateMatrixWorld();

        renderer.setViewport(v.x, v.y, viewSize, viewSize);
        renderer.setScissor(v.x, v.y, viewSize, viewSize);
        renderer.render(scene, viewCamera);
        if (hudScene) {
          renderer.clearDepth(); // HUD always draws on top of the model (only inside this view's scissor)
          hudCamera.layers.mask = viewCamera.layers.mask; // front-only HUD items stay in the front view
          renderer.render(hudScene, hudCamera);
        }
      }
    },
  };
}
