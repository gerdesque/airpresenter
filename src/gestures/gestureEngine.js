const IDX = {
  THUMB_TIP: 4,
  INDEX_TIP: 8,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
  INDEX_PIP: 6,
  MIDDLE_PIP: 10,
  RING_PIP: 14,
  PINKY_PIP: 18,
  WRIST: 0,
  MIDDLE_MCP: 9,
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

  // fun gesture tuning
  funGestureCooldownMs = 1400,
  fingerExtendSlack = 0.02,
  openPalmMinSpread = 0.18,
  confettiHoldFrames = 7,
  heartHoldFrames = 7,
  peaceHoldFrames = 6,
  rockHoldFrames = 6,
  heartIndexDist = 0.08,
  heartThumbDist = 0.10,
  heartMinPinch = 0.06,

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

    funGestureCooldownMs,
    fingerExtendSlack,
    openPalmMinSpread,
    confettiHoldFrames,
    heartHoldFrames,
    peaceHoldFrames,
    rockHoldFrames,
    heartIndexDist,
    heartThumbDist,
    heartMinPinch,
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

    // fun gesture cooldowns + stability
    confettiCount: 0,
    heartCount: 0,
    peaceCount: 0,
    rockCount: 0,
    lastFunAt: {
      confetti: -1,
      heart: -1,
      peace: -1,
      rock_on: -1,
    },
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

  function getPalmCenter(hand) {
    const lm = hand.landmarks;
    const a = lm[IDX.WRIST];
    const b = lm[IDX.MIDDLE_MCP];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function isFingerExtended(lm, tip, pip) {
    return lm[tip].y + cfg.fingerExtendSlack < lm[pip].y;
  }

  function isFingerFolded(lm, tip, pip) {
    return lm[tip].y - cfg.fingerExtendSlack > lm[pip].y;
  }

  function isOpenPalm(hand, pinchD) {
    const lm = hand.landmarks;
    if (pinchD < cfg.pinchThresholdUp) return false;
    const indexExt = isFingerExtended(lm, IDX.INDEX_TIP, IDX.INDEX_PIP);
    const middleExt = isFingerExtended(lm, IDX.MIDDLE_TIP, IDX.MIDDLE_PIP);
    const ringExt = isFingerExtended(lm, IDX.RING_TIP, IDX.RING_PIP);
    const pinkyExt = isFingerExtended(lm, IDX.PINKY_TIP, IDX.PINKY_PIP);
    if (!(indexExt && middleExt && ringExt && pinkyExt)) return false;
    const spread = dist(lm[IDX.INDEX_TIP], lm[IDX.PINKY_TIP]);
    return spread >= cfg.openPalmMinSpread;
  }

  function isPeace(hand) {
    const lm = hand.landmarks;
    const indexExt = isFingerExtended(lm, IDX.INDEX_TIP, IDX.INDEX_PIP);
    const middleExt = isFingerExtended(lm, IDX.MIDDLE_TIP, IDX.MIDDLE_PIP);
    const ringFold = isFingerFolded(lm, IDX.RING_TIP, IDX.RING_PIP);
    const pinkyFold = isFingerFolded(lm, IDX.PINKY_TIP, IDX.PINKY_PIP);
    return indexExt && middleExt && ringFold && pinkyFold;
  }

  function isRockOn(hand) {
    const lm = hand.landmarks;
    const indexExt = isFingerExtended(lm, IDX.INDEX_TIP, IDX.INDEX_PIP);
    const pinkyExt = isFingerExtended(lm, IDX.PINKY_TIP, IDX.PINKY_PIP);
    const middleFold = isFingerFolded(lm, IDX.MIDDLE_TIP, IDX.MIDDLE_PIP);
    const ringFold = isFingerFolded(lm, IDX.RING_TIP, IDX.RING_PIP);
    return indexExt && pinkyExt && middleFold && ringFold;
  }

  function isHeart(h1, h2) {
    const a = h1.landmarks;
    const b = h2.landmarks;
    const indexGap = dist(a[IDX.INDEX_TIP], b[IDX.INDEX_TIP]);
    const thumbGap = dist(a[IDX.THUMB_TIP], b[IDX.THUMB_TIP]);
    const pinchA = dist(a[IDX.THUMB_TIP], a[IDX.INDEX_TIP]);
    const pinchB = dist(b[IDX.THUMB_TIP], b[IDX.INDEX_TIP]);
    return (
      indexGap <= cfg.heartIndexDist &&
      thumbGap <= cfg.heartThumbDist &&
      pinchA >= cfg.heartMinPinch &&
      pinchB >= cfg.heartMinPinch
    );
  }

  function clearFunCounts() {
    state.confettiCount = 0;
    state.heartCount = 0;
    state.peaceCount = 0;
    state.rockCount = 0;
  }

  function funCooldownOk(type, now) {
    const lastAt = state.lastFunAt[type] ?? -1;
    return lastAt < 0 || now - lastAt >= cfg.funGestureCooldownMs;
  }

  function tryEmitFun(type, now, count, needed, payload = {}) {
    if (count < needed) return false;
    if (!funCooldownOk(type, now)) return false;
    state.lastFunAt[type] = now;
    emit(type, payload);
    clearFunCounts();
    return true;
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
      clearFunCounts();
      state.phase = "IDLE";
      return;
    }

    const pinchD = getPinchDistance(hand);
    const pinching = logicalPinchUpdate(pinchD);
    const pos = getCursorPos(hand);
    const now = performance.now();

    if (state.phase === "IDLE" && !pinching) {
      const palmPos = getPalmCenter(hand);
      if (isOpenPalm(hand, pinchD)) {
        state.confettiCount += 1;
        tryEmitFun("confetti", now, state.confettiCount, cfg.confettiHoldFrames, {
          x: palmPos.x,
          y: palmPos.y,
        });
      } else {
        state.confettiCount = 0;
      }

      if (isPeace(hand)) {
        state.peaceCount += 1;
        tryEmitFun("peace", now, state.peaceCount, cfg.peaceHoldFrames, {
          x: palmPos.x,
          y: palmPos.y,
        });
      } else {
        state.peaceCount = 0;
      }

      if (isRockOn(hand)) {
        state.rockCount += 1;
        tryEmitFun("rock_on", now, state.rockCount, cfg.rockHoldFrames, {
          x: palmPos.x,
          y: palmPos.y,
        });
      } else {
        state.rockCount = 0;
      }
    } else {
      state.confettiCount = 0;
      state.peaceCount = 0;
      state.rockCount = 0;
    }

    if (state.phase === "IDLE" && !pinching && frame.hands?.length >= 2) {
      const [h1, h2] = frame.hands;
      if (isHeart(h1, h2)) {
        state.heartCount += 1;
        const a = h1.landmarks[IDX.INDEX_TIP];
        const b = h2.landmarks[IDX.INDEX_TIP];
        const x = (a.x + b.x) / 2;
        const y = (a.y + b.y) / 2;
        tryEmitFun("heart", now, state.heartCount, cfg.heartHoldFrames, { x, y });
      } else {
        state.heartCount = 0;
      }
    } else {
      state.heartCount = 0;
    }

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
