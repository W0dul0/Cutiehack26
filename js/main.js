import * as THREE from "https://esm.sh/three@0.160.0";
import { HandLandmarker, FilesetResolver } from "https://esm.sh/@mediapipe/tasks-vision@0.10.9";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// Use 'const' instead of 'this.' if not inside a class
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

const aspect = 980 / 980;
const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 30);
camera.position.set(0, 0, 5);

console.log(THREE);
console.log(scene);