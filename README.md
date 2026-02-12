# AirPresenter

Touchless, browser-based PDF presenter with hand tracking, gesture control, and a laser pointer overlay.

## Features
- Hands-free slide control using MediaPipe hand tracking
- Laser pointer overlay for live highlighting
- Presenter-safe gesture tuning in the UI
- Keyboard fallback for traditional control
- Runs fully in the browser (no backend required)

## Tech Stack
- Vite
- pdfjs-dist
- @mediapipe/tasks-vision

## Quickstart
```bash
npm i
npm run dev
```

## How To Use
1. Start the dev server and open the app in your browser.
2. Allow camera access when prompted.
3. Open Settings and load a PDF file.
4. Use gestures to navigate and point.

## Gesture Reference (MVP)
- Tap (short pinch): next page
- Double tap: previous page
- Pinch-hold + drag: move laser pointer

## Keyboard Fallback
- `ArrowRight` or `Space`: next page
- `ArrowLeft`: previous page

## Configuration
- Default tuning values live in `src/shared/settings.js`.
- The Settings panel exposes live sliders for pinch thresholds, hold time, and drag deadzone.
- Pointer visuals are controlled by `pointerRadiusPx` and `pointerSmoothing`.

## Scripts
- `npm run dev`: start development server
- `npm run build`: typecheck and build
- `npm run preview`: preview production build
- `npm run build:extension`: build Chrome extension to `dist-extension`

## Chrome Extension (URL Fist Scroll)
The repo includes a Manifest V3 extension under `extension/`.

1. Build it:
```bash
npm run build:extension
```
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked` and select `dist-extension`.
5. Click the extension icon, press `Start`, allow camera access, then move a fist up/down to scroll the active tab.

Notes:
- Restricted pages (e.g. `chrome://*`) cannot be controlled.
- This extension scrolls the active tab directly and does not use iframe embedding.
- MediaPipe WASM files are copied locally during `build:extension` to satisfy extension CSP (`script-src 'self'`).

## Branding Variants
- Generate active default icons:
```bash
node scripts/generate-extension-icons.mjs
```
- Generate all icon variants (`beam`, `minimal`, `neon`):
```bash
node scripts/generate-extension-icons.mjs --all
```
- Variant outputs:
  - `extension/public/icons/variants/beam`
  - `extension/public/icons/variants/minimal`
  - `extension/public/icons/variants/neon`

## Privacy
Camera video stays local in the browser. Nothing is uploaded unless you add your own backend or telemetry.

## License
See `LICENSE`.
