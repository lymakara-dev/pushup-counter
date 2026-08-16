import { NormalizedLandmark } from './landmarks';

export function calculateAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  
  return angle;
}

export function isLandmarkVisible(landmark: NormalizedLandmark, threshold = 0.5): boolean {
  return landmark.visibility !== undefined && landmark.visibility > threshold;
}

export function calculateDistance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

export function getMidpoint(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility || 0, b.visibility || 0)
  };
}
