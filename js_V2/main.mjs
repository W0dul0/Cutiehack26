import * as THREE from "https://esm.sh/three@0.160.0";
import { HandLandmarker, FilesetResolver } from "https://esm.sh/@mediapipe/tasks-vision@0.10.9";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const container = document.getElementById("Three.js");
if (!container) {
  throw new Error('Could not find element with id="Three.js"');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

const width = container.clientWidth || 980;
const height = container.clientHeight || 980;
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 30);
camera.position.set(0, 0, 20);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

let sceneMesh = null;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

/*test cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
*/

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

function animate() {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);
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
// Everything here sits in ONE try/catch, so if pinch.js is missing or broken the rest of the app still runs.
let pinchDetector = null;
try {
  const { createPinchDetector } = await import("./pinch.js");
  const raycaster = new THREE.Raycaster();

  // Ray from the camera through the pinch point. Never throws: any problem just means "no hit".
  const castFromPinch = (point) => {
    try {
      if (!point) return null;
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
  }
  requestAnimationFrame(renderLoop);
}
renderLoop();

console.log(THREE);
console.log(scene);
