// Webcam + MediaPipe hand landmarks. Both start in parallel.
import { HandLandmarker, FilesetResolver, MEDIAPIPE_WASM_URL, HAND_MODEL_URL } from "./libs.js";
import { WRIST_HEIGHT_CUTOFF } from "./config.js";

async function startWebcam(video) {
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, // 480p is plenty and fast
    audio: false,
  });
  await video.play();
}

async function createLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands: 1,
  });
  try {
    return await HandLandmarker.createFromOptions(vision, options("GPU"));
  } catch (err) {
    console.warn("GPU hand tracking unavailable, falling back to CPU:", err);
    return HandLandmarker.createFromOptions(vision, options("CPU"));
  }
}

export async function startHandTracking(video) {
  if (!video) throw new Error('No <video id="webcam"> on the page');
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser can't open the webcam here (it needs https or localhost)");
  }

  const [, landmarker] = await Promise.all([startWebcam(video), createLandmarker()]);
  let lastVideoTime = -1;

  return {
    // Returns the hand's 21 landmarks, null if no hand is in range,
    // or undefined if the webcam hasn't produced a new frame since last call.
    detect() {
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return undefined;
      lastVideoTime = video.currentTime;
      const hand = landmarker.detectForVideo(video, performance.now()).landmarks?.[0];
      return hand && hand[0].y <= WRIST_HEIGHT_CUTOFF ? hand : null;
    },
  };
}
