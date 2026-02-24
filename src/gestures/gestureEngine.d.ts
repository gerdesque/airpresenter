import type { HandFrame } from "../hands/handTracker.js";

export type GestureConfig = {
  pinchThresholdDown: number;
  pinchThresholdUp: number;
  pinchDownFrames: number;
  pinchUpFrames: number;
  holdMs: number;
  dragDeadzone: number;
  swipeCooldownMs: number;
  swipeWindowMs: number;
  swipeMinDistance: number;
  swipeMaxVerticalDrift: number;
};

export type GestureEvent =
  | { type: "woosh_left" | "woosh_right"; t: number; durationMs?: number; dx?: number; dy?: number; x?: number; y?: number }
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
