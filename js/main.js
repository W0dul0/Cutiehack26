import * as THREE from "https://jsdelivr.net";
import { GLTFLoader } from "https://jsdelivr.net";
import { HandLandmarker, FilesetResolver } from "https://jsdelivr.net";

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
let targetOrbitRadius = 20;
const MIN_ZOOM = 10;
const MAX_ZOOM = 32;
const TURNTABLE_SPEED = 0;

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

scene.add(new THREE.AmbientLight(0xffffff, 1.3));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
const LIGHT_OFFSET = new THREE.Vector3(3, 5, 4);
dirLight.position.copy(LIGHT_OFFSET);
scene.add(dirLight);

const dioramaGroup = new THREE.Group();
scene.add(dioramaGroup);

let targetRotX = 0;
let targetRotY = 0;
let sceneMesh = null;
let targetCharacter = null;
let characterHitbox = null;
let mixer = null;
let isPickedUp = false;

// DPR 1 is plenty sharp for glass reflection and renders 4x faster on Retina screens
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
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

const trackingPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshBasicMaterial({ visible: false })
);
scene.add(trackingPlane);

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

// ===================== SERIAL & ENCODER TRANSFORMS ============================
const ROTATE_STEP = 0.12;
const ZOOM_STEP = 0.8;

function handleEncoderAction(encoderId, action, amount) {
  switch (action) {
    case "RIGHT":
      targetRotY += amount * ROTATE_STEP;
      break;
    case "LEFT":
      targetRotY -= amount * ROTATE_STEP;
      break;
    case "UP":
      targetRotX = THREE.MathUtils.clamp(targetRotX - amount * ROTATE_STEP, -0.85, 0.85);
      break;
    case "DOWN":
      targetRotX = THREE.MathUtils.clamp(targetRotX + amount * ROTATE_STEP, -0.85, 0.85);
      break;
    case "ZOOM_IN":
      targetOrbitRadius = THREE.MathUtils.clamp(targetOrbitRadius - amount * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
      break;
    case "ZOOM_OUT":
      targetOrbitRadius = THREE.MathUtils.clamp(targetOrbitRadius + amount * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
      break;
  }

  window.dispatchEvent(
    new CustomEvent("encoderinput", { detail: { encoderId, action, amount } })
  );
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") handleEncoderAction("E1", "RIGHT", 1);
  if (e.key === "ArrowLeft")  handleEncoderAction("E1", "LEFT", 1);
  if (e.key === "ArrowUp")    handleEncoderAction("E2", "UP", 1);
  if (e.key === "ArrowDown")  handleEncoderAction("E2", "DOWN", 1);
  if (e.key.toLowerCase() === "w") handleEncoderAction("E3", "ZOOM_IN", 1);
  if (e.key.toLowerCase() === "s") handleEncoderAction("E3", "ZOOM_OUT", 1);
});

window.connectEncoders = async function () {
  if (!("serial" in navigator)) {
    alert("Web Serial API is not supported in this browser. Use Chrome or Edge.");
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });

    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();

    window.dispatchEvent(new CustomEvent("serialconnected"));

    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line === "READY") continue;

        const parts = line.split(",");
        if (parts.length === 3) {
          const encoderId = parts[0].trim();
          const action = parts[1].trim().toUpperCase();
          const amount = parseInt(parts[2].trim(), 10);
          if (!Number.isNaN(amount)) {
            handleEncoderAction(encoderId, action, amount);
          }
        }
      }
    }
  } catch (err) {
    console.error("Serial connection error:", err);
  }
};
// ==============================================================================

// Start render loop immediately (no blocking awaits!)
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (mixer) mixer.update(dt);
  if (TURNTABLE_SPEED) targetRotY += TURNTABLE_SPEED * dt;

  dioramaGroup.rotation.y = THREE.MathUtils.lerp(dioramaGroup.rotation.y, targetRotY, 0.2);
  dioramaGroup.rotation.x = THREE.MathUtils.lerp(dioramaGroup.rotation.x, targetRotX, 0.2);
  orbitRadius = THREE.MathUtils.lerp(orbitRadius, targetOrbitRadius, 0.2);
  camera.position.z = orbitRadius;

  renderViews();
}
animate();

// ===================== PINCH & RAYCAST LOGIC ==================================
const raycaster = new THREE.Raycaster();
const WRIST_HEIGHT_CUTOFF = 0.78;
const SENSITIVITY_X = 2.2;
const SENSITIVITY_Y = 2.0;

const pinchState = {
  isPinching: false,
  point: null,
  distance: 0,
  count: 0,
  holdFrames: 0,
};
window.pinch = pinchState;

const castFromPinch = (point) => {
  if (!point) return null;
  camera.position.z = orbitRadius;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(new THREE.Vector2(point.x, point.y), camera);

  const targets = characterHitbox ? [characterHitbox] : scene.children;
  const h = raycaster.intersectObjects(targets, true)[0];
  return h ? { object: h.object, name: h.object.name, point: h.point, distance: h.distance } : null;
};
window.castFromPinch = () => castFromPinch(pinchState.point);
function handlePinchStart(point) {
const hit = castFromPinch(point);
cursorMat.color.setHex(0xff00ff);
cursorMesh.scale.set(1.35, 1.35, 1.35);
window.dispatchEvent(
new CustomEvent("pinchstart", { detail: { point, hit, count: pinchState.count } })
);
if (hit && !isPickedUp) {
isPickedUp = true;
if (targetCharacter) targetCharacter.position.y += 1.5;
window.dispatchEvent(new CustomEvent("characterfound", { detail: { hit } }));
}
}
function handlePinchEnd(point) {
cursorMat.color.setHex(0x00ffff);
cursorMesh.scale.set(1, 1, 1);
window.dispatchEvent(
new CustomEvent("pinchend", { detail: { point, count: pinchState.count } })
);
if (isPickedUp && targetCharacter) {
targetCharacter.position.y -= 1.5;
isPickedUp = false;
}
}
function updatePinch(hand) {
if (!hand) {
pinchState.point = null;
if (pinchState.isPinching) {
pinchState.isPinching = false;
handlePinchEnd(null);
}
pinchState.holdFrames = 0;
return;
}
const thumb = hand[4];
const index = hand[8];
const midX = (thumb.x + index.x) / 2;
const midY = (thumb.y + index.y) / 2;
pinchState.point = {
x: THREE.MathUtils.clamp(((1 - midX) * 2 - 1) * SENSITIVITY_X, -1, 1),
y: THREE.MathUtils.clamp((1 - midY * 2) * SENSITIVITY_Y, -1, 1),
};
const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
pinchState.distance = dist;
if (dist < 0.045) {
pinchState.holdFrames++;
if (pinchState.holdFrames === 4 && !pinchState.isPinching) {
pinchState.isPinching = true;
pinchState.count++;
handlePinchStart(pinchState.point);
}
} else {
pinchState.holdFrames = 0;
if (pinchState.isPinching) {
pinchState.isPinching = false;
handlePinchEnd(pinchState.point);
}
}
}
// ==============================================================================
// ===================== PARALLEL ASYNC BOOTSTRAP ===============================
// 1. Load GLB asynchronously without blocking UI or MediaPipe
async function loadDiorama() {
try {
const gltfLoader = new GLTFLoader();
const gltf = await gltfLoader.loadAsync("/assets/scene.glb");
sceneMesh = gltf.scene;
sceneMesh.scale.set(0.1, 0.1, 0.1);
sceneMesh.position.set(0, 0, 0);
dioramaGroup.add(sceneMesh);
if (gltf.animations && gltf.animations.length > 0) {
mixer = new THREE.AnimationMixer(sceneMesh);
gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
}
targetCharacter = sceneMesh.getObjectByName("character") || sceneMesh;
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
} catch (err) {
console.error("Failed to load GLTF model:", err);
}
}
// 2. Start webcam at fast 480p resolution & MediaPipe in parallel
async function initHandTracking() {
const video = document.getElementById("webcam");
if (!video || !navigator.mediaDevices?.getUserMedia) return;
const webcamPromise = navigator.mediaDevices
.getUserMedia({
video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
audio: false,
})
.then(async (stream) => {
video.srcObject = stream;
await video.play();
});
const landmarkerPromise = FilesetResolver.forVisionTasks(
"jsdelivr.net"
).then((vision) =>
HandLandmarker.createFromOptions(vision, {
baseOptions: {
modelAssetPath:
"googleapis.com",
delegate: "GPU",
},
runningMode: "VIDEO",
numHands: 1,
})
);
// Wait for both simultaneously instead of sequentially
const [, handLandmarker] = await Promise.all([webcamPromise, landmarkerPromise]);
let lastVideoTime = -1;
function trackingLoop() {
if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
lastVideoTime = video.currentTime;
const result = handLandmarker.detectForVideo(video, performance.now());
const rawHand = result.landmarks?.[0];
const handInAirspace = rawHand && rawHand[0].y <= WRIST_HEIGHT_CUTOFF ? rawHand : null;
updatePinch(handInAirspace);
const active = !!handInAirspace && !!pinchState.point;
borderMat.opacity = THREE.MathUtils.lerp(borderMat.opacity, active ? 0.85 : 0, 0.2);
cursorMat.opacity = THREE.MathUtils.lerp(cursorMat.opacity, active ? 1.0 : 0, 0.25);
if (active) {
camera.position.z = orbitRadius;
camera.updateMatrixWorld();
raycaster.setFromCamera(
new THREE.Vector2(pinchState.point.x, pinchState.point.y),
camera
);
const planeHit = raycaster.intersectObject(trackingPlane)[0];
if (planeHit) {
cursorMesh.position.lerp(planeHit.point, 0.25);
}
}
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
requestAnimationFrame(trackingLoop);
}
trackingLoop();
}
// Fire both pipelines at the exact same millisecond
loadDiorama();
initHandTracking();