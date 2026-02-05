declare module "./shared/settings.js" {
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
}

declare module "./pdf/pointerOverlay.js" {
  export type PointerOverlay = {
    start: () => void;
    setActive: (active: boolean) => void;
    setTargetNorm: (x: number, y: number) => void;
    setSizeLike: (el: HTMLCanvasElement) => void;
    clear: () => void;
  };

  export type PointerOverlayOptions = {
    canvasEl: HTMLCanvasElement;
    radiusPx?: number;
    smoothing?: number;
  };

  export function createPointerOverlay(
    options: PointerOverlayOptions,
  ): PointerOverlay;
}

declare module "./pdf/pdfViewer.js" {
  export type PdfState = {
    loaded: boolean;
    pageNum: number;
    pageCount: number;
  };

  export type PdfViewer = {
    loadFromFile: (file: File) => Promise<void>;
    next: () => Promise<void> | void;
    prev: () => Promise<void> | void;
    goTo: (page: number) => Promise<void> | void;
    getState: () => PdfState;
  };

  export type PdfViewerOptions = {
    canvasEl: HTMLCanvasElement;
    onState?: (state: PdfState) => void;
  };

  export function createPdfViewer(options: PdfViewerOptions): PdfViewer;
}

declare module "./hands/handTracker.js" {
  export type HandLandmark = {
    x: number;
    y: number;
    z?: number;
  };

  export type Hand = {
    landmarks: HandLandmark[];
    handedness?: string;
  };

  export type HandFrame = {
    hands: Hand[];
    timestampMs: number;
    width: number;
    height: number;
  };

  export type HandTrackerConfig = {
    wasmBaseUrl?: string;
    modelAssetPath?: string;
    maxHands?: number;
  };

  export type HandTrackerOptions = {
    videoEl: HTMLVideoElement;
    canvasEl: HTMLCanvasElement;
    onFrame?: (frame: HandFrame) => void;
    onStatus?: (status: string) => void;
    config?: HandTrackerConfig;
  };

  export type HandTracker = {
    start: () => Promise<void> | void;
    stop: () => void;
  };

  export function createHandTracker(
    options: HandTrackerOptions,
  ): Promise<HandTracker>;
}

declare module "./gestures/gestureEngine.js" {
  import type { HandFrame } from "./hands/handTracker.js";

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
}
