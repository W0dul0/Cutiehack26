import * as THREE from "https://esm.sh/three@0.160.0";
import { HandLandmarker, FilesetResolver } from "https://esm.sh/@mediapipe/tasks-vision@0.10.9";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const container = document.getElementById("Three.js");
if (!container) {
  throw new Error('Could not find element with id="Three.js"');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // pure black = invisible on the pyramid

// ===================== PEPPER'S GHOST (4 scissored views) =====================
const VIEW_RATIO = 0.33;     // each view's side as a fraction of the square canvas
const CENTER_GAP = 0;        // px each view is pushed outward from the center
let ORBIT_RADIUS = 20;       // camera distance from the model (recomputed from the model's size once it loads)
const CAMERA_DISTANCE = 1.0; // 1 = closest the camera can get with no clipping while the model spins; lower = closer (may clip)
const TURNTABLE_SPEED = 0.4; // radians/sec the model spins on its own (0 = off)

// `camera` is the FRONT view camera. The pinch raycast and the hitbox use it, so
// pinch coordinates (-1..1) map onto the bottom (front) view.
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, ORBIT_RADIUS);

// `viewCamera` is reused to draw all four views.
const viewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const target = new THREE.Vector3(0, 0, 0);

// angle = camera azimuth around Y (0 = +Z, the front); roll makes the model's top point at the center.
const VIEWS = [
  { slot: "bottom", angle: 0,            roll: 0,            front: true },
  { slot: "right",  angle: Math.PI / 2,  roll: -Math.PI / 2 },
  { slot: "top",    angle: Math.PI,      roll: Math.PI },
  { slot: "left",   angle: -Math.PI / 2, roll: Math.PI / 2 },
];

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

let sceneMesh = null;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;     // cleared manually once per frame
renderer.setScissorTest(true);  // each view only draws inside its own rectangle
renderer.domElement.style.display = "block"; // removes the inline-canvas gap that makes the container grow/shift
container.appendChild(renderer.domElement);

let canvasW = 0, canvasH = 0;
function resize() {
  // Use the container's size, but fall back to a square if it has no real height yet
  let w = container.clientWidth || 980;
  let h = container.clientHeight;
  if (!h || h < 50) h = w;
  canvasW = w;
  canvasH = h;
  renderer.setSize(canvasW, canvasH);
}
resize();
window.addEventListener("resize", resize);
new ResizeObserver(resize).observe(container);

// WebGL viewport origin is the bottom-left corner
function slotRect(slot) {
  const size = Math.min(canvasW, canvasH);
  const s = Math.floor(size * VIEW_RATIO);
  const ox = Math.floor((canvasW - size) / 2);
  const oy = Math.floor((canvasH - size) / 2);
  const cx = ox + Math.floor((size - s) / 2);
  const cy = oy + Math.floor((size - s) / 2);
  const g = CENTER_GAP;
  switch (slot) {
    case "bottom": return { x: cx,            y: oy + g,            s };
    case "top":    return { x: cx,            y: oy + size - s - g, s };
    case "left":   return { x: ox + g,        y: cy,                s };
    case "right":  return { x: ox + size - s - g, y: cy,            s };
  }
}

function renderViews() {
  renderer.setViewport(0, 0, canvasW, canvasH);
  renderer.setScissor(0, 0, canvasW, canvasH);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();

  for (const v of VIEWS) {
    const r = slotRect(v.slot);

    viewCamera.position.set(
      target.x + Math.sin(v.angle) * ORBIT_RADIUS,
      target.y,
      target.z + Math.cos(v.angle) * ORBIT_RADIUS
    );
    viewCamera.up.set(0, 1, 0);
    viewCamera.lookAt(target);
    viewCamera.rotateZ(v.roll);

    // The hitbox lives on layer 1 and is only drawn in the front view
    if (v.front) viewCamera.layers.enable(1); else viewCamera.layers.disable(1);

    renderer.setViewport(r.x, r.y, r.s, r.s);
    renderer.setScissor(r.x, r.y, r.s, r.s);
    renderer.render(scene, viewCamera);
  }
}
// ==============================================================================

// The turntable spins this pivot; the model sits inside it, centered on the origin
const modelPivot = new THREE.Group();
scene.add(modelPivot);

try {
  const gltfLoader = new GLTFLoader();
  const gltf = await gltfLoader.loadAsync("/assets/scene.glb");

  sceneMesh = gltf.scene;
  sceneMesh.scale.set(0.1, 0.1, 0.1);
  sceneMesh.position.set(0, 0, 0);

  // Center the model on the origin so it spins in place instead of swinging out of the views
  const sphere = new THREE.Box3().setFromObject(sceneMesh).getBoundingSphere(new THREE.Sphere());
  sceneMesh.position.sub(sphere.center);
  modelPivot.add(sceneMesh);

  // Move the cameras as close as possible while the whole spinning model still fits each view
  ORBIT_RADIUS = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_DISTANCE;
  camera.position.set(0, 0, ORBIT_RADIUS);
  for (const cam of [camera, viewCamera]) {
    cam.near = ORBIT_RADIUS / 100;
    cam.far = ORBIT_RADIUS + sphere.radius * 2;
    cam.updateProjectionMatrix();
  }
  console.log("Loaded GLB:", sceneMesh);
} catch (err) {
  console.error("Failed to load GLTF model:", err);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (sceneMesh && TURNTABLE_SPEED) modelPivot.rotation.y += TURNTABLE_SPEED * dt;
  renderViews();
}
animate();

// MediaPipe Engine
const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
);

const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    delegate: "GPU",
  },
  runningMode: "VIDEO",
  numHands: 1,
});

const video = document.getElementById("webcam");
if (video && navigator.mediaDevices?.getUserMedia) {
  video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
  await video.play();
}

// ===================== PINCH (index finger + thumb) =====================
// Full notes at the top of pinch.js. Short version:
//   window.pinch.value      0-100 (0 = touching, null = no hand)    window.pinch.connected  true/false
//   window.pinch.count      pinches since load                      window.pinch.point      {x,y} -1..1
//   window.pinch.hit        what the pinch touches in the 3D scene (null = nothing)
//   window.castFromPinch()  re-run the raycast on demand (e.g. every frame while dragging)
//   Events (fire once each):  "pinchstart" / "pinchend"   e.detail = { value, count, point, hit }
//   hit = { object, name, point, distance, uv, face } from a Three.js raycast, or null
//     window.addEventListener("pinchstart", (e) => { if (e.detail.hit) console.log(e.detail.hit.name); });
// With four views, pinch coordinates map onto the FRONT (bottom) view.
// Everything here sits in ONE try/catch, so if pinch.js is missing or broken the rest of the app still runs.
let pinchDetector = null;
try {
  const { createPinchDetector } = await import("./pinch.js");
  const raycaster = new THREE.Raycaster();

  // Ray from the front camera through the pinch point. Never throws: any problem just means "no hit".
  const castFromPinch = (point) => {
    try {
      if (!point) return null;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
      const h = raycaster.intersectObjects(scene.children, true)[0];
      return h ? { object: h.object, name: h.object.name, point: h.point, distance: h.distance, uv: h.uv, face: h.face } : null;
    } catch (err) {
      console.error("Pinch raycast failed:", err);
      return null;
    }
  };

  // Raycast only on pinchstart/pinchend (not every frame) so a heavy model can't slow rendering.
  const emit = (name) => (s) => {
    s.hit = castFromPinch(s.point);
    window.dispatchEvent(new CustomEvent(name, { detail: { value: s.value, count: s.count, point: s.point, hit: s.hit } }));
  };

  pinchDetector = createPinchDetector({
    connectBelow: 25,   // pinch starts at or below this value
    releaseAbove: 35,   // pinch ends at or above this value
    onStart: emit("pinchstart"),
    onEnd: emit("pinchend"),
  });
  window.pinch = pinchDetector.state;
  window.castFromPinch = () => castFromPinch(pinchDetector.state.point);
} catch (err) {
  console.error("Pinch detection unavailable (rest of app unaffected):", err);
}
// ========================================================================

// ===================== HITBOX (grey cast of the pinch area) =====================
// Grey 50% plane at the model's depth (z=0), in the same mirrored -1..1 screen space the
// pinch raycast uses. Covers thumb 2-4 + index 5-8 so it stays a rough rectangle even
// when tips 4 and 8 share the same X or Y. Drawn in the front (bottom) view only.
const SHOW_HITBOX = true;        // false = hide the hitbox
const HITBOX_MAGNIFICATION = 0.5; // 1 = full front-view area; lower = smaller box / less area covered
const hitbox = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  // depthTest off + high renderOrder: always drawn on top of everything (temporary debug visual)
  new THREE.MeshBasicMaterial({ color: 0x808080, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, depthTest: false })
);
hitbox.renderOrder = 999;
hitbox.visible = false;
hitbox.layers.set(1);      // only the front view camera renders layer 1
hitbox.raycast = () => {}; // don't let the pinch raycast hit its own hitbox
scene.add(hitbox);
const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * HITBOX_MAGNIFICATION; // world half-height at z=0
const halfW = halfH * camera.aspect;
// ==============================================================================

let lastVideoTime = -1;

function renderLoop() {
  if (video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = handLandmarker.detectForVideo(video, performance.now());
    console.log(result.landmarks, result.handedness);

    if (pinchDetector) {   // feed each new frame to the pinch detector (errors are contained)
      try {
        const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 1;
        pinchDetector.update(result.landmarks?.[0], aspect);
      } catch (err) {
        console.error("Pinch update failed:", err);
      }
    }

    // Hitbox follows the hand whenever the pinch detector sees one
    const hand = result.landmarks?.[0];
    hitbox.visible = SHOW_HITBOX && !!pinchDetector?.state.point;
    if (hitbox.visible) {
      const pts = hand.slice(2, 9);
      const xs = pts.map(p => (1 - p.x) * 2 - 1), ys = pts.map(p => 1 - p.y * 2);
      const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
      hitbox.position.set((x1 + x2) / 2 * halfW, (y1 + y2) / 2 * halfH, 0);
      hitbox.scale.set((x2 - x1) * halfW, (y2 - y1) * halfH, 1);
    }
  }
  requestAnimationFrame(renderLoop);
}
renderLoop();

console.log(THREE);
console.log(scene);