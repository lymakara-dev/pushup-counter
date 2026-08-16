import { POSE_LANDMARKS, NormalizedLandmark } from '../pose/landmarks';
import { calculateAngle, isLandmarkVisible } from '../pose/pose-utils';

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

export class PushUpDetector {
  private count = 0;
  private state: PushUpState = PushUpState.UNKNOWN;
  private lastStateChangeTime = 0;
  private hasCompletedFirstDown = false;

  public reset(): void {
    this.count = 0;
    this.state = PushUpState.UNKNOWN;
    this.lastStateChangeTime = 0;
    this.hasCompletedFirstDown = false;
  }

  public getCount(): number {
    return this.count;
  }

  public getState(): PushUpState {
    return this.state;
  }

  public update(landmarks: NormalizedLandmark[], timestamp: number): ExerciseResult {
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];

    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    // Determine which side is more visible
    const leftVisibility = (leftShoulder?.visibility || 0) + (leftElbow?.visibility || 0) + (leftWrist?.visibility || 0);
    const rightVisibility = (rightShoulder?.visibility || 0) + (rightElbow?.visibility || 0) + (rightWrist?.visibility || 0);

    let useLeft = leftVisibility > rightVisibility;
    
    // Check if the required joints are visible
    const shoulder = useLeft ? leftShoulder : rightShoulder;
    const elbow = useLeft ? leftElbow : rightElbow;
    const wrist = useLeft ? leftWrist : rightWrist;
    const hip = useLeft ? leftHip : rightHip;
    const ankle = useLeft ? leftAnkle : rightAnkle;

    const isVisible = isLandmarkVisible(shoulder, PUSH_UP_CONFIG.minVisibility) &&
                      isLandmarkVisible(elbow, PUSH_UP_CONFIG.minVisibility) &&
                      isLandmarkVisible(wrist, PUSH_UP_CONFIG.minVisibility);

    if (!isVisible) {
      return {
        count: this.count,
        state: this.state,
        feedback: "Make sure your whole body is visible in the camera."
      };
    }

    // Check basic body horizontal alignment (optional, but requested by prompt)
    // For a pushup, the y distance between shoulder and ankle shouldn't be fully vertical
    if (isLandmarkVisible(ankle, 0.4) && isLandmarkVisible(shoulder, 0.4)) {
      const isVertical = Math.abs(ankle.y - shoulder.y) > 0.6; // Basic heuristic
      if (isVertical) {
        this.state = PushUpState.POSITIONING;
        return {
          count: this.count,
          state: this.state,
          feedback: "Get into push-up position (horizontal)."
        };
      }
    }

    const currentElbowAngle = calculateAngle(shoulder, elbow, wrist);

    // State Machine
    switch (this.state) {
      case PushUpState.UNKNOWN:
      case PushUpState.POSITIONING:
        if (currentElbowAngle >= PUSH_UP_CONFIG.upAngle) {
          this.state = PushUpState.READY;
          this.lastStateChangeTime = timestamp;
        }
        break;

      case PushUpState.READY: // Arms are straight
        if (currentElbowAngle <= PUSH_UP_CONFIG.downAngle) {
          const timeSinceLastState = timestamp - this.lastStateChangeTime;
          // Simple debouncing/smoothing: only change state if enough time passed
          // if (timeSinceLastState > 100) {
            this.state = PushUpState.DOWN;
            this.lastStateChangeTime = timestamp;
            this.hasCompletedFirstDown = true;
          // }
        }
        break;

      case PushUpState.DOWN:
        if (currentElbowAngle >= PUSH_UP_CONFIG.upAngle) {
          const timeSinceLastState = timestamp - this.lastStateChangeTime;
          if (timeSinceLastState >= PUSH_UP_CONFIG.minRepDurationMs && timeSinceLastState <= PUSH_UP_CONFIG.maxRepDurationMs) {
            if (this.hasCompletedFirstDown) {
              this.count += 1;
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

    return {
      count: this.count,
      state: this.state,
      feedback
    };
  }
}
