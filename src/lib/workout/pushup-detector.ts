import { NormalizedLandmark } from '../pose/landmarks';
import { SidePushUpDetector, PushUpState, PushUpResult } from './pushup-side-detector';
import { FrontPushUpDetector } from './pushup-front-detector';
import { PushUpFormConfig, DEFAULT_STRICT_CONFIG, DEFAULT_STANDARD_CONFIG, WorkoutValidationMode, FormMetrics } from './pushup-form-validator';

export type CameraViewMode = "side" | "front";
export { PushUpState };
export type { PushUpResult, FormMetrics };

export interface ExerciseResult extends PushUpResult {}

export const PUSH_UP_CONFIG = {
  upAngle: 150,
  downAngle: 90,
  minVisibility: 0.5,
  minRepDurationMs: 500,
  maxRepDurationMs: 8000,
};

export class PushUpDetector {
  private count = 0;
  private state: PushUpState = PushUpState.UNKNOWN;
  private mode: CameraViewMode = "front";
  private validationMode: WorkoutValidationMode = "strict";
  
  private sideDetector: SidePushUpDetector;
  private frontDetector: FrontPushUpDetector;

  constructor(validationMode: WorkoutValidationMode = "strict") {
    this.validationMode = validationMode;
    const config = validationMode === "strict" ? DEFAULT_STRICT_CONFIG : DEFAULT_STANDARD_CONFIG;
    this.sideDetector = new SidePushUpDetector(config);
    this.frontDetector = new FrontPushUpDetector(config);
  }

  public setValidationMode(mode: WorkoutValidationMode) {
    this.validationMode = mode;
    const config = mode === "strict" ? DEFAULT_STRICT_CONFIG : DEFAULT_STANDARD_CONFIG;
    this.sideDetector.setConfig(config);
    this.frontDetector.setConfig(config);
  }

  public getValidationMode(): WorkoutValidationMode {
    return this.validationMode;
  }

  public setMode(mode: CameraViewMode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.sideDetector.reset();
      this.frontDetector.reset();
      this.state = PushUpState.UNKNOWN;
    }
  }

  public getMode(): CameraViewMode {
    return this.mode;
  }

  public reset(): void {
    this.count = 0;
    this.state = PushUpState.UNKNOWN;
    this.sideDetector.reset();
    this.frontDetector.reset();
  }

  public getCount(): number {
    return this.count;
  }

  public getState(): PushUpState {
    return this.state;
  }

  public setConfig(config: Partial<PushUpFormConfig>) {
    this.sideDetector.setConfig(config);
    this.frontDetector.setConfig(config);
  }

  public getConfig(): PushUpFormConfig {
    return this.sideDetector.getConfig();
  }

  public update(landmarks: NormalizedLandmark[], timestamp: number): PushUpResult {
    const detector = this.mode === "side" ? this.sideDetector : this.frontDetector;
    const result = detector.update(landmarks, timestamp, this.count);
    
    if (result.count > this.count) {
      this.count = result.count;
    }
    this.state = result.state;
    
    return {
      ...result,
      count: this.count,
      state: this.state
    };
  }
}
