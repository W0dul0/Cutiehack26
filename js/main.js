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
camera.position.set(0, 0, 5);

// Add light so PBR/GLTF materials aren't pitch black
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

let characterMesh = null;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

try {
  const gltfLoader = new GLTFLoader();
  // Replace './duck.glb' with the actual path to your .glb or .gltf file
  const duckGlb = await gltfLoader.loadAsync("./assets/alice_anime.glb");

  characterMesh = duckGlb.scene;
  characterMesh.scale.set(0.1, 0.1, 0.1);
  characterMesh.position.set(0, 0, 0);

  characterMesh.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.geometry.center();
    }
  });

  scene.add(characterMesh);
} catch (err) {
  console.error("Failed to load GLTF model:", err);
}

function animate() {
  requestAnimationFrame(animate);

  if (characterMesh) {
    characterMesh.rotation.y += 0.01;
  }

  renderer.render(scene, camera);
}
animate();
console.log(THREE);
console.log(scene);