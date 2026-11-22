import * as THREE from "https://esm.sh/three@0.160.0";
import { HandLandmarker, FilesetResolver } from "https://esm.sh/@mediapipe/tasks-vision@0.10.9";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const container = document.getElementById("Three.js");
if (!container) {
  throw new Error('Could not find element with id="Three.js"');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ===================== PEPPER'S GHOST (4 scissored views) =====================
const VIEW_RATIO = 0.33;
const CENTER_GAP = 0;
const ORBIT_RADIUS = 20;
const TURNTABLE_SPEED = 0.4;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, ORBIT_RADIUS);

const viewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const target = new THREE.Vector3(0, 0, 0);

const VIEWS = [
  { slot: "bottom", angle: 0,            roll: 0,            front: true },
  { slot: "right",  angle: Math.PI / 2,  roll: -Math.PI / 2 },
  { slot: "top",    angle: Math.PI,      roll: Math.PI },
  { slot: "left",   angle: -Math.PI / 2, roll: Math.PI / 2 },
];

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
const LIGHT_OFFSET = new THREE.Vector3(3, 5, 4);
dirLight.position.copy(LIGHT_OFFSET);
scene.add(dirLight);

let sceneMesh = null;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;
renderer.setScissorTest(true);
renderer.domElement.style.display = "block";
container.appendChild(renderer.domElement);

let canvasW = 0, canvasH = 0;
function resize() {
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

function slotRect(slot) {
  const size = Math.min(canvasW, canvasH);
  const s = Math.floor(size * VIEW_RATIO);
  const ox = Math.floor((canvasW - size) / 2);
  const oy = Math.floor((canvasH - size) / 2);
  const cx = ox + Math.floor((size - s) / 2);
  const cy = oy + Math.floor((size - s) / 2);
  const g = CENTER_GAP;
  switch (slot) {
    case "bottom": return { x: cx,               y: oy + g,            s };
    case "top":    return { x: cx,               y: oy + size - s - g, s };
    case "left":   return { x: ox + g,           y: cy,                s };
    case "right":  return { x: ox + size - s - g, y: cy,               s };
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

    dirLight.position.copy(viewCamera.position).add(LIGHT_OFFSET);

    if (v.front) viewCamera.layers.enable(1); else viewCamera.layers.disable(1);

    renderer.setViewport(r.x, r.y, r.s, r.s);
    renderer.setScissor(r.x, r.y, r.s, r.s);
    renderer.render(scene, viewCamera);
  }
}
// ==============================================================================

try {
  const gltfLoader = new GLTFLoader();
  const gltf = await gltfLoader.loadAsync("/assets/scene.glb");

  sceneMesh = gltf.scene;
  sceneMesh.scale.set(0.1, 0.1, 0.1);
  sceneMesh.position.set(0, 0, 0);

  scene.add(sceneMesh);
  console.log("Loaded GLB:", sceneMesh);
} catch (err) {
  console.error("Failed to load GLTF model:", err);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (sceneMesh && TURNTABLE_SPEED) sceneMesh.rotation.y += TURNTABLE_SPEED * dt;
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
let pinchDetector = null;
try {
  const { createPinchDetector } = await import("./pinch.js");
  const raycaster = new THREE.Raycaster();

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

  const emit = (name) => (s) => {
    s.hit = castFromPinch(s.point);
    window.dispatchEvent(new CustomEvent(name, { detail: { value: s.value, count: s.count, point: s.point, hit: s.hit } }));
  };

  pinchDetector = createPinchDetector({
    connectBelow: 25,
    releaseAbove: 35,
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
const SHOW_HITBOX = true;
const HITBOX_MAGNIFICATION = 0.5;
const hitbox = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: 0x808080, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, depthTest: false })
);
hitbox.renderOrder = 999;
hitbox.visible = false;
hitbox.layers.set(1);
hitbox.raycast = () => {};
scene.add(hitbox);
const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * HITBOX_MAGNIFICATION;
const halfW = halfH * camera.aspect;
// ==============================================================================

let lastVideoTime = -1;

function renderLoop() {
  if (video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = handLandmarker.detectForVideo(video, performance.now());

    if (pinchDetector) {
      try {
        const videoAspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 1;
        pinchDetector.update(result.landmarks?.[0], videoAspect);
      } catch (err) {
        console.error("Pinch update failed:", err);
      }
    }

    const hand = result.landmarks?.[0];
    hitbox.visible = SHOW_HITBOX && !!hand && !!pinchDetector?.state.point;
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