import * as THREE from "https://esm.sh/three@0.160.0";
import { HandLandmarker, FilesetResolver } from "https://esm.sh/@mediapipe/tasks-vision@0.10.9";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// Hide button: fade the webcam out / back in
const hideButton = document.getElementById("hide-button");
const webcamEl = document.getElementById("webcam");
hideButton?.addEventListener("click", () => {
  const isHidden = webcamEl.classList.contains("webcam-hidden");
  webcamEl.classList.toggle("webcam-hidden", !isHidden);
  webcamEl.classList.toggle("webcam-shown", isHidden);
  hideButton.textContent = isHidden ? "Hide" : "Show";
});

// Collapse button: slide the debug panel closed / open
const collapseBtn = document.getElementById("collapse");
const debugPanel = document.getElementById("debug-panel");
collapseBtn?.addEventListener("click", () => {
  const collapsed = debugPanel.classList.toggle("panel-collapsed");
  collapseBtn.classList.toggle("flipped", collapsed);
  collapseBtn.title = collapsed ? "Expand panel" : "Collapse panel";
});

const container = document.getElementById("Three.js");
if (!container) {
  throw new Error('Could not find element with id="Three.js"');
}

// ---------- Pepper's ghost settings ----------
const VIEW_RATIO = 0.33;     // each view's side length as a fraction of the square canvas
const CENTER_GAP = 0;        // px each view is pushed outward from the center (open space for the pyramid tip)
const ORBIT_RADIUS = 20;     // camera distance from the model
const TURNTABLE_SPEED = 0.4; // radians/sec the model spins on its own (0 = off)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // pure black = invisible on the pyramid

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = false;       // we clear manually, once per frame
renderer.setScissorTest(true);    // each view only draws inside its own rectangle
container.appendChild(renderer.domElement);

// Four views, one per pyramid face. Each camera looks at the model from a
// different side; `roll` rotates the image so the model's TOP points toward
// the center of the screen (where the pyramid's apex sits).
//   slot:  where the view sits on the canvas
//   angle: camera azimuth around the Y axis (0 = +Z, looking at the model's front)
//   roll:  camera roll around its view axis
const VIEWS = [
  { slot: "bottom", angle: 0,                roll: 0 },
  { slot: "right",  angle: Math.PI / 2,      roll: -Math.PI / 2 },
  { slot: "top",    angle: Math.PI,          roll: Math.PI },
  { slot: "left",   angle: -Math.PI / 2,     roll: Math.PI / 2 },
];

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); // square views -> aspect 1
const target = new THREE.Vector3(0, 0, 0);

// Canvas sizing: use the largest centered square inside the container
let canvasW = 0, canvasH = 0;
function resize() {
  canvasW = container.clientWidth || 980;
  canvasH = container.clientHeight || 980;
  renderer.setSize(canvasW, canvasH);
}
resize();
window.addEventListener("resize", resize);

// Viewport origin is the bottom-left corner in WebGL
function slotRect(slot) {
  const size = Math.min(canvasW, canvasH);
  const s = Math.floor(size * VIEW_RATIO);
  const ox = Math.floor((canvasW - size) / 2);
  const oy = Math.floor((canvasH - size) / 2);
  const cx = ox + Math.floor((size - s) / 2);
  const cy = oy + Math.floor((size - s) / 2);
  switch (slot) {
    case "bottom": return { x: cx,            y: oy,            s };
    case "top":    return { x: cx,            y: oy + size - s, s };
    case "left":   return { x: ox,            y: cy,            s };
    case "right":  return { x: ox + size - s, y: cy,            s };
  }
}

function applyGap(rect, slot) {
  const g = CENTER_GAP;
  if (slot === "bottom") rect.y += g;
  if (slot === "top")    rect.y -= g;
  if (slot === "left")   rect.x += g;
  if (slot === "right")  rect.x -= g;
  return rect;
}

function renderViews() {
  renderer.setViewport(0, 0, canvasW, canvasH);
  renderer.setScissor(0, 0, canvasW, canvasH);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();

  for (const v of VIEWS) {
    const r = applyGap(slotRect(v.slot), v.slot);

    camera.position.set(
      target.x + Math.sin(v.angle) * ORBIT_RADIUS,
      target.y,
      target.z + Math.cos(v.angle) * ORBIT_RADIUS
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.rotateZ(v.roll);

    renderer.setViewport(r.x, r.y, r.s, r.s);
    renderer.setScissor(r.x, r.y, r.s, r.s);
    renderer.render(scene, camera);
  }
}

// ---------- Model ----------
let sceneMesh = null;
try {
  const gltfLoader = new GLTFLoader();
  const gltf = await gltfLoader.loadAsync("/assets/scene.glb");

  sceneMesh = gltf.scene;
  sceneMesh.scale.set(1, 1, 1);
  sceneMesh.position.set(0, 0, 0);

  scene.add(sceneMesh);
  console.log("Loaded GLB:", sceneMesh);
} catch (err) {
  console.error("Failed to load GLTF model:", err);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  if (sceneMesh && TURNTABLE_SPEED) {
    sceneMesh.rotation.y += TURNTABLE_SPEED * clock.getDelta();
  } else {
    clock.getDelta();
  }
  renderViews();
}
animate();

// ---------- MediaPipe Engine ----------
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

let lastVideoTime = -1;

function renderLoop() {
  if (video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = handLandmarker.detectForVideo(video, performance.now());
    console.log(result.landmarks);
  }
  requestAnimationFrame(renderLoop);
}
renderLoop();