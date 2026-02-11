export type Defaults = {
  pinchThresholdDown: number;
  pinchThresholdUp: number;
  pinchDownFrames: number;
  pinchUpFrames: number;
  doubleTapWindowMs: number;
  tapCooldownMs: number;
  maxTapDurationMs: number;
  holdMs: number;
  dragDeadzone: number;
  pointerRadiusPx: number;
  pointerSmoothing: number;
};

export const DEFAULTS: Defaults;
