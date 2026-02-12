import { DrawingUtils, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const IDX = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
};

const FIST_HOLD_FRAMES = 2;
const SCROLL_DEADZONE = 0.004;
const SCROLL_INTERVAL_MS = 24;

const POINTER_SEND_INTERVAL_MS = 20;
const POINTER_MIN_DELTA = 0.0025;
const POINTER_SMOOTHING = 0.3;

const PINCH_THRESHOLD_DOWN = 0.048;
const PINCH_THRESHOLD_UP = 0.062;
const PINCH_DOWN_FRAMES = 1;
const PINCH_UP_FRAMES = 1;
const CLICK_COOLDOWN_MS = 260;

const WASM_BASE_URL = chrome.runtime.getURL("mediapipe/wasm");
const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const CONTROLLER_PAGE_URL = chrome.runtime.getURL("controller.html");
const targetTabIdFromLaunch = parseTargetTabId(window.location.href);

const videoEl = getEl("video");
const overlayEl = getEl("overlay");
const startBtn = getEl("startBtn");
const stopBtn = getEl("stopBtn");
const statusEl = getEl("status");
const eventEl = getEl("event");
const diagEl = getEl("diag");

const overlayCtx = overlayEl.getContext("2d");
const drawer = new DrawingUtils(overlayCtx);

let stream = null;
let running = false;
let handLandmarker = null;
let fistCount = 0;
let lastPalmY = null;
let smoothedPalmY = null;
let lastEmitAt = -1;
let frameCount = 0;

let pointerVisible = false;
let smoothedPointerX = null;
let smoothedPointerY = null;
let lastPointerSentAt = -1;
let lastPointerSentX = null;
let lastPointerSentY = null;

let pinchingLogical = false;
let pinchDownCount = 0;
let pinchUpCount = 0;
let lastClickAt = -1;

let cachedTargetTabId = null;
let cachedTargetTabUrl = null;

const diagnostics = {
  model: "not_loaded",
  camera: "idle",
  hand: "none",
  activeTab: targetTabIdFromLaunch == null ? "target_not_set" : `target_id:${targetTabIdFromLaunch}`,
  lastSend: "none",
  frames: "0",
  pointer: "hidden",
  pinch: "open",
};

renderDiagnostics();

startBtn.addEventListener("click", () => {
  void start();
});
stopBtn.addEventListener("click", () => stop());

async function start() {
  if (running) return;
  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setStatus("Starting camera...");
  setEvent("Waiting for gestures");
  setDiag("camera", "starting");
  setDiag("lastSend", "none");

  try {
    const target = await ensureTargetTab(true);
    if (!target?.id) {
      setDiag("activeTab", "none");
      setStatus("No target tab available");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    setDiag("camera", "stream_open");
    videoEl.srcObject = stream;
    await videoEl.play();
    setDiag("camera", `playing ${videoEl.videoWidth}x${videoEl.videoHeight}`);

    if (!handLandmarker) {
      setStatus("Loading MediaPipe...");
      setDiag("model", "loading");
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
      setDiag("model", "ready");
    } else {
      setDiag("model", "cached");
    }

    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 360;
    overlayEl.width = w;
    overlayEl.height = h;
    frameCount = 0;
    setDiag("frames", "0");

    setStatus("Active");
    requestAnimationFrame(tick);
  } catch (err) {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    videoEl.srcObject = null;
    running = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    setDiag("camera", "error");
    setDiag("model", diagnostics.model === "loading" ? "error" : diagnostics.model);
    setDiag("lastSend", `startup_error: ${toError(err)}`);
    setStatus(`Error: ${toError(err)}`);
  }
}

function stop() {
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  resetFistState();
  resetPointerState();
  resetPinchState();
  frameCount = 0;
  setStatus("Stopped");
  setEvent("No gesture yet");
  setDiag("camera", "stopped");
  setDiag("hand", "none");
  setDiag("frames", "0");

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  videoEl.srcObject = null;
  overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);

  if (pointerVisible) {
    pointerVisible = false;
    void sendPointerVisibility(false);
  }
}

function tick() {
  if (!running || !handLandmarker) return;

  const now = performance.now();
  const results = handLandmarker.detectForVideo(videoEl, now);
  frameCount += 1;
  if (frameCount % 15 === 0) setDiag("frames", String(frameCount));
  overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);
  drawLandmarks(results?.landmarks?.[0]);

  const hand = results?.landmarks?.[0];
  if (!hand) {
    resetFistState();
    resetPinchState();
    hidePointer();
    setDiag("hand", "none");
    requestAnimationFrame(tick);
    return;
  }

  const pointer = updatePointerFromHand(hand, now);
  updatePinchAndClick(hand, pointer, now);

  const palmY = getPalmCenterY(hand);
  smoothedPalmY = smoothedPalmY == null ? palmY : smoothedPalmY * 0.72 + palmY * 0.28;

  if (!isFist(hand)) {
    resetFistState();
    setDiag("hand", pinchingLogical ? "pinch" : "open_or_partial");
    requestAnimationFrame(tick);
    return;
  }

  setDiag("hand", `fist(hold=${fistCount + 1})`);
  fistCount += 1;
  if (fistCount >= FIST_HOLD_FRAMES && lastPalmY != null && smoothedPalmY != null) {
    const dy = smoothedPalmY - lastPalmY;
    const inCooldown = lastEmitAt >= 0 && now - lastEmitAt < SCROLL_INTERVAL_MS;
    if (!inCooldown && Math.abs(dy) >= SCROLL_DEADZONE) {
      const direction = dy > 0 ? "down" : "up";
      const amount = Math.min(1, Math.abs(dy) * 26);
      lastEmitAt = now;
      setEvent(`Fist ${direction} (${amount.toFixed(3)})`);
      setDiag("hand", `fist_scroll_${direction}`);
      void sendScroll(direction, amount);
    }
  }

  lastPalmY = smoothedPalmY;
  requestAnimationFrame(tick);
}

function drawLandmarks(landmarks) {
  if (!landmarks) return;
  drawer.drawLandmarks(landmarks, { radius: 2.2, color: "#b6e7ff", fillColor: "#7ad5ff" });
}

function updatePointerFromHand(hand, now) {
  const tip = hand[IDX.INDEX_TIP];
  if (!tip) return null;

  const rawX = clamp01(1 - tip.x);
  const rawY = clamp01(tip.y);

  smoothedPointerX = smoothedPointerX == null ? rawX : smoothedPointerX * (1 - POINTER_SMOOTHING) + rawX * POINTER_SMOOTHING;
  smoothedPointerY = smoothedPointerY == null ? rawY : smoothedPointerY * (1 - POINTER_SMOOTHING) + rawY * POINTER_SMOOTHING;

  if (!pointerVisible) {
    pointerVisible = true;
    void sendPointerVisibility(true);
  }

  const x = smoothedPointerX;
  const y = smoothedPointerY;
  const canSendByTime = lastPointerSentAt < 0 || now - lastPointerSentAt >= POINTER_SEND_INTERVAL_MS;
  const movedEnough =
    lastPointerSentX == null ||
    lastPointerSentY == null ||
    Math.abs(x - lastPointerSentX) + Math.abs(y - lastPointerSentY) >= POINTER_MIN_DELTA;

  if (canSendByTime && movedEnough) {
    lastPointerSentAt = now;
    lastPointerSentX = x;
    lastPointerSentY = y;
    setDiag("pointer", `${x.toFixed(3)},${y.toFixed(3)}`);
    void sendPointerMove(x, y);
  }

  return { x, y };
}

function updatePinchAndClick(hand, pointer, now) {
  const pinchDistance = getPinchDistance(hand);
  if (pinchDistance == null) {
    resetPinchState();
    return;
  }

  if (!pinchingLogical) {
    pinchUpCount = 0;
    if (pinchDistance < PINCH_THRESHOLD_DOWN) {
      pinchDownCount += 1;
      if (pinchDownCount >= PINCH_DOWN_FRAMES) {
        pinchingLogical = true;
        pinchDownCount = 0;
        setDiag("pinch", "closed");

        if (pointer && (lastClickAt < 0 || now - lastClickAt >= CLICK_COOLDOWN_MS)) {
          lastClickAt = now;
          setEvent("Pinch click");
          void sendPointerClick(pointer.x, pointer.y);
        }
      }
    } else {
      pinchDownCount = 0;
      setDiag("pinch", "open");
    }
    return;
  }

  pinchDownCount = 0;
  if (pinchDistance > PINCH_THRESHOLD_UP) {
    pinchUpCount += 1;
    if (pinchUpCount >= PINCH_UP_FRAMES) {
      pinchingLogical = false;
      pinchUpCount = 0;
      setDiag("pinch", "open");
    }
  } else {
    pinchUpCount = 0;
    setDiag("pinch", "closed");
  }
}

function getPalmCenterY(landmarks) {
  return (landmarks[IDX.WRIST].y + landmarks[IDX.MIDDLE_MCP].y) / 2;
}

function getPinchDistance(landmarks) {
  const thumb = landmarks[IDX.THUMB_TIP];
  const index = landmarks[IDX.INDEX_TIP];
  if (!thumb || !index) return null;
  const dx = thumb.x - index.x;
  const dy = thumb.y - index.y;
  return Math.hypot(dx, dy);
}

function isFist(landmarks) {
  const slack = 0.02;
  return (
    landmarks[IDX.INDEX_TIP].y - slack > landmarks[IDX.INDEX_PIP].y &&
    landmarks[IDX.MIDDLE_TIP].y - slack > landmarks[IDX.MIDDLE_PIP].y &&
    landmarks[IDX.RING_TIP].y - slack > landmarks[IDX.RING_PIP].y &&
    landmarks[IDX.PINKY_TIP].y - slack > landmarks[IDX.PINKY_PIP].y
  );
}

function resetFistState() {
  fistCount = 0;
  lastPalmY = null;
  smoothedPalmY = null;
  lastEmitAt = -1;
}

function resetPointerState() {
  smoothedPointerX = null;
  smoothedPointerY = null;
  lastPointerSentAt = -1;
  lastPointerSentX = null;
  lastPointerSentY = null;
  setDiag("pointer", "hidden");
}

function resetPinchState() {
  pinchingLogical = false;
  pinchDownCount = 0;
  pinchUpCount = 0;
  setDiag("pinch", "open");
}

function hidePointer() {
  resetPointerState();
  if (!pointerVisible) return;
  pointerVisible = false;
  void sendPointerVisibility(false);
}

async function sendScroll(direction, amount) {
  try {
    const target = await ensureTargetTab();
    if (!target?.id) {
      setStatus("No target tab");
      setDiag("activeTab", "none");
      setDiag("lastSend", "failed: no_target_tab");
      return;
    }

    if (isRestrictedTabUrl(target.url)) {
      setStatus("Cannot control this tab");
      setDiag("lastSend", "failed: restricted_tab");
      return;
    }

    await sendControlMessage(target.id, {
      type: "AIRPRESENTER_FIST_SCROLL",
      direction,
      amount,
    });
    setStatus(`Sent scroll ${direction}`);
    setDiag("lastSend", `ok_scroll:${direction}:${amount.toFixed(3)}`);
  } catch (err) {
    setStatus(`Send failed: ${toError(err)}`);
    setDiag("lastSend", `failed: ${toError(err)}`);
  }
}

async function sendPointerMove(x, y) {
  try {
    const target = await ensureTargetTab();
    if (!target?.id || isRestrictedTabUrl(target.url)) return;

    await sendControlMessage(target.id, {
      type: "AIRPRESENTER_POINTER_MOVE",
      x,
      y,
    });
  } catch {
    // Pointer move is high-frequency; avoid noisy status churn on transient errors.
  }
}

async function sendPointerVisibility(visible) {
  try {
    const target = await ensureTargetTab();
    if (!target?.id || isRestrictedTabUrl(target.url)) return;

    await sendControlMessage(target.id, {
      type: "AIRPRESENTER_POINTER_VISIBILITY",
      visible,
    });
  } catch {
    // Keep UI stable on transient pointer channel errors.
  }
}

async function sendPointerClick(x, y) {
  try {
    const target = await ensureTargetTab();
    if (!target?.id) return;

    if (isRestrictedTabUrl(target.url)) {
      setStatus("Cannot click on this tab");
      setDiag("lastSend", "failed: restricted_tab");
      return;
    }

    await sendControlMessage(target.id, {
      type: "AIRPRESENTER_POINTER_CLICK",
      x,
      y,
    });
    setDiag("lastSend", `ok_click:${x.toFixed(3)},${y.toFixed(3)}`);
  } catch (err) {
    setDiag("lastSend", `failed_click: ${toError(err)}`);
  }
}

async function ensureTargetTab(forceRefresh = false) {
  if (!forceRefresh && cachedTargetTabId != null) {
    return { id: cachedTargetTabId, url: cachedTargetTabUrl };
  }

  const resolved = await resolveTargetTab();
  if (!resolved.tab?.id) {
    cachedTargetTabId = null;
    cachedTargetTabUrl = null;
    return null;
  }

  cachedTargetTabId = resolved.tab.id;
  cachedTargetTabUrl = resolved.tab.url ?? null;
  setDiag("activeTab", cachedTargetTabUrl ?? `id:${cachedTargetTabId}`);
  return { id: cachedTargetTabId, url: cachedTargetTabUrl };
}

async function resolveTargetTab() {
  if (targetTabIdFromLaunch != null) {
    try {
      const tab = await chrome.tabs.get(targetTabIdFromLaunch);
      return { tab, reason: null };
    } catch {
      return { tab: null, reason: "target_tab_missing" };
    }
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return { tab: tabs[0] ?? null, reason: null };
}

async function sendControlMessage(tabId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, payload);
    return;
  } catch (err) {
    if (!isMissingReceiverError(err)) {
      if (isNoSuchTabError(err)) {
        cachedTargetTabId = null;
        cachedTargetTabUrl = null;
      }
      throw err;
    }
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });

  await chrome.tabs.sendMessage(tabId, payload);
}

function isMissingReceiverError(err) {
  const message = toError(err);
  return (
    message.includes("Receiving end does not exist") ||
    message.includes("Could not establish connection")
  );
}

function isNoSuchTabError(err) {
  const message = toError(err);
  return message.includes("No tab with id") || message.includes("Tabs cannot be edited right now");
}

function isRestrictedTabUrl(url) {
  return (
    url?.startsWith("chrome://") ||
    url?.startsWith("chrome-extension://") ||
    url?.startsWith("edge://") ||
    url?.startsWith(CONTROLLER_PAGE_URL)
  );
}

function parseTargetTabId(urlString) {
  try {
    const url = new URL(urlString);
    const raw = url.searchParams.get("targetTabId");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function getEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setEvent(text) {
  eventEl.textContent = text;
}

function setDiag(key, value) {
  diagnostics[key] = value;
  renderDiagnostics();
}

function renderDiagnostics() {
  diagEl.textContent =
    `model: ${diagnostics.model}\n` +
    `camera: ${diagnostics.camera}\n` +
    `hand: ${diagnostics.hand}\n` +
    `active_tab: ${diagnostics.activeTab}\n` +
    `last_send: ${diagnostics.lastSend}\n` +
    `pointer: ${diagnostics.pointer}\n` +
    `pinch: ${diagnostics.pinch}\n` +
    `frames: ${diagnostics.frames}`;
}

function toError(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}
