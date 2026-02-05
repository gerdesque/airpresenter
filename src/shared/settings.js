export const DEFAULTS = {
  // Presenter-friendly gesture tuning (less sensitive)
  // Hysteresis: down threshold to start pinch, up threshold to release.
  pinchThresholdDown: 0.034,
  pinchThresholdUp: 0.050,

  // Require pinch to be stable for a few frames
  pinchDownFrames: 3,
  pinchUpFrames: 2,

  // Tap behavior
  doubleTapWindowMs: 320,
  tapCooldownMs: 450,
  maxTapDurationMs: 220,

  // Hold / pointer
  holdMs: 340,
  dragDeadzone: 0.005,

  // Pointer visuals
  pointerRadiusPx: 10,
  pointerSmoothing: 0.35
};
