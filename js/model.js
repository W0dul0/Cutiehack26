// Loads the GLB once, centers it, and finds Alice (what the hand hitbox can hit and pick up).
import { THREE, GLTFLoader } from "./libs.js";
import { MODEL_URL, MODEL_SCALE, CHARACTER_NAME, PICKUP_LIFT, ALICE_BUBBLE_SCALE } from "./config.js";

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

  // Alice: her bounds (inside `parent`, so they follow its spin/tilt) are what the hand hitbox is tested against
  const character = findCharacter(model);
  const characterBox = new THREE.Box3().setFromObject(character).applyMatrix4(parent.matrixWorld.clone().invert());
  const size = characterBox.getSize(new THREE.Vector3());
  const liftAmount = (size.y * PICKUP_LIFT) / character.parent.getWorldScale(new THREE.Vector3()).y; // in her own units

  // Her hitbox: a sphere (the red bubble) around her, sized to her tallest side
  const characterSphere = new THREE.Sphere(
    characterBox.getCenter(new THREE.Vector3()),
    (Math.max(size.x, size.y, size.z) / 2) * ALICE_BUBBLE_SCALE
  );

  return { model, mixer, radius, character, characterSphere, liftAmount };
}

// First node whose name starts with CHARACTER_NAME (the loader strips "." from names: "alice_anime.glb" -> "alice_animeglb")
function findCharacter(model) {
  const prefix = CHARACTER_NAME.toLowerCase();
  let found = null;
  model.traverse((o) => {
    if (!found && o.name.toLowerCase().startsWith(prefix)) found = o;
  });
  if (!found) console.warn(`No "${CHARACTER_NAME}" node in the model, so the whole model counts as Alice`);
  return found || model;
}
