const IDX = {
  THUMB_TIP: 4,
  INDEX_TIP: 8,
};

/**
 * GestureEngine: webcam-friendly, presenter-safe
 * - Pinch with hysteresis (down/up thresholds) to avoid flicker
 * - Require stable frames for pinch down/up
 * - Tap is delayed until the double-tap window expires (fixes single-then-double issue)
 * - Cooldown prevents accidental rapid taps
 */
export function createGestureEngine({
  pinchThresholdDown = 0.034,
  pinchThresholdUp = 0.050,
  pinchDownFrames = 3,
  pinchUpFrames = 2,

  holdMs = 340,
  dragDeadzone = 0.005,

  doubleTapWindowMs = 320,
  tapCooldownMs = 450,
  maxTapDurationMs = 220,

  onEvent,
} = {}) {
  let cfg = {
    pinchThresholdDown,
    pinchThresholdUp,
    pinchDownFrames,
    pinchUpFrames,
    holdMs,
    dragDeadzone,
    doubleTapWindowMs,
    tapCooldownMs,
    maxTapDurationMs,
  };

  let state = {
    phase: "IDLE", // IDLE | PINCHING | HOLDING
    pinchStartMs: 0,
    lastPos: null,

    // stability / hysteresis
    downCount: 0,
    upCount: 0,
    pinchingLogical: false,

    // tap handling
    tapTimer: null,
    lastTapAt: -1,
    pendingTapAt: -1,
    lastTapDuration: 0,
  };

  function emit(type, payload = {}) {
    onEvent?.({ type, t: Date.now(), ...payload });
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function pickHand(hands) {
    return hands?.[0] ?? null;
  }

  function getPinchDistance(hand) {
    const lm = hand.landmarks;
    return dist(lm[IDX.THUMB_TIP], lm[IDX.INDEX_TIP]);
  }

  function getCursorPos(hand) {
    const lm = hand.landmarks;
    const a = lm[IDX.THUMB_TIP];
    const b = lm[IDX.INDEX_TIP];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function clearTapTimer() {
    if (state.tapTimer) {
      clearTimeout(state.tapTimer);
      state.tapTimer = null;
    }
  }

  function commitSingleTap() {
    emit("tap", { durationMs: state.lastTapDuration });
    state.pendingTapAt = -1;
    state.tapTimer = null;
  }

  function registerTap(tapDurationMs) {
    const now = performance.now();

    if (tapDurationMs > cfg.maxTapDurationMs) {
      emit("tap_rejected", { reason: "too_long", durationMs: tapDurationMs });
      return;
    }

    if (state.lastTapAt > 0 && now - state.lastTapAt < cfg.tapCooldownMs) {
      emit("tap_rejected", { reason: "cooldown" });
      return;
    }

    // second tap inside window => double tap
    if (state.pendingTapAt > 0 && now - state.pendingTapAt <= cfg.doubleTapWindowMs) {
      clearTapTimer();
      state.pendingTapAt = -1;
      state.lastTapAt = now;
      state.lastTapDuration = tapDurationMs;
      emit("double_tap", { durationMs: tapDurationMs });
      return;
    }

    // first tap => pending
    clearTapTimer();
    state.pendingTapAt = now;
    state.lastTapDuration = tapDurationMs;
    state.tapTimer = setTimeout(() => {
      if (state.pendingTapAt > 0) {
        state.lastTapAt = performance.now();
        commitSingleTap();
      }
    }, cfg.doubleTapWindowMs + 10);
  }

  function logicalPinchUpdate(pinchD) {
    if (!state.pinchingLogical) {
      if (pinchD < cfg.pinchThresholdDown) {
        state.downCount += 1;
        if (state.downCount >= cfg.pinchDownFrames) {
          state.pinchingLogical = true;
          state.upCount = 0;
          state.downCount = 0;
          return true;
        }
      } else {
        state.downCount = 0;
      }
      return false;
    } else {
      if (pinchD > cfg.pinchThresholdUp) {
        state.upCount += 1;
        if (state.upCount >= cfg.pinchUpFrames) {
          state.pinchingLogical = false;
          state.upCount = 0;
          state.downCount = 0;
          return false;
        }
      } else {
        state.upCount = 0;
      }
      return true;
    }
  }

  function resetPinchStability() {
    state.pinchingLogical = false;
    state.downCount = 0;
    state.upCount = 0;
    state.lastPos = null;
  }

  function update(frame) {
    const hand = pickHand(frame.hands);
    if (!hand) {
      if (state.phase !== "IDLE") emit("hand_lost", { from: state.phase });
      resetPinchStability();
      clearTapTimer();
      state.pendingTapAt = -1;
      state.lastTapAt = -1;
      state.phase = "IDLE";
      return;
    }

    const pinchD = getPinchDistance(hand);
    const pinching = logicalPinchUpdate(pinchD);
    const pos = getCursorPos(hand);

    if (state.phase === "IDLE") {
      if (pinching) {
        state.phase = "PINCHING";
        state.pinchStartMs = frame.timestampMs;
        state.lastPos = pos;
        emit("pinch_down", { pinchD });
      }
      return;
    }

    if (state.phase === "PINCHING") {
      if (!pinching) {
        const tapDurationMs = Math.max(0, frame.timestampMs - state.pinchStartMs);
        emit("pinch_up", { kind: "tap", pinchD, durationMs: tapDurationMs });
        state.phase = "IDLE";
        state.pinchStartMs = 0;
        state.lastPos = null;
        registerTap(tapDurationMs);
        return;
      }

      const heldFor = frame.timestampMs - state.pinchStartMs;
      if (heldFor >= cfg.holdMs) {
        state.phase = "HOLDING";
        state.lastPos = pos;
        emit("hold_start");
      }
      return;
    }

    if (state.phase === "HOLDING") {
      if (!pinching) {
        emit("hold_end");
        emit("pinch_up", { kind: "release", pinchD });
        resetPinchStability();
        state.phase = "IDLE";
        state.pinchStartMs = 0;
        state.lastPos = null;
        return;
      }

      const dx = pos.x - state.lastPos.x;
      const dy = pos.y - state.lastPos.y;

      if (Math.abs(dx) > cfg.dragDeadzone || Math.abs(dy) > cfg.dragDeadzone) {
        state.lastPos = pos;
        emit("drag", { dx, dy, x: pos.x, y: pos.y });
      } else {
        emit("holding", { x: pos.x, y: pos.y });
      }
    }
  }

  function setConfig(next) {
    cfg = { ...cfg, ...next };
  }

  return { update, setConfig };
}
