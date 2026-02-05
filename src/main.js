import "./app.css";
import { DEFAULTS } from "./shared/settings.js";
import { createHandTracker } from "./hands/handTracker.js";
import { createGestureEngine } from "./gestures/gestureEngine.js";
import { createPdfViewer } from "./pdf/pdfViewer.js";
import { createPointerOverlay } from "./pdf/pointerOverlay.js";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="stage">
    <div class="viewer">
      <canvas id="pdfCanvas"></canvas>
      <canvas id="pointerCanvas"></canvas>
    </div>

    <div class="topbar">
      <div class="brand">
        <button class="iconBtn" id="settingsBtn" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" stroke-width="1.8"/>
            <path d="M19.4 12a7.7 7.7 0 0 0-.1-1.2l2-1.6-1.9-3.3-2.5 1a7.8 7.8 0 0 0-2.1-1.2l-.4-2.7H9.6l-.4 2.7c-.7.3-1.4.7-2.1 1.2l-2.5-1-1.9 3.3 2 1.6A7.7 7.7 0 0 0 4.6 12c0 .4 0 .8.1 1.2l-2 1.6 1.9 3.3 2.5-1c.7.5 1.4.9 2.1 1.2l.4 2.7h4.8l.4-2.7c.7-.3 1.4-.7 2.1-1.2l2.5 1 1.9-3.3-2-1.6c.1-.4.1-1.2.1-1.2Z" stroke="currentColor" stroke-width="1.2" opacity="0.9"/>
          </svg>
        </button>
        <div>
          <div class="brandTitle">AirPresenter</div>
          <div class="small" style="color:rgba(255,255,255,0.68);font-size:12px;">
            Tap=Next · DoubleTap=Prev · Hold+Drag=Pointer
          </div>
        </div>
      </div>

      <div class="pill" id="pagePill">No PDF loaded</div>
      <div class="pill" id="statusPill">Init…</div>
    </div>

    <div class="drawer" id="drawer" aria-label="Settings panel">
      <h3>Settings</h3>
      <div class="row">
        <input id="file" type="file" accept="application/pdf" />
        <button id="prev" disabled>Prev</button>
        <button id="next" disabled>Next</button>
      </div>

      <div style="margin-top:10px;color:rgba(255,255,255,0.62);font-size:12px;">
        Keyboard fallback: <kbd>→</kbd> / <kbd>←</kbd> / <kbd>Space</kbd>
      </div>

      <hr/>

      <h3>Gesture Tuning (Presenter-safe)</h3>

      <div class="kv">
        <label for="pinchDown">pinchDown</label>
        <input id="pinchDown" type="range" min="0.020" max="0.060" step="0.001" />
        <div class="v" id="pinchDownV"></div>
      </div>

      <div class="kv">
        <label for="pinchUp">pinchUp</label>
        <input id="pinchUp" type="range" min="0.030" max="0.090" step="0.001" />
        <div class="v" id="pinchUpV"></div>
      </div>

      <div class="kv">
        <label for="hold">holdMs</label>
        <input id="hold" type="range" min="180" max="520" step="10" />
        <div class="v" id="holdV"></div>
      </div>

      <div class="kv">
        <label for="cooldown">tapCooldown</label>
        <input id="cooldown" type="range" min="200" max="900" step="10" />
        <div class="v" id="cooldownV"></div>
      </div>

      <div class="kv">
        <label for="deadzone">dragDeadzone</label>
        <input id="deadzone" type="range" min="0.002" max="0.020" step="0.001" />
        <div class="v" id="deadzoneV"></div>
      </div>

      <div class="debug" id="debug"></div>
    </div>

    <div class="hint" id="hint">
      <h2>Enable the camera and make yourself visible</h2>
      <p>Open Settings, load a PDF. Then: pinch-tap to advance, double-tap to go back, pinch-hold and move to use the pointer.</p>
    </div>

    <div class="pip" aria-label="Camera preview">
      <video id="video" playsinline muted></video>
      <canvas id="handsCanvas"></canvas>
      <div class="pipLabel">Handtracking</div>
    </div>
  </div>
`;

const statusPill = document.querySelector("#statusPill");
const pagePill = document.querySelector("#pagePill");
const hintEl = document.querySelector("#hint");

const pdfCanvasEl = document.querySelector("#pdfCanvas");
const pointerCanvasEl = document.querySelector("#pointerCanvas");

const videoEl = document.querySelector("#video");
const handsCanvasEl = document.querySelector("#handsCanvas");

const drawer = document.querySelector("#drawer");
const settingsBtn = document.querySelector("#settingsBtn");

const fileEl = document.querySelector("#file");
const prevBtn = document.querySelector("#prev");
const nextBtn = document.querySelector("#next");
const debugEl = document.querySelector("#debug");

settingsBtn.addEventListener("click", () => drawer.classList.toggle("open"));
window.addEventListener("keydown", (e) => { if (e.key === "Escape") drawer.classList.remove("open"); });

// PDF viewer + pointer
const pdf = createPdfViewer({
  canvasEl: pdfCanvasEl,
  onState: (s) => {
    if (!s.loaded) {
      pagePill.textContent = "No PDF loaded";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      hintEl.style.display = "block";
      return;
    }
    pagePill.textContent = `Page ${s.pageNum} / ${s.pageCount}`;
    prevBtn.disabled = s.pageNum <= 1;
    nextBtn.disabled = s.pageNum >= s.pageCount;
    hintEl.style.display = "none";
    pointer.setSizeLike(pdfCanvasEl);
  },
});

const pointer = createPointerOverlay({
  canvasEl: pointerCanvasEl,
  radiusPx: DEFAULTS.pointerRadiusPx,
  smoothing: DEFAULTS.pointerSmoothing,
});
pointer.start();

prevBtn.addEventListener("click", () => pdf.prev());
nextBtn.addEventListener("click", () => pdf.next());
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " ") pdf.next();
  if (e.key === "ArrowLeft") pdf.prev();
});

fileEl.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf") return alert("Bitte eine PDF wählen.");
  statusPill.textContent = "Loading PDF…";
  await pdf.loadFromFile(file);
  statusPill.textContent = "Ready";
});

// Tuning UI
const tuning = {
  pinchThresholdDown: DEFAULTS.pinchThresholdDown,
  pinchThresholdUp: DEFAULTS.pinchThresholdUp,
  pinchDownFrames: DEFAULTS.pinchDownFrames,
  pinchUpFrames: DEFAULTS.pinchUpFrames,
  holdMs: DEFAULTS.holdMs,
  dragDeadzone: DEFAULTS.dragDeadzone,
  doubleTapWindowMs: DEFAULTS.doubleTapWindowMs,
  tapCooldownMs: DEFAULTS.tapCooldownMs,
  maxTapDurationMs: DEFAULTS.maxTapDurationMs,
};

const pinchDownEl = document.querySelector("#pinchDown");
const pinchUpEl = document.querySelector("#pinchUp");
const holdEl = document.querySelector("#hold");
const cooldownEl = document.querySelector("#cooldown");
const deadzoneEl = document.querySelector("#deadzone");

const pinchDownV = document.querySelector("#pinchDownV");
const pinchUpV = document.querySelector("#pinchUpV");
const holdV = document.querySelector("#holdV");
const cooldownV = document.querySelector("#cooldownV");
const deadzoneV = document.querySelector("#deadzoneV");

function syncUI() {
  pinchDownEl.value = String(tuning.pinchThresholdDown);
  pinchUpEl.value = String(tuning.pinchThresholdUp);
  holdEl.value = String(tuning.holdMs);
  cooldownEl.value = String(tuning.tapCooldownMs);
  deadzoneEl.value = String(tuning.dragDeadzone);

  pinchDownV.textContent = tuning.pinchThresholdDown.toFixed(3);
  pinchUpV.textContent = tuning.pinchThresholdUp.toFixed(3);
  holdV.textContent = String(tuning.holdMs);
  cooldownV.textContent = String(tuning.tapCooldownMs);
  deadzoneV.textContent = tuning.dragDeadzone.toFixed(3);
}
syncUI();

// Gesture engine + mapping
const gestures = createGestureEngine({
  ...tuning,
  onEvent: async (evt) => {
    debugEl.textContent = JSON.stringify(evt, null, 2);

    const st = pdf.getState();
    const loaded = st.loaded;

    switch (evt.type) {
      case "tap":
        if (loaded) await pdf.next();
        break;
      case "double_tap":
        if (loaded) await pdf.prev();
        break;
      case "hold_start":
        pointer.setActive(true);
        break;
      case "hold_end":
      case "hand_lost":
        pointer.setActive(false);
        break;
      case "drag":
      case "holding":
        if (evt.x != null && evt.y != null) pointer.setTargetNorm(evt.x, evt.y);
        break;
    }
  },
});

function attach(slider, key, cast) {
  slider.addEventListener("input", () => {
    tuning[key] = cast(slider.value);

    // keep pinchUp >= pinchDown + margin
    const margin = 0.008;
    if (tuning.pinchThresholdUp < tuning.pinchThresholdDown + margin) {
      tuning.pinchThresholdUp = Math.min(0.09, tuning.pinchThresholdDown + margin);
    }

    syncUI();
    gestures.setConfig(tuning);
  });
}

attach(pinchDownEl, "pinchThresholdDown", Number);
attach(pinchUpEl, "pinchThresholdUp", Number);
attach(holdEl, "holdMs", Number);
attach(cooldownEl, "tapCooldownMs", Number);
attach(deadzoneEl, "dragDeadzone", Number);

// Hand tracker
const tracker = await createHandTracker({
  videoEl,
  canvasEl: handsCanvasEl,
  onFrame: (frame) => gestures.update(frame),
  onStatus: (txt) => (statusPill.textContent = txt),
});
tracker.start();
