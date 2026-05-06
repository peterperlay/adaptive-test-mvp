// src/engine/cefr.js

export function estimateCEFR(theta) {
  if (theta < -2) return "A1";
  if (theta < -1) return "A2";
  if (theta < 0.5) return "B1";
  if (theta < 1.5) return "B2";
  if (theta < 2.5) return "C1";
  return "C2";
}