import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { drawHands } from "./draw.js";

const DEFAULTS = {
  wasmBaseUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
  modelAssetPath:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  maxHands: 2,
};

export async function createHandTracker({
  videoEl,
  canvasEl,
  onFrame,
  onStatus,
  config = {},
} = {}) {
  const cfg = { ...DEFAULTS, ...config };

  if (!videoEl || !canvasEl) {
    throw new Error("videoEl und canvasEl sind erforderlich.");
  }

  onStatus?.("MediaPipe wird geladen...");
  const vision = await FilesetResolver.forVisionTasks(cfg.wasmBaseUrl);

  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: cfg.modelAssetPath,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: cfg.maxHands,
  });

  const ctx = canvasEl.getContext("2d");
  const drawingUtils = new DrawingUtils(ctx);

  let stream = null;
  let running = false;

  async function initCamera() {
    onStatus?.("Kamera wird angefragt...");
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();

    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    onStatus?.("Handtracking aktiv");
  }

  function loop() {
    if (!running) return;

    const timestampMs = performance.now();
    const results = landmarker.detectForVideo(videoEl, timestampMs);

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    drawHands({ results, drawingUtils });

    const hands = (results?.landmarks || []).map((lm, i) => ({
      landmarks: lm,
      handedness: results?.handednesses?.[i]?.[0]?.categoryName ?? "Unknown",
    }));

    onFrame?.({
      hands,
      timestampMs,
      width: canvasEl.width,
      height: canvasEl.height,
    });

    requestAnimationFrame(loop);
  }

  return {
    async start() {
      if (running) return;
      running = true;
      await initCamera();
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      stream?.getTracks()?.forEach((t) => t.stop());
    },
  };
}

