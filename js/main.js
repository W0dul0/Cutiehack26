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
let orbitRadius = 20;
const MIN_ZOOM = 10;
const MAX_ZOOM = 32;
const TURNTABLE_SPEED = 0; // Set > 0 for passive spin, 0 for encoder/keyboard control

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, orbitRadius);

const viewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const target = new THREE.Vector3(0, 0, 0);

const VIEWS = [
  { slot: "bottom", angle: 0,            roll: 0,            front: true },
  { slot: "right",  angle: Math.PI / 2,  roll: -Math.PI / 2 },
  { slot: "top",    angle: Math.PI,      roll: Math.PI },
  { slot: "left",   angle: -Math.PI / 2, roll: Math.PI / 2 },
];

const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
const LIGHT_OFFSET = new THREE.Vector3(3, 5, 4);
dirLight.position.copy(LIGHT_OFFSET);
scene.add(dirLight);

// Diorama container controlled by rotary encoders / keyboard
const dioramaGroup = new THREE.Group();
scene.add(dioramaGroup);

let sceneMesh = null;
let targetCharacter = null;
let characterHitbox = null;
let mixer = null;
let isPickedUp = false;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;
renderer.setScissorTest(true);
renderer.domElement.style.display = "block";
container.appendChild(renderer.domElement);

let canvasW = 0, canvasH = 0;
function resize() {
  const size = Math.min(container.clientWidth || 660, container.clientHeight || 660);
  canvasW = size;
  canvasH = size;
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
      target.x + Math.sin(v.angle) * orbitRadius,
      target.y,
      target.z + Math.cos(v.angle) * orbitRadius
    );
    viewCamera.up.set(0, 1, 0);
    viewCamera.lookAt(target);
    viewCamera.rotateZ(v.roll);

    dirLight.position.copy(viewCamera.position).add(LIGHT_OFFSET);

    if (v.front) viewCamera.layers.enable(1);
    else viewCamera.layers.disable(1);

    renderer.setViewport(r.x, r.y, r.s, r.s);
    renderer.setScissor(r.x, r.y, r.s, r.s);
    renderer.render(scene, viewCamera);
  }
}
// ==============================================================================

// ===================== LAYER 1 FRONT HUD BORDER & 3D CURSOR ===================
// 1. Front-facing tracking border (Layer 1 only -> appears ONLY on front glass)
const borderMat = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthTest: false,
});
const frontBorderUI = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.PlaneGeometry(7.2, 7.2)),
  borderMat
);
frontBorderUI.position.set(0, 0, 4);
frontBorderUI.layers.set(1);
frontBorderUI.raycast = () => {};
scene.add(frontBorderUI);

// 2. 3D Floating Reticle Cursor (Visible across 3D scene for depth aiming)
const cursorMat = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthTest: false,
});
const cursorMesh = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 32), cursorMat);
cursorMesh.renderOrder = 1000;
cursorMesh.raycast = () => {};
scene.add(cursorMesh);

// 3. Invisible tracking plane at Z=0 for projecting 2D hand coordinates into 3D
const trackingPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshBasicMaterial({ visible: false })
);
scene.add(trackingPlane);

// 4. Grey pinch area indicator (Layer 1 only)
const SHOW_HITBOX = true;
const HITBOX_MAGNIFICATION = 0.5;
const hitbox = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    color: 0x808080,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  })
);
hitbox.renderOrder = 999;
hitbox.visible = false;
hitbox.layers.set(1);
hitbox.raycast = () => {};
scene.add(hitbox);

function getProjectionBounds() {
  const halfH = orbitRadius * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * HITBOX_MAGNIFICATION;
  const halfW = halfH * camera.aspect;
  return { halfW, halfH };
}
// ==============================================================================

// ===================== LOAD GLB & GENEROUS CHARACTER HITBOX ===================
try {
  const gltfLoader = new GLTFLoader();
  const gltf = await gltfLoader.loadAsync("/assets/scene.glb");

  sceneMesh = gltf.scene;
  sceneMesh.scale.set(0.1, 0.1, 0.1);
  sceneMesh.position.set(0, 0, 0);
  dioramaGroup.add(sceneMesh);

  // Play Blockbench animations if present
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(sceneMesh);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  }

  // Find named character mesh (e.g., "character" or "target"), fallback to whole sceneMesh
  targetCharacter = sceneMesh.getObjectByName("character") || sceneMesh;

  // Create generous invisible sphere hitbox around the target character
  const box = new THREE.Box3().setFromObject(targetCharacter);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1.5) * 0.85;

  characterHitbox = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true, visible: false })
  );
  characterHitbox.position.copy(center);
  characterHitbox.name = "character_hitbox";
  dioramaGroup.add(characterHitbox);

  console.log("Loaded GLB:", sceneMesh);
} catch (err) {
  console.error("Failed to load GLTF model:", err);
}
// ==============================================================================

// ===================== HARDWARE INPUTS (Web Serial + Keyboard Fallback) =======
function applyDialInput(axis, delta) {
  if (axis === "X") dioramaGroup.rotation.y += delta * 0.06;
  if (axis === "Y") dioramaGroup.rotation.x = THREE.MathUtils.clamp(dioramaGroup.rotation.x + delta * 0.06, -0.8, 0.8);
  if (axis === "Z") {
    orbitRadius = THREE.MathUtils.clamp(orbitRadius + delta * 0.4, MIN_ZOOM, MAX_ZOOM);
    camera.position.z = orbitRadius;
  }
}

// Keyboard simulation fallback (Arrow keys = X/Y orbit, W/S = Zoom)
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft")  applyDialInput("X", -1);
  if (e.key === "ArrowRight") applyDialInput("X", 1);
  if (e.key === "ArrowUp")    applyDialInput("Y", -1);
  if (e.key === "ArrowDown")  applyDialInput("Y", 1);
  if (e.key.toLowerCase() === "w") applyDialInput("Z", -1);
  if (e.key.toLowerCase() === "s") applyDialInput("Z", 1);
});

// Web Serial API for ESP32 (expects lines like "X:1", "Y:-1", "Z:1")
window.connectEncoders = async function () {
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();

    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const clean = line.trim();
          if (clean.includes(":")) {
            const [axis, valStr] = clean.split(":");
            const val = parseFloat(valStr);
            if (!Number.isNaN(val)) applyDialInput(axis.toUpperCase(), val);
          }
        }
      }
    }
  } catch (err) {
    console.error("Serial connection error:", err);
  }
};
// ==============================================================================

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  if (dioramaGroup && TURNTABLE_SPEED) dioramaGroup.rotation.y += TURNTABLE_SPEED * dt;
  renderViews();
}
animate();

// ===================== MEDIAPIPE & PINCH INTERACTION ==========================
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
const raycaster = new THREE.Raycaster();
const WRIST_HEIGHT_CUTOFF = 0.78; // Ignore hands below this Y (turning knobs on table)
const SENSITIVITY_X = 2.2;
const SENSITIVITY_Y = 2.0;
const castFromPinch = (point) => {
if (!point) return null;
camera.position.z = orbitRadius;
camera.updateMatrixWorld();
raycaster.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
// Check generous character hitbox first, then fallback to scene meshes
const targets = characterHitbox ? [characterHitbox] : scene.children;
const h = raycaster.intersectObjects(targets, true)[0];
return h ? { object: h.object, name: h.object.name, point: h.point, distance: h.distance } : null;
};
function handlePinchStart(point) {
const hit = castFromPinch(point);
cursorMat.color.setHex(0xff00ff);
cursorMesh.scale.set(1.35, 1.35, 1.35);
if (hit && !isPickedUp) {
isPickedUp = true;
console.log("Character found!", hit.name);
if (targetCharacter) targetCharacter.position.y += 1.5; // Lift character out of diorama
window.dispatchEvent(new CustomEvent("characterfound", { detail: { hit } }));
}
}
function handlePinchEnd() {
cursorMat.color.setHex(0x00ffff);
cursorMesh.scale.set(1, 1, 1);
if (isPickedUp && targetCharacter) {
targetCharacter.position.y -= 1.5;
isPickedUp = false;
}
}
// Try external ./pinch.js first, otherwise use built-in Euclidean pinch detector
let pinchDetector = null;
try {
const { createPinchDetector } = await import("./pinch.js");
const emit = (name, fn) => (s) => {
s.hit = castFromPinch(s.point);
fn(s.point);
window.dispatchEvent(new CustomEvent(name, { detail: s }));
};
pinchDetector = createPinchDetector({
connectBelow: 25,
releaseAbove: 35,
onStart: emit("pinchstart", handlePinchStart),
onEnd: emit("pinchend", handlePinchEnd),
});
} catch {
let pinching = false;
let holdFrames = 0;
const state = { point: null, value: 0, count: 0 };
pinchDetector = {
state,
update(hand) {
if (!hand) {
state.point = null;
if (pinching) {
pinching = false;
handlePinchEnd();
}
holdFrames = 0;
return;
}
const thumb = hand[4];
const index = hand[8];
const midX = (thumb.x + index.x) / 2;
const midY = (thumb.y + index.y) / 2;
// Mirror X for Pepper's Ghost glass reflection and apply chest-level amplification
state.point = {
x: THREE.MathUtils.clamp(((1 - midX) * 2 - 1) * SENSITIVITY_X, -1, 1),
y: THREE.MathUtils.clamp((1 - midY * 2) * SENSITIVITY_Y, -1, 1),
};
const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
state.value = dist;
if (dist < 0.045) {
holdFrames++;
if (holdFrames === 4 && !pinching) {
pinching = true;
state.count++;
handlePinchStart(state.point);
}
} else {
holdFrames = 0;
if (pinching) {
pinching = false;
handlePinchEnd();
}
}
},
};
}
let lastVideoTime = -1;
function renderLoop() {
if (video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
lastVideoTime = video.currentTime;
const result = handLandmarker.detectForVideo(video, performance.now());
const rawHand = result.landmarks?.[0];
// Airspace Height Filter: ignore hand if resting low near the physical dials
const handInAirspace = rawHand && rawHand[0].y <= WRIST_HEIGHT_CUTOFF ? rawHand : null;
const videoAspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 1;
pinchDetector.update(handInAirspace, videoAspect);
const active = !!handInAirspace && !!pinchDetector.state.point;
// Fade Layer 1 front border & 3D cursor smoothly
borderMat.opacity = THREE.MathUtils.lerp(borderMat.opacity, active ? 0.85 : 0, 0.2);
cursorMat.opacity = THREE.MathUtils.lerp(cursorMat.opacity, active ? 1.0 : 0, 0.25);
if (active) {
// Project amplified pointer onto Z=0 tracking plane for 3D reticle position
camera.position.z = orbitRadius;
camera.updateMatrixWorld();
raycaster.setFromCamera(
new THREE.Vector2(pinchDetector.state.point.x, pinchDetector.state.point.y),
camera
);
const planeHit = raycaster.intersectObject(trackingPlane)[0];
if (planeHit) {
cursorMesh.position.lerp(planeHit.point, 0.25);
}
}
// Update grey pinch area preview
hitbox.visible = SHOW_HITBOX && active;
if (hitbox.visible) {
const { halfW, halfH } = getProjectionBounds();
const pts = handInAirspace.slice(2, 9);
const xs = pts.map((p) => (1 - p.x) * 2 - 1);
const ys = pts.map((p) => 1 - p.y * 2);
const x1 = Math.min(...xs), x2 = Math.max(...xs);
const y1 = Math.min(...ys), y2 = Math.max(...ys);
hitbox.position.set(((x1 + x2) / 2) * halfW, ((y1 + y2) / 2) * halfH, 0);
hitbox.scale.set((x2 - x1) * halfW, (y2 - y1) * halfH, 1);
}
}
requestAnimationFrame(renderLoop);
}
renderLoop();