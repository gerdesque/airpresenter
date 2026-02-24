export const DEFAULTS = {
  // Presenter-friendly gesture tuning (less sensitive)
  // Hysteresis: down threshold to start pinch, up threshold to release.
  pinchThresholdDown: 0.034,
  pinchThresholdUp: 0.050,

  // Require pinch to be stable for a few frames
  pinchDownFrames: 3,
  pinchUpFrames: 2,

  // Swipe behavior
  swipeCooldownMs: 420,
  swipeWindowMs: 430,
  swipeMinDistance: 0.11,
  swipeMaxVerticalDrift: 0.075,

  // Hold / pointer
  holdMs: 340,
  dragDeadzone: 0.005,

  // Pointer visuals
  pointerRadiusPx: 10,
  pointerSmoothing: 0.22
};
