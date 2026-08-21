import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';
import { calculateAngle, calculateDistance, isLandmarkVisible } from '../pose/pose-utils';
import { MovementSmoother } from './movement-smoother';
import { PushUpFormValidator, FormMetrics, PushUpFormConfig, DEFAULT_STRICT_CONFIG } from './pushup-form-validator';

export enum PushUpState {
  UNKNOWN = 'UNKNOWN',
  POSITIONING = 'POSITIONING',
  READY = 'READY',
  DOWN = 'DOWN',
}

export interface PushUpResult {
  count: number;
  state: PushUpState;
  feedback: string;
  valid: boolean;
  repCompleted: boolean;
  confidence: number;
  formScore: number;
  reasons: string[];
  metrics?: FormMetrics;
  primaryFeedbackKey?: string;
}

export class SidePushUpDetector {
  private state: PushUpState = PushUpState.UNKNOWN;
  private smoother = new MovementSmoother();
  private validator: PushUpFormValidator;

  // Rep cycle tracking
  private isCycleActive = false;
  private cycleStartTime = 0;
  private bottomTime = 0;
  private bottomValid = false;
  private topValid = false;

  // Extreme measurements during active rep cycle
  private minElbowAngleInCycle = 180;
  private maxElbowAngleInCycle = 0;
  private shoulderTopY = 0;
  private shoulderBottomY = 0;
  private hipTopY = 0;
  private hipBottomY = 0;
  private torsoLength = 0.3;

  private lastAlignmentDeviation = 0;
  private lastAlignmentAngle = 180;
  private lastAvgVisibility = 1;

  // Hysteresis & State Confirmation
  private pendingState: PushUpState | null = null;
  private stateConfirmCount = 0;
  private lastTimestamp = 0;

  // Last evaluated rep result
  private lastRepResult: PushUpResult | null = null;

  constructor(config: PushUpFormConfig = DEFAULT_STRICT_CONFIG) {
    this.validator = new PushUpFormValidator(config);
  }

  public setConfig(config: Partial<PushUpFormConfig>): void {
    this.validator.setConfig(config);
  }

  public getConfig(): PushUpFormConfig {
    return this.validator.getConfig();
  }

  public reset(): void {
    this.state = PushUpState.UNKNOWN;
    this.smoother.reset();
    this.isCycleActive = false;
    this.cycleStartTime = 0;
    this.bottomTime = 0;
    this.bottomValid = false;
    this.topValid = false;
    this.minElbowAngleInCycle = 180;
    this.maxElbowAngleInCycle = 0;
    this.pendingState = null;
    this.stateConfirmCount = 0;
    this.lastTimestamp = 0;
    this.lastRepResult = null;
  }

  public update(rawLandmarks: NormalizedLandmark[], timestamp: number, currentCount: number): PushUpResult {
    const config = this.validator.getConfig();
    const dt = this.lastTimestamp > 0 ? Math.max(1, timestamp - this.lastTimestamp) : 33;
    this.lastTimestamp = timestamp;

    if (!rawLandmarks || rawLandmarks.length === 0) {
      return {
        count: currentCount,
        state: this.state,
        feedback: "Make sure your whole body is visible",
        valid: false,
        repCompleted: false,
        confidence: 0,
        formScore: 0,
        reasons: ["No landmarks detected"],
        primaryFeedbackKey: "MOVE_WHOLE_BODY"
      };
    }

    // Temporal smoothing
    const landmarks = this.smoother.smoothLandmarks(rawLandmarks);

    // Visibility check
    const visCheck = this.validator.checkSideLandmarkVisibility(landmarks);
    this.lastAvgVisibility = visCheck.avgVisibility;

    if (!visCheck.visible) {
      return {
        count: currentCount,
        state: this.state,
        feedback: "Make sure your body is visible from the side",
        valid: false,
        repCompleted: false,
        confidence: visCheck.avgVisibility,
        formScore: Math.round(visCheck.avgVisibility * 50),
        reasons: ["Key landmarks visibility below threshold"],
        primaryFeedbackKey: "MOVE_WHOLE_BODY"
      };
    }

    const side = visCheck.side;
    const shoulder = side === "left" ? landmarks[POSE_LANDMARKS.LEFT_SHOULDER] : landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const elbow = side === "left" ? landmarks[POSE_LANDMARKS.LEFT_ELBOW] : landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const wrist = side === "left" ? landmarks[POSE_LANDMARKS.LEFT_WRIST] : landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const hip = side === "left" ? landmarks[POSE_LANDMARKS.LEFT_HIP] : landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const ankle = side === "left" ? landmarks[POSE_LANDMARKS.LEFT_ANKLE] : landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    // Calculate elbow angle from smoothed landmarks
    const elbowAngle = calculateAngle(shoulder, elbow, wrist);

    // Calculate body alignment
    if (hip && ankle && (hip.visibility || 0) > 0.4 && (ankle.visibility || 0) > 0.4) {
      const alignment = this.validator.calculateBodyAlignment(shoulder, hip, ankle);
      this.lastAlignmentAngle = alignment.angle;
      this.lastAlignmentDeviation = alignment.deviation;
    }

    // Torso length for normalized travel
    if (hip) {
      this.torsoLength = Math.max(0.15, calculateDistance(shoulder, hip));
    }

    // Track extreme angles and positions during cycle
    if (this.isCycleActive) {
      this.minElbowAngleInCycle = Math.min(this.minElbowAngleInCycle, elbowAngle);
      this.maxElbowAngleInCycle = Math.max(this.maxElbowAngleInCycle, elbowAngle);
      this.shoulderBottomY = Math.max(this.shoulderBottomY, shoulder.y); // y increases going down
      if (hip) {
        this.hipBottomY = Math.max(this.hipBottomY, hip.y);
      }
    }

    // Determine target candidate state
    let targetState = this.state;
    if (elbowAngle >= config.sideTopElbowAngle) {
      targetState = PushUpState.READY;
    } else if (elbowAngle <= config.sideBottomElbowAngle) {
      targetState = PushUpState.DOWN;
    }

    // State Confirmation / Anti-bouncing Hysteresis
    if (targetState !== this.state) {
      if (this.pendingState === targetState) {
        this.stateConfirmCount++;
      } else {
        this.pendingState = targetState;
        this.stateConfirmCount = 1;
      }
    } else {
      this.pendingState = null;
      this.stateConfirmCount = 0;
    }

    let repCompleted = false;
    let repValid = false;
    let newCount = currentCount;
    let feedbackKey: string | undefined;

    // Transition state once confirmed across multiple frames
    if (this.pendingState && this.stateConfirmCount >= config.stateConfirmationFrames) {
      const prevState = this.state;
      this.state = this.pendingState;
      this.pendingState = null;
      this.stateConfirmCount = 0;

      // State Machine Logic
      if (this.state === PushUpState.READY) {
        if (prevState === PushUpState.UNKNOWN || prevState === PushUpState.POSITIONING) {
          // Starting position reached
          this.shoulderTopY = shoulder.y;
          if (hip) this.hipTopY = hip.y;
          this.maxElbowAngleInCycle = elbowAngle;
        } else if (prevState === PushUpState.DOWN && this.isCycleActive) {
          // User returned UP after going DOWN!
          this.topValid = elbowAngle >= config.sideTopElbowAngle;
          const duration = timestamp - this.cycleStartTime;

          const shoulderTravel = Math.max(0, this.shoulderBottomY - this.shoulderTopY);
          const hipTravel = Math.max(0, this.hipBottomY - this.hipTopY);

          const romScore = this.validator.calculateRomScore(
            this.minElbowAngleInCycle,
            this.maxElbowAngleInCycle,
            config.sideBottomElbowAngle,
            config.sideTopElbowAngle,
            shoulderTravel,
            this.torsoLength
          );

          const metrics: FormMetrics = {
            romScore,
            elbowAngle,
            minElbowAngleReached: this.minElbowAngleInCycle,
            maxElbowAngleReached: this.maxElbowAngleInCycle,
            bodyAlignmentAngle: this.lastAlignmentAngle,
            alignmentDeviation: this.lastAlignmentDeviation,
            shoulderTravel,
            hipTravel,
            torsoLength: this.torsoLength,
            visibility: this.lastAvgVisibility,
            repDurationMs: duration,
            bottomValid: this.bottomValid,
            topValid: this.topValid,
            velocity: (shoulderTravel / Math.max(1, duration))
          };

          const evalResult = this.validator.evaluateRepetition(metrics, "side");

          if (evalResult.valid && this.bottomValid) {
            newCount = currentCount + 1;
            repCompleted = true;
            repValid = true;
            feedbackKey = "GOOD_FORM";
          } else {
            repCompleted = true;
            repValid = false;
            feedbackKey = evalResult.primaryFeedbackKey || "REP_NOT_COUNTED";
          }

          this.lastRepResult = {
            count: newCount,
            state: this.state,
            feedback: evalResult.valid ? "Good form" : (evalResult.reasons[0] || "Rep not counted"),
            valid: repValid,
            repCompleted: true,
            confidence: this.lastAvgVisibility,
            formScore: evalResult.formScore,
            reasons: evalResult.reasons,
            metrics,
            primaryFeedbackKey: feedbackKey
          };

          // Reset cycle state
          this.isCycleActive = false;
          this.bottomValid = false;
          this.topValid = false;
        }

        // Ready for next rep
        this.shoulderTopY = shoulder.y;
        if (hip) this.hipTopY = hip.y;
        this.maxElbowAngleInCycle = elbowAngle;
      } else if (this.state === PushUpState.DOWN) {
        // Entered DOWN state
        this.isCycleActive = true;
        this.cycleStartTime = timestamp;
        this.bottomTime = timestamp;
        this.minElbowAngleInCycle = elbowAngle;
        this.maxElbowAngleInCycle = Math.max(this.maxElbowAngleInCycle, config.sideTopElbowAngle);
        this.shoulderBottomY = shoulder.y;
        if (hip) this.hipBottomY = hip.y;

        // Validate Bottom Position immediately and continuously
        const shoulderTravel = Math.max(0, this.shoulderBottomY - this.shoulderTopY);
        const hasSufficientFlexion = elbowAngle <= config.sideBottomElbowAngle;
        const hasGoodAlignment = this.lastAlignmentDeviation <= config.maxBodyAlignmentDev * 1.2;
        const hasVisibility = this.lastAvgVisibility >= config.minLandmarkVisibility;

        this.bottomValid = hasSufficientFlexion && hasGoodAlignment && hasVisibility;
      }
    }

    // Continuous in-progress metrics
    const currentShoulderTravel = this.isCycleActive ? Math.max(0, shoulder.y - this.shoulderTopY) : 0;
    const currentHipTravel = this.isCycleActive && hip ? Math.max(0, hip.y - this.hipTopY) : 0;

    const liveRomScore = this.validator.calculateRomScore(
      this.isCycleActive ? this.minElbowAngleInCycle : elbowAngle,
      this.isCycleActive ? this.maxElbowAngleInCycle : elbowAngle,
      config.sideBottomElbowAngle,
      config.sideTopElbowAngle,
      currentShoulderTravel,
      this.torsoLength
    );

    const liveMetrics: FormMetrics = {
      romScore: liveRomScore,
      elbowAngle,
      minElbowAngleReached: this.isCycleActive ? this.minElbowAngleInCycle : elbowAngle,
      maxElbowAngleReached: this.isCycleActive ? this.maxElbowAngleInCycle : elbowAngle,
      bodyAlignmentAngle: this.lastAlignmentAngle,
      alignmentDeviation: this.lastAlignmentDeviation,
      shoulderTravel: currentShoulderTravel,
      hipTravel: currentHipTravel,
      torsoLength: this.torsoLength,
      visibility: this.lastAvgVisibility,
      repDurationMs: this.isCycleActive ? timestamp - this.cycleStartTime : 0,
      bottomValid: this.bottomValid,
      topValid: this.topValid,
      velocity: 0
    };

    let feedback = "Ready";
    if (this.state === PushUpState.DOWN) {
      if (elbowAngle > config.sideBottomElbowAngle + 10) {
        feedback = "Go lower";
        feedbackKey = feedbackKey || "GO_LOWER";
      } else {
        feedback = "Down";
        feedbackKey = feedbackKey || "DOWN";
      }
    } else if (this.state === PushUpState.READY) {
      feedback = "Up";
      feedbackKey = feedbackKey || "UP";
    }

    return {
      count: newCount,
      state: this.state,
      feedback: this.lastRepResult && this.lastRepResult.repCompleted ? this.lastRepResult.feedback : feedback,
      valid: repValid,
      repCompleted,
      confidence: this.lastAvgVisibility,
      formScore: this.lastRepResult?.formScore ?? Math.round(liveRomScore * 80 + this.lastAvgVisibility * 20),
      reasons: this.lastRepResult?.reasons ?? [],
      metrics: liveMetrics,
      primaryFeedbackKey: feedbackKey
    };
  }
}
