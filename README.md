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

## Privacy
Camera video stays local in the browser. Nothing is uploaded unless you add your own backend or telemetry.

## License
See `LICENSE`.
