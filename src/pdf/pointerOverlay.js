export function createPointerOverlay({
  canvasEl,
  radiusPx = 10,
  smoothing = 0.35,
} = {}) {
  if (!canvasEl) throw new Error("pointer canvas required");
  const ctx = canvasEl.getContext("2d");

  let active = false;
  let target = { x: 0.5, y: 0.5 };
  let cur = { x: 0.5, y: 0.5 };

  function setSizeLike(refCanvas) {
    canvasEl.width = refCanvas.width;
    canvasEl.height = refCanvas.height;
  }

  function setActive(v) {
    active = v;
    if (!active) clear();
  }

  function setTargetNorm(x, y) {
    target.x = Math.max(0, Math.min(1, x));
    target.y = Math.max(0, Math.min(1, y));
    console.log(target.x, target.y);
  }

  function clear() {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  function drawLaserDot(x, y) {
    // outer glow (red)
    ctx.beginPath();
    ctx.arc(x, y, radiusPx * 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 0, 0, 0.10)";
    ctx.fill();

    // mid glow
    ctx.beginPath();
    ctx.arc(x, y, radiusPx * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 0, 0, 0.20)";
    ctx.fill();

    // core dot
    ctx.beginPath();
    ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 30, 30, 0.95)";
    ctx.fill();

    // tiny hot center
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, radiusPx * 0.25), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 210, 210, 0.95)";
    ctx.fill();
  }

  function tick() {
    if (!active) {
      // keep loop alive so setActive(true) later works
      clear();
      requestAnimationFrame(tick);
      return;
    }

    // smooth motion
    cur.x = cur.x + (target.x - cur.x) * smoothing;
    cur.y = cur.y + (target.y - cur.y) * smoothing;

    clear();

    const x = cur.x * canvasEl.width;
    const y = cur.y * canvasEl.height;

    drawLaserDot(x, y);
    requestAnimationFrame(tick);
  }


  function start() {
    console.log("start");
    requestAnimationFrame(tick);
  }

  return { setSizeLike, setActive, setTargetNorm, start, clear };
}
