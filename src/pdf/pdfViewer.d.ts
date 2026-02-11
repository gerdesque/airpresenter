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
