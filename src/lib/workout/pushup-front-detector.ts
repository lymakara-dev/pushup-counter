import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';
import { calculateAngle, calculateDistance, getMidpoint } from '../pose/pose-utils';
import { MovementSmoother } from './movement-smoother';
import { PushUpFormValidator, FormMetrics, PushUpFormConfig, DEFAULT_STRICT_CONFIG } from './pushup-form-validator';
import { PushUpState, PushUpResult } from './pushup-side-detector';

export class FrontPushUpDetector {
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
  private minLeftElbowInCycle = 180;
  private minRightElbowInCycle = 180;
  private maxLeftElbowInCycle = 0;
  private maxRightElbowInCycle = 0;

  private shoulderTopMidY = 0;
  private shoulderBottomMidY = 0;
  private hipTopMidY = 0;
  private hipBottomMidY = 0;
  private torsoLength = 0.3;

  private lastArmAsymmetry = 0;
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
    this.minLeftElbowInCycle = 180;
    this.minRightElbowInCycle = 180;
    this.maxLeftElbowInCycle = 0;
    this.maxRightElbowInCycle = 0;
    this.pendingState = null;
    this.stateConfirmCount = 0;
    this.lastTimestamp = 0;
    this.lastRepResult = null;
  }

  public update(rawLandmarks: NormalizedLandmark[], timestamp: number, currentCount: number): PushUpResult {
    const config = this.validator.getConfig();
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
    const visCheck = this.validator.checkFrontLandmarkVisibility(landmarks);
    this.lastAvgVisibility = visCheck.avgVisibility;

    if (!visCheck.visible) {
      return {
        count: currentCount,
        state: this.state,
        feedback: "Make sure both arms are visible",
        valid: false,
        repCompleted: false,
        confidence: visCheck.avgVisibility,
        formScore: Math.round(visCheck.avgVisibility * 50),
        reasons: ["Key front landmarks visibility below threshold"],
        primaryFeedbackKey: "MOVE_WHOLE_BODY"
      };
    }

    const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const lw = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rw = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    // Compute left and right elbow angles from smoothed landmarks
    const leftAngle = calculateAngle(ls, le, lw);
    const rightAngle = calculateAngle(rs, re, rw);

    // Average and minimum elbow angle for front view
    const primaryElbowAngle = (leftAngle + rightAngle) / 2;

    // Calculate arm asymmetry
    const angleDiff = Math.abs(leftAngle - rightAngle);
    this.lastArmAsymmetry = angleDiff / Math.max(leftAngle, rightAngle, 1);

    // Midpoints
    const shoulderMid = getMidpoint(ls, rs);
    const hipMid = (lh && rh) ? getMidpoint(lh, rh) : null;

    if (hipMid) {
      this.torsoLength = Math.max(0.15, calculateDistance(shoulderMid, hipMid));
    }

    // Track extremes in cycle
    if (this.isCycleActive) {
      this.minLeftElbowInCycle = Math.min(this.minLeftElbowInCycle, leftAngle);
      this.minRightElbowInCycle = Math.min(this.minRightElbowInCycle, rightAngle);
      this.maxLeftElbowInCycle = Math.max(this.maxLeftElbowInCycle, leftAngle);
      this.maxRightElbowInCycle = Math.max(this.maxRightElbowInCycle, rightAngle);
      this.shoulderBottomMidY = Math.max(this.shoulderBottomMidY, shoulderMid.y);
      if (hipMid) {
        this.hipBottomMidY = Math.max(this.hipBottomMidY, hipMid.y);
      }
    }

    // Target state evaluation
    let targetState = this.state;
    if (leftAngle >= config.frontTopElbowAngle && rightAngle >= config.frontTopElbowAngle) {
      targetState = PushUpState.READY;
    } else if (leftAngle <= config.frontBottomElbowAngle || rightAngle <= config.frontBottomElbowAngle) {
      targetState = PushUpState.DOWN;
    }

    // Hysteresis & Confirmation
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

    // Transition state
    if (this.pendingState && this.stateConfirmCount >= config.stateConfirmationFrames) {
      const prevState = this.state;
      this.state = this.pendingState;
      this.pendingState = null;
      this.stateConfirmCount = 0;

      if (this.state === PushUpState.READY) {
        if (prevState === PushUpState.UNKNOWN || prevState === PushUpState.POSITIONING) {
          this.shoulderTopMidY = shoulderMid.y;
          if (hipMid) this.hipTopMidY = hipMid.y;
          this.maxLeftElbowInCycle = leftAngle;
          this.maxRightElbowInCycle = rightAngle;
        } else if (prevState === PushUpState.DOWN && this.isCycleActive) {
          // Completed UP
          this.topValid = leftAngle >= config.frontTopElbowAngle && rightAngle >= config.frontTopElbowAngle;
          const duration = timestamp - this.cycleStartTime;

          const shoulderTravel = Math.max(0, this.shoulderBottomMidY - this.shoulderTopMidY);
          const hipTravel = Math.max(0, this.hipBottomMidY - this.hipTopMidY);

          const minAvg = (this.minLeftElbowInCycle + this.minRightElbowInCycle) / 2;
          const maxAvg = (this.maxLeftElbowInCycle + this.maxRightElbowInCycle) / 2;

          const romScore = this.validator.calculateRomScore(
            minAvg,
            maxAvg,
            config.frontBottomElbowAngle,
            config.frontTopElbowAngle,
            shoulderTravel,
            this.torsoLength
          );

          // Arm movement difference for symmetry checking
          const leftTravel = this.maxLeftElbowInCycle - this.minLeftElbowInCycle;
          const rightTravel = this.maxRightElbowInCycle - this.minRightElbowInCycle;
          const maxArmTravel = Math.max(leftTravel, rightTravel, 1);
          const asymmetry = Math.abs(leftTravel - rightTravel) / maxArmTravel;

          const metrics: FormMetrics = {
            romScore,
            elbowAngle: primaryElbowAngle,
            leftElbowAngle: leftAngle,
            rightElbowAngle: rightAngle,
            minElbowAngleReached: minAvg,
            maxElbowAngleReached: maxAvg,
            shoulderTravel,
            hipTravel,
            torsoLength: this.torsoLength,
            visibility: this.lastAvgVisibility,
            armAsymmetry: asymmetry,
            repDurationMs: duration,
            bottomValid: this.bottomValid,
            topValid: this.topValid,
            velocity: (shoulderTravel / Math.max(1, duration))
          };

          const evalResult = this.validator.evaluateRepetition(metrics, "front");

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

          this.isCycleActive = false;
          this.bottomValid = false;
          this.topValid = false;
        }

        this.shoulderTopMidY = shoulderMid.y;
        if (hipMid) this.hipTopMidY = hipMid.y;
        this.maxLeftElbowInCycle = leftAngle;
        this.maxRightElbowInCycle = rightAngle;
      } else if (this.state === PushUpState.DOWN) {
        this.isCycleActive = true;
        this.cycleStartTime = timestamp;
        this.bottomTime = timestamp;
        this.minLeftElbowInCycle = leftAngle;
        this.minRightElbowInCycle = rightAngle;
        this.maxLeftElbowInCycle = Math.max(this.maxLeftElbowInCycle, config.frontTopElbowAngle);
        this.maxRightElbowInCycle = Math.max(this.maxRightElbowInCycle, config.frontTopElbowAngle);
        this.shoulderBottomMidY = shoulderMid.y;
        if (hipMid) this.hipBottomMidY = hipMid.y;

        const hasSufficientFlexion = leftAngle <= config.frontBottomElbowAngle || rightAngle <= config.frontBottomElbowAngle;
        const hasSymmetry = this.lastArmAsymmetry <= config.maxArmAsymmetry * 1.5;
        const hasVisibility = this.lastAvgVisibility >= config.minLandmarkVisibility;

        this.bottomValid = hasSufficientFlexion && hasSymmetry && hasVisibility;
      }
    }

    const currentShoulderTravel = this.isCycleActive ? Math.max(0, shoulderMid.y - this.shoulderTopMidY) : 0;
    const currentHipTravel = this.isCycleActive && hipMid ? Math.max(0, hipMid.y - this.hipTopMidY) : 0;

    const liveMinAvg = this.isCycleActive ? (this.minLeftElbowInCycle + this.minRightElbowInCycle) / 2 : primaryElbowAngle;
    const liveMaxAvg = this.isCycleActive ? (this.maxLeftElbowInCycle + this.maxRightElbowInCycle) / 2 : primaryElbowAngle;

    const liveRomScore = this.validator.calculateRomScore(
      liveMinAvg,
      liveMaxAvg,
      config.frontBottomElbowAngle,
      config.frontTopElbowAngle,
      currentShoulderTravel,
      this.torsoLength
    );

    const liveMetrics: FormMetrics = {
      romScore: liveRomScore,
      elbowAngle: primaryElbowAngle,
      leftElbowAngle: leftAngle,
      rightElbowAngle: rightAngle,
      minElbowAngleReached: liveMinAvg,
      maxElbowAngleReached: liveMaxAvg,
      shoulderTravel: currentShoulderTravel,
      hipTravel: currentHipTravel,
      torsoLength: this.torsoLength,
      visibility: this.lastAvgVisibility,
      armAsymmetry: this.lastArmAsymmetry,
      repDurationMs: this.isCycleActive ? timestamp - this.cycleStartTime : 0,
      bottomValid: this.bottomValid,
      topValid: this.topValid,
      velocity: 0
    };

    let feedback = "Ready";
    if (this.state === PushUpState.DOWN) {
      if (primaryElbowAngle > config.frontBottomElbowAngle + 10) {
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
