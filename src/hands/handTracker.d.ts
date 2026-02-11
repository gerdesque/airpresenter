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
