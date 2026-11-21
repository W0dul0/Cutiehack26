// Import the core Three.js library from a reliable CDN for 3D rendering
import * as THREE from "https://esm.sh/three@0.160.0";

// Import HandLandmarker and FilesetResolver classes from MediaPipe for computer vision tracking
import { HandLandmarker, FilesetResolver } from "https://esm.sh/@mediapipe/tasks-vision@0.10.9";

import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

    // Create new 3D scene container
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101014); // Dark futuristic background color

    // Set up camera aspect ratio based on container dimensions
    const aspect = 980/980;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 30);
    this.camera.position.set(0, 0, 5);
    console.log(THREE)
    console.log(scene)