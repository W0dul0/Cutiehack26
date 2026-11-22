// Loads the GLB once, centers it, and builds the invisible hit sphere the pinch aims at.
import { THREE, GLTFLoader } from "./libs.js";
import { MODEL_URL, MODEL_SCALE, CHARACTER_NAME } from "./config.js";

export async function loadModel(parent) {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const model = gltf.scene;
  model.scale.setScalar(MODEL_SCALE);
  parent.add(model);
  parent.updateWorldMatrix(true, false);

  // Center the model on its parent so it rotates in place instead of swinging out of the views
  const bounds = new THREE.Box3().setFromObject(model);
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  model.position.sub(parent.worldToLocal(bounds.getCenter(new THREE.Vector3())));

  let mixer = null;
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) mixer.clipAction(clip).play();
  }

  // A sphere around the character is much easier to pinch than its exact mesh.
  // It's hidden, but raycasts still hit hidden objects.
  const character = model.getObjectByName(CHARACTER_NAME) || model;
  const charBounds = new THREE.Box3().setFromObject(character);
  const size = charBounds.getSize(new THREE.Vector3());
  const hitSphere = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(size.x, size.y, size.z, 1.5) * 0.85, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
  );
  hitSphere.name = "character_hitbox";
  hitSphere.visible = false; // set true to see it while debugging
  hitSphere.position.copy(parent.worldToLocal(charBounds.getCenter(new THREE.Vector3())));
  parent.add(hitSphere);

  return { model, character, hitSphere, mixer, radius };
}
