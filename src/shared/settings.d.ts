export type Defaults = {
  pinchThresholdDown: number;
  pinchThresholdUp: number;
  pinchDownFrames: number;
  pinchUpFrames: number;
  swipeCooldownMs: number;
  swipeWindowMs: number;
  swipeMinDistance: number;
  swipeMaxVerticalDrift: number;
  holdMs: number;
  dragDeadzone: number;
  pointerRadiusPx: number;
  pointerSmoothing: number;
};

export const DEFAULTS: Defaults;
