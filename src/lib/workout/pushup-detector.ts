import { POSE_LANDMARKS, NormalizedLandmark } from '../pose/landmarks';
import { calculateAngle, isLandmarkVisible } from '../pose/pose-utils';

export type CameraViewMode = "side" | "front";

export enum PushUpState {
  UNKNOWN = 'UNKNOWN',
  POSITIONING = 'POSITIONING',
  READY = 'READY', // Up position
  DOWN = 'DOWN',   // Down position
}

export interface ExerciseResult {
  count: number;
  state: PushUpState;
  feedback: string;
}

export const PUSH_UP_CONFIG = {
  upAngle: 150,
  downAngle: 90,
  minVisibility: 0.6,
  minRepDurationMs: 300,
  maxRepDurationMs: 5000,
};

interface IPushUpDetector {
  update(landmarks: NormalizedLandmark[], timestamp: number, currentCount: number): ExerciseResult;
  reset(): void;
}

class SidePushUpDetector implements IPushUpDetector {
  private state: PushUpState = PushUpState.UNKNOWN;
  private lastStateChangeTime = 0;
  private hasCompletedFirstDown = false;

  public reset(): void {
    this.state = PushUpState.UNKNOWN;
    this.lastStateChangeTime = 0;
    this.hasCompletedFirstDown = false;
  }

  public update(landmarks: NormalizedLandmark[], timestamp: number, currentCount: number): ExerciseResult {
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    const leftVisibility = (leftShoulder?.visibility || 0) + (leftElbow?.visibility || 0) + (leftWrist?.visibility || 0);
    const rightVisibility = (rightShoulder?.visibility || 0) + (rightElbow?.visibility || 0) + (rightWrist?.visibility || 0);

    let useLeft = leftVisibility > rightVisibility;
    
    const shoulder = useLeft ? leftShoulder : rightShoulder;
    const elbow = useLeft ? leftElbow : rightElbow;
    const wrist = useLeft ? leftWrist : rightWrist;

    if (!isLandmarkVisible(shoulder, PUSH_UP_CONFIG.minVisibility) ||
        !isLandmarkVisible(elbow, PUSH_UP_CONFIG.minVisibility) ||
        !isLandmarkVisible(wrist, PUSH_UP_CONFIG.minVisibility)) {
      return { count: currentCount, state: this.state, feedback: "Make sure your whole body is visible" };
    }

    const currentElbowAngle = calculateAngle(shoulder, elbow, wrist);
    let newCount = currentCount;

    switch (this.state) {
      case PushUpState.UNKNOWN:
      case PushUpState.POSITIONING:
        if (currentElbowAngle >= PUSH_UP_CONFIG.upAngle) {
          this.state = PushUpState.READY;
          this.lastStateChangeTime = timestamp;
        }
        break;

      case PushUpState.READY:
        if (currentElbowAngle <= PUSH_UP_CONFIG.downAngle) {
            this.state = PushUpState.DOWN;
            this.lastStateChangeTime = timestamp;
            this.hasCompletedFirstDown = true;
        }
        break;

      case PushUpState.DOWN:
        if (currentElbowAngle >= PUSH_UP_CONFIG.upAngle) {
          const timeSinceLastState = timestamp - this.lastStateChangeTime;
          if (timeSinceLastState >= PUSH_UP_CONFIG.minRepDurationMs && timeSinceLastState <= PUSH_UP_CONFIG.maxRepDurationMs) {
            if (this.hasCompletedFirstDown) {
              newCount += 1;
            }
          }
          this.state = PushUpState.READY;
          this.lastStateChangeTime = timestamp;
          this.hasCompletedFirstDown = false;
        } else if (currentElbowAngle > PUSH_UP_CONFIG.upAngle) {
           this.state = PushUpState.READY;
           this.lastStateChangeTime = timestamp;
        }
        break;
    }

    let feedback = "Ready";
    if (this.state === PushUpState.DOWN) feedback = "Down";
    if (this.state === PushUpState.READY) feedback = "Up";

    return { count: newCount, state: this.state, feedback };
  }
}

class FrontPushUpDetector implements IPushUpDetector {
  private state: PushUpState = PushUpState.UNKNOWN;
  private lastStateChangeTime = 0;
  private hasCompletedFirstDown = false;
  
  private smoothedElbowAngle = 0;

  // From the front, elbows flare out and appear as a tighter angle when down,
  // and straighter when up, but foreshortening means max angle is often lower than 180.
  // Using more forgiving thresholds.
  private readonly UP_ANGLE = 135;
  private readonly DOWN_ANGLE = 95;

  public reset(): void {
    this.state = PushUpState.UNKNOWN;
    this.lastStateChangeTime = 0;
    this.hasCompletedFirstDown = false;
    this.smoothedElbowAngle = 0;
  }

  public update(landmarks: NormalizedLandmark[], timestamp: number, currentCount: number): ExerciseResult {
    const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const lw = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rw = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    if (!isLandmarkVisible(ls, PUSH_UP_CONFIG.minVisibility) ||
        !isLandmarkVisible(rs, PUSH_UP_CONFIG.minVisibility) ||
        !isLandmarkVisible(le, PUSH_UP_CONFIG.minVisibility) ||
        !isLandmarkVisible(re, PUSH_UP_CONFIG.minVisibility) ||
        !isLandmarkVisible(lw, PUSH_UP_CONFIG.minVisibility) ||
        !isLandmarkVisible(rw, PUSH_UP_CONFIG.minVisibility)) {
      return { count: currentCount, state: this.state, feedback: "Make sure both arms are visible" };
    }

    const leftAngle = calculateAngle(ls, le, lw);
    const rightAngle = calculateAngle(rs, re, rw);
    const avgElbowAngle = Math.min(leftAngle, rightAngle); // Use the more bent arm to be safe, or average

    if (this.smoothedElbowAngle === 0) {
      this.smoothedElbowAngle = avgElbowAngle;
    } else {
      this.smoothedElbowAngle = this.smoothedElbowAngle * 0.7 + avgElbowAngle * 0.3;
    }

    let newCount = currentCount;

    switch (this.state) {
      case PushUpState.UNKNOWN:
      case PushUpState.POSITIONING:
        if (this.smoothedElbowAngle >= this.UP_ANGLE) {
          this.state = PushUpState.READY;
          this.lastStateChangeTime = timestamp;
        }
        break;

      case PushUpState.READY:
        if (this.smoothedElbowAngle <= this.DOWN_ANGLE) {
          this.state = PushUpState.DOWN;
          this.lastStateChangeTime = timestamp;
          this.hasCompletedFirstDown = true;
        }
        break;

      case PushUpState.DOWN:
        if (this.smoothedElbowAngle >= this.UP_ANGLE) {
          const timeSinceLastState = timestamp - this.lastStateChangeTime;
          if (timeSinceLastState >= PUSH_UP_CONFIG.minRepDurationMs && timeSinceLastState <= PUSH_UP_CONFIG.maxRepDurationMs) {
            if (this.hasCompletedFirstDown) {
              newCount += 1;
            }
          }
          this.state = PushUpState.READY;
          this.lastStateChangeTime = timestamp;
          this.hasCompletedFirstDown = false;
        }
        break;
    }

    let feedback = "Ready";
    if (this.state === PushUpState.DOWN) feedback = "Down";
    if (this.state === PushUpState.READY) feedback = "Up";

    return { count: newCount, state: this.state, feedback };
  }
}

export class PushUpDetector {
  private count = 0;
  private state: PushUpState = PushUpState.UNKNOWN;
  private mode: CameraViewMode = "side";
  
  private sideDetector = new SidePushUpDetector();
  private frontDetector = new FrontPushUpDetector();

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

  public update(landmarks: NormalizedLandmark[], timestamp: number): ExerciseResult {
    const detector = this.mode === "side" ? this.sideDetector : this.frontDetector;
    const result = detector.update(landmarks, timestamp, this.count);
    
    if (result.count > this.count) {
      this.count = result.count;
    }
    this.state = result.state;
    
    return {
      count: this.count,
      state: this.state,
      feedback: result.feedback
    };
  }
}
