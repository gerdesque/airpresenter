import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function createPdfViewer({ canvasEl, onState } = {}) {
  if (!canvasEl) throw new Error("canvasEl required");
  const ctx = canvasEl.getContext("2d");

  let pdfDoc = null;
  let pageNum = 1;
  let renderTask = null;
  let rendering = false;
  let pendingPage = null;

  async function loadFromFile(file) {
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buf });
    pdfDoc = await loadingTask.promise;
    pageNum = 1;
    onState?.(getState());
    await renderPage(pageNum);
  }

  function getState() {
    return {
      loaded: !!pdfDoc,
      pageNum,
      pageCount: pdfDoc?.numPages ?? 0,
    };
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    if (rendering) {
      pendingPage = num;
      return;
    }
    rendering = true;

    const page = await pdfDoc.getPage(num);

    // Fit-to-canvas: set canvas resolution to match CSS size * devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvasEl.clientWidth || 960;
    const cssH = canvasEl.clientHeight || 540;

    // Compute scale that fits page into viewer area (letterbox)
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(cssW / unscaled.width, cssH / unscaled.height);
    const viewport = page.getViewport({ scale });

    canvasEl.width = Math.floor(viewport.width * dpr);
    canvasEl.height = Math.floor(viewport.height * dpr);

    // Clear and render
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    renderTask = page.render({ canvasContext: ctx, viewport });
    await renderTask.promise;

    rendering = false;
    onState?.(getState());

    if (pendingPage !== null) {
      const next = pendingPage;
      pendingPage = null;
      await renderPage(next);
    }
  }

  async function next() {
    if (!pdfDoc) return;
    if (pageNum >= pdfDoc.numPages) return;
    pageNum += 1;
    onState?.(getState());
    await renderPage(pageNum);
  }

  async function prev() {
    if (!pdfDoc) return;
    if (pageNum <= 1) return;
    pageNum -= 1;
    onState?.(getState());
    await renderPage(pageNum);
  }

  async function goTo(n) {
    if (!pdfDoc) return;
    const clamped = Math.max(1, Math.min(pdfDoc.numPages, n));
    pageNum = clamped;
    onState?.(getState());
    await renderPage(pageNum);
  }

  // Re-render on resize (debounced)
  let resizeT = null;
  window.addEventListener("resize", () => {
    if (!pdfDoc) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => renderPage(pageNum), 120);
  });

  return { loadFromFile, next, prev, goTo, getState };
}
