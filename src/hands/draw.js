// Minimal overlay drawing for Day 1/2/3.
// Keeps dependencies light; you can add connectors later.

export function drawHands({ results, drawingUtils }) {
  const landmarksList = results?.landmarks ?? [];
  for (const landmarks of landmarksList) {
    drawingUtils.drawLandmarks(landmarks, { radius: 2 });
  }
}
