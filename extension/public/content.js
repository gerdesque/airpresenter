(() => {
  if (window.__airPresenterFistScrollInstalled) return;
  window.__airPresenterFistScrollInstalled = true;

  const CURSOR_ID = "airpresenter-gesture-cursor";
  const CURSOR_SIZE = 20;

  let cursorEl = null;
  let cursorVisible = false;
  let lastClientX = Math.round(window.innerWidth * 0.5);
  let lastClientY = Math.round(window.innerHeight * 0.5);

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "AIRPRESENTER_FIST_SCROLL") {
      handleScroll(msg);
      return;
    }

    if (msg.type === "AIRPRESENTER_POINTER_MOVE") {
      handlePointerMove(msg);
      return;
    }

    if (msg.type === "AIRPRESENTER_POINTER_VISIBILITY") {
      setCursorVisible(Boolean(msg.visible));
      return;
    }

    if (msg.type === "AIRPRESENTER_POINTER_CLICK") {
      handlePointerClick(msg);
    }
  });

  function handleScroll(msg) {
    const direction = msg.direction === "up" ? -1 : 1;
    const strength = Number(msg.amount ?? 0.05);
    const normalized = Math.min(1, Math.max(0, strength));
    const baseStep = Math.max(6, Math.floor(window.innerHeight * 0.015));
    const scale = 0.6 + normalized * 2.2;
    const deltaY = Math.round(baseStep * scale) * direction;

    window.scrollBy(0, deltaY);
  }

  function handlePointerMove(msg) {
    const x = clamp01(Number(msg.x));
    const y = clamp01(Number(msg.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const clientX = Math.round(x * window.innerWidth);
    const clientY = Math.round(y * window.innerHeight);
    moveCursor(clientX, clientY);
    setCursorVisible(true);
  }

  function handlePointerClick(msg) {
    const x = clamp01(Number(msg.x));
    const y = clamp01(Number(msg.y));
    if (Number.isFinite(x) && Number.isFinite(y)) {
      moveCursor(Math.round(x * window.innerWidth), Math.round(y * window.innerHeight));
    }
    setCursorVisible(true);
    dispatchSyntheticClick(lastClientX, lastClientY);
  }

  function moveCursor(clientX, clientY) {
    lastClientX = Math.min(window.innerWidth - 1, Math.max(0, clientX));
    lastClientY = Math.min(window.innerHeight - 1, Math.max(0, clientY));

    const el = ensureCursor();
    el.style.transform = `translate(${lastClientX}px, ${lastClientY}px) translate(-50%, -50%)`;
  }

  function setCursorVisible(visible) {
    const el = ensureCursor();
    cursorVisible = visible;
    el.style.opacity = cursorVisible ? "1" : "0";
  }

  function ensureCursor() {
    if (cursorEl && cursorEl.isConnected) return cursorEl;

    cursorEl = document.createElement("div");
    cursorEl.id = CURSOR_ID;
    cursorEl.setAttribute("aria-hidden", "true");
    Object.assign(cursorEl.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      width: `${CURSOR_SIZE}px`,
      height: `${CURSOR_SIZE}px`,
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.92)",
      background: "rgba(72, 214, 255, 0.28)",
      boxShadow: "0 0 0 2px rgba(4, 16, 20, 0.35), 0 0 18px rgba(72,214,255,0.65)",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      zIndex: "2147483647",
      opacity: "0",
      transition: "transform 24ms linear, opacity 100ms ease",
      backdropFilter: "blur(1px)",
    });

    const host = document.documentElement || document.body;
    host.appendChild(cursorEl);
    return cursorEl;
  }

  function dispatchSyntheticClick(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    if (!target || target === cursorEl) return;

    const pointerInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      view: window,
    };

    const mouseInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
      view: window,
    };

    if (typeof PointerEvent === "function") {
      target.dispatchEvent(new PointerEvent("pointerdown", pointerInit));
    }
    target.dispatchEvent(new MouseEvent("mousedown", mouseInit));

    if (typeof PointerEvent === "function") {
      target.dispatchEvent(new PointerEvent("pointerup", pointerInit));
    }
    target.dispatchEvent(new MouseEvent("mouseup", mouseInit));
    target.dispatchEvent(new MouseEvent("click", mouseInit));

    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
    }
  }

  function clamp01(value) {
    if (!Number.isFinite(value)) return NaN;
    return Math.min(1, Math.max(0, value));
  }
})();
