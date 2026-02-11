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
