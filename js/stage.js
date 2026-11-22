// The 3D scene itself: background, lights, and the group the model sits in.
import { THREE } from "./libs.js";

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // pure black = invisible on the pyramid glass
scene.matrixWorldAutoUpdate = false;          // hologram.render() updates it once per frame, not once per view

scene.add(new THREE.AmbientLight(0xffffff, 1.3));

// Moved next to each view's camera while that view is drawn (see hologramViews.js)
export const keyLight = new THREE.DirectionalLight(0xffffff, 2);
scene.add(keyLight);

// The knobs/keys rotate this group; the model and its pick-up hit sphere live inside it
export const modelRoot = new THREE.Group();
scene.add(modelRoot);
