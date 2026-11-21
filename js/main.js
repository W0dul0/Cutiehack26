import * as THREE from "https://esm.sh/three@0.160.0";
import { HandLandmarker, FilesetResolver } from "https://esm.sh/@mediapipe/tasks-vision@0.10.9";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const container = document.getElementById("Three.js");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

const width = container.clientWidth || 980;
const height = container.clientHeight || 980;
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 30);
<<<<<<< HEAD
camera.position.set(0, 0, 5);
=======
camera.position.set(0, 0, 100);
>>>>>>> parent of 74a1bdf (Update)

const this.characterMesh = null; 

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

    try {
      const gltfLoader = new GLTFLoader();
      const duckGlb = await gltfLoader.loadAsync('./');
      
      this.characterMesh = duckGlb.scene;

      // Adjust scale and center the model properly
      this.characterMesh.scale.set(0.1, 0.1, 0.1); 
      //this.characterMesh.position.set(0, 0, 0);
      
      // Center geometry/mesh layout if needed
      this.characterMesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry.center();
        }
      });
      
      this.scene.add(this.sceneMesh);
    }



function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();