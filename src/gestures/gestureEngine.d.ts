import type { HandFrame } from "../hands/handTracker.js";

export type GestureConfig = {
  pinchThresholdDown: number;
  pinchThresholdUp: number;
  pinchDownFrames: number;
  pinchUpFrames: number;
  holdMs: number;
  dragDeadzone: number;
  doubleTapWindowMs: number;
  tapCooldownMs: number;
  maxTapDurationMs: number;
};

export type GestureEvent =
  | { type: "tap"; t: number; durationMs?: number }
  | { type: "double_tap"; t: number; durationMs?: number }
  | { type: "tap_rejected"; t: number; reason: "too_long" | "cooldown"; durationMs?: number }
  | { type: "pinch_down"; t: number; pinchD?: number }
  | { type: "pinch_up"; t: number; kind: "tap" | "release"; pinchD?: number; durationMs?: number }
  | { type: "hold_start"; t: number }
  | { type: "hold_end"; t: number }
  | { type: "hand_lost"; t: number; from?: string }
  | { type: "confetti"; t: number; x?: number; y?: number }
  | { type: "heart"; t: number; x?: number; y?: number }
  | { type: "peace"; t: number; x?: number; y?: number }
  | { type: "rock_on"; t: number; x?: number; y?: number }
  | { type: "drag" | "holding"; t: number; x?: number | null; y?: number | null; dx?: number; dy?: number };

export type GestureEngineOptions = GestureConfig & {
  onEvent?: (event: GestureEvent) => void;
};

export type GestureEngine = {
  update: (frame: HandFrame) => void;
  setConfig: (config: Partial<GestureConfig>) => void;
};

export function createGestureEngine(
  options: GestureEngineOptions,
): GestureEngine;
