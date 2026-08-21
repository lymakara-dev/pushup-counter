import { NormalizedLandmark } from '../pose/landmarks';

export interface SmootherConfig {
  landmarkAlpha?: number;
  scalarAlpha?: number;
}

export class MovementSmoother {
  private smoothedLandmarks: NormalizedLandmark[] | null = null;
  private scalarMap = new Map<string, number>();
  private landmarkAlpha: number;
  private scalarAlpha: number;

  constructor(config?: SmootherConfig) {
    this.landmarkAlpha = config?.landmarkAlpha ?? 0.35; // 35% new, 65% previous
    this.scalarAlpha = config?.scalarAlpha ?? 0.3;     // 30% new, 70% previous
  }

  public smoothLandmarks(landmarks: NormalizedLandmark[]): NormalizedLandmark[] {
    if (!landmarks || landmarks.length === 0) {
      this.smoothedLandmarks = null;
      return [];
    }

    if (!this.smoothedLandmarks || this.smoothedLandmarks.length !== landmarks.length) {
      this.smoothedLandmarks = landmarks.map(lm => ({ ...lm }));
      return this.smoothedLandmarks;
    }

    const smoothed: NormalizedLandmark[] = new Array(landmarks.length);
    const alpha = this.landmarkAlpha;

    for (let i = 0; i < landmarks.length; i++) {
      const prev = this.smoothedLandmarks[i];
      const curr = landmarks[i];

      const vis = curr.visibility ?? 0;
      const effectiveAlpha = vis > 0.5 ? alpha : alpha * 0.5;

      smoothed[i] = {
        x: prev.x * (1 - effectiveAlpha) + curr.x * effectiveAlpha,
        y: prev.y * (1 - effectiveAlpha) + curr.y * effectiveAlpha,
        z: (prev.z ?? 0) * (1 - effectiveAlpha) + (curr.z ?? 0) * effectiveAlpha,
        visibility: (prev.visibility ?? 0) * (1 - effectiveAlpha) + (curr.visibility ?? 0) * effectiveAlpha,
      };
    }

    this.smoothedLandmarks = smoothed;
    return smoothed;
  }

  public smoothScalar(key: string, value: number, customAlpha?: number): number {
    const alpha = customAlpha ?? this.scalarAlpha;
    if (!this.scalarMap.has(key)) {
      this.scalarMap.set(key, value);
      return value;
    }

    const prev = this.scalarMap.get(key)!;
    const next = prev * (1 - alpha) + value * alpha;
    this.scalarMap.set(key, next);
    return next;
  }

  public getSmoothedScalar(key: string): number | undefined {
    return this.scalarMap.get(key);
  }

  public reset(): void {
    this.smoothedLandmarks = null;
    this.scalarMap.clear();
  }
}
