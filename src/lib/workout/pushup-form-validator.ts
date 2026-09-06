import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';
import { calculateAngle, calculateDistance, isLandmarkVisible } from '../pose/pose-utils';

export type WorkoutValidationMode = "standard" | "strict";

export interface PushUpFormConfig {
  mode: WorkoutValidationMode;
  
  // Landmark Visibility
  minLandmarkVisibility: number;

  // Side View Angles (degrees)
  sideTopElbowAngle: number;
  sideBottomElbowAngle: number;

  // Front View Angles (degrees)
  frontTopElbowAngle: number;
  frontBottomElbowAngle: number;

  // Scores and Ratios
  minRomScore: number;
  minFormScore: number;
  
  // Temporal & Duration
  minRepDurationMs: number;
  maxRepDurationMs: number;
  stateConfirmationFrames: number;

  // Biomechanics & Anti-Cheat
  maxArmAsymmetry: number;
  maxBodyAlignmentDev: number; // Max deviation from 180 degrees
  minShoulderTravelRatio: number; // Ratio of shoulder vertical travel vs torso/body length
  minBodyMovementRatio: number;   // Ratio of torso movement vs total movement
  maxVelocity: number;            // Normalized change per ms
}

export const DEFAULT_STRICT_CONFIG: PushUpFormConfig = {
  mode: "strict",
  minLandmarkVisibility: 0.5,
  
  sideTopElbowAngle: 150,
  sideBottomElbowAngle: 100,

  frontTopElbowAngle: 135,
  frontBottomElbowAngle: 95,

  minRomScore: 0.60,
  minFormScore: 70,

  minRepDurationMs: 500,
  maxRepDurationMs: 8000,
  stateConfirmationFrames: 2,

  maxArmAsymmetry: 0.35,
  maxBodyAlignmentDev: 35,
  minShoulderTravelRatio: 0.12,
  minBodyMovementRatio: 0.30,
  maxVelocity: 0.015,
};

export const DEFAULT_STANDARD_CONFIG: PushUpFormConfig = {
  mode: "standard",
  minLandmarkVisibility: 0.45,
  
  sideTopElbowAngle: 140,
  sideBottomElbowAngle: 105,

  frontTopElbowAngle: 130,
  frontBottomElbowAngle: 100,

  minRomScore: 0.50,
  minFormScore: 60,

  minRepDurationMs: 400,
  maxRepDurationMs: 9000,
  stateConfirmationFrames: 2,

  maxArmAsymmetry: 0.45,
  maxBodyAlignmentDev: 45,
  minShoulderTravelRatio: 0.08,
  minBodyMovementRatio: 0.20,
  maxVelocity: 0.02,
};

export interface FormMetrics {
  romScore: number;          // 0 to 1
  elbowAngle: number;        // Current primary elbow angle
  leftElbowAngle?: number;
  rightElbowAngle?: number;
  minElbowAngleReached: number;
  maxElbowAngleReached: number;
  bodyAlignmentAngle?: number;
  alignmentDeviation?: number;
  shoulderTravel: number;    // Vertical normalized travel
  hipTravel: number;         // Vertical normalized travel
  torsoLength: number;       // Distance between shoulder and hip
  visibility: number;        // 0 to 1 average visibility of key joints
  armAsymmetry?: number;     // 0 to 1
  repDurationMs?: number;
  bottomValid: boolean;
  topValid: boolean;
  velocity: number;
}

export interface FormValidationResult {
  valid: boolean;
  formScore: number;         // 0 to 100
  reasons: string[];
  primaryFeedbackKey?: string;
  metrics: FormMetrics;
}

export class PushUpFormValidator {
  private config: PushUpFormConfig;

  constructor(config: PushUpFormConfig = DEFAULT_STANDARD_CONFIG) {
    this.config = { ...config };
  }

  public setConfig(config: Partial<PushUpFormConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): PushUpFormConfig {
    return this.config;
  }

  /**
   * Evaluates landmark visibility for required side-view landmarks.
   */
  public checkSideLandmarkVisibility(landmarks: NormalizedLandmark[]): { visible: boolean; avgVisibility: number; side: "left" | "right" } {
    const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const lw = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const la = landmarks[POSE_LANDMARKS.LEFT_ANKLE];

    const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const rw = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const ra = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    const leftSum = (ls?.visibility || 0) + (le?.visibility || 0) + (lw?.visibility || 0) + (lh?.visibility || 0) + (la?.visibility || 0);
    const rightSum = (rs?.visibility || 0) + (re?.visibility || 0) + (rw?.visibility || 0) + (rh?.visibility || 0) + (ra?.visibility || 0);

    const side = leftSum >= rightSum ? "left" : "right";
    const chosen = side === "left" ? [ls, le, lw, lh, la] : [rs, re, rw, rh, ra];

    const validCount = chosen.filter(lm => lm && isLandmarkVisible(lm, this.config.minLandmarkVisibility)).length;
    const avgVis = chosen.reduce((acc, lm) => acc + (lm?.visibility || 0), 0) / chosen.length;

    // Must have at least shoulder, elbow, wrist visible and majority of hip/ankle
    const armVisible = chosen[0]?.visibility! > this.config.minLandmarkVisibility &&
                       chosen[1]?.visibility! > this.config.minLandmarkVisibility &&
                       chosen[2]?.visibility! > this.config.minLandmarkVisibility;

    return {
      visible: armVisible && validCount >= 4,
      avgVisibility: avgVis,
      side
    };
  }

  /**
   * Evaluates landmark visibility for front-view landmarks (both arms & hips).
   */
  public checkFrontLandmarkVisibility(landmarks: NormalizedLandmark[]): { visible: boolean; avgVisibility: number } {
    const required = [
      POSE_LANDMARKS.LEFT_SHOULDER,
      POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.LEFT_ELBOW,
      POSE_LANDMARKS.RIGHT_ELBOW,
      POSE_LANDMARKS.LEFT_WRIST,
      POSE_LANDMARKS.RIGHT_WRIST,
      POSE_LANDMARKS.LEFT_HIP,
      POSE_LANDMARKS.RIGHT_HIP
    ];

    let totalVis = 0;
    let visibleCount = 0;

    for (const idx of required) {
      const lm = landmarks[idx];
      const vis = lm?.visibility || 0;
      totalVis += vis;
      if (lm && isLandmarkVisible(lm, this.config.minLandmarkVisibility)) {
        visibleCount++;
      }
    }

    const avgVis = totalVis / required.length;
    // For front view, both arms must be visible
    const armsValid = [
      POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST,
      POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST
    ].every(idx => (landmarks[idx]?.visibility || 0) > this.config.minLandmarkVisibility * 0.8);

    return {
      visible: armsValid && visibleCount >= 6,
      avgVisibility: avgVis
    };
  }

  /**
   * Calculates body alignment angle (shoulder -> hip -> ankle).
   * A straight body is 180 degrees.
   */
  public calculateBodyAlignment(shoulder: NormalizedLandmark, hip: NormalizedLandmark, ankle: NormalizedLandmark): { angle: number; deviation: number; issue?: "hips-high" | "hips-low" } {
    const angle = calculateAngle(shoulder, hip, ankle);
    const deviation = Math.abs(180 - angle);

    let issue: "hips-high" | "hips-low" | undefined;
    if (deviation > this.config.maxBodyAlignmentDev) {
      // If hip y is significantly less than shoulder/ankle line (higher up in screen space coordinates where y=0 is top)
      const expectedHipY = (shoulder.y + ankle.y) / 2;
      if (hip.y < expectedHipY - 0.05) {
        issue = "hips-high";
      } else if (hip.y > expectedHipY + 0.05) {
        issue = "hips-low";
      }
    }

    return { angle, deviation, issue };
  }

  /**
   * Calculates range of motion (ROM) score from 0 to 1 based on angle delta and target angles.
   */
  public calculateRomScore(
    minAngle: number,
    maxAngle: number,
    targetBottom: number,
    targetTop: number,
    shoulderTravel: number,
    torsoLength: number
  ): number {
    // 1. Angle extension score (top)
    const topScore = Math.min(1, Math.max(0, (maxAngle - (targetTop - 25)) / 25));
    // 2. Angle flexion score (bottom) - scales deeper flexion
    const bottomScore = Math.min(1, Math.max(0, ((targetBottom + 15) - minAngle) / 25));
    // 3. Angle delta score
    const angleDelta = Math.max(0, maxAngle - minAngle);
    const expectedDelta = targetTop - targetBottom;
    const deltaScore = Math.min(1, Math.max(0, angleDelta / expectedDelta));

    // 4. Physical travel score relative to torso
    const travelRatio = torsoLength > 0.05 ? shoulderTravel / torsoLength : shoulderTravel * 3;
    const travelScore = Math.min(1, Math.max(0, travelRatio / this.config.minShoulderTravelRatio));

    // Combined ROM score
    const romScore = topScore * 0.25 + bottomScore * 0.35 + deltaScore * 0.25 + travelScore * 0.15;
    return Math.max(0, Math.min(1, romScore));
  }

  /**
   * Computes an overall form score (0-100) and structured rejection reasons.
   */
  public evaluateRepetition(metrics: FormMetrics, view: "side" | "front"): FormValidationResult {
    const reasons: string[] = [];
    let primaryFeedbackKey: string | undefined;

    // 1. Check Duration
    const duration = metrics.repDurationMs ?? 0;
    let durationScore = 100;
    if (duration < this.config.minRepDurationMs) {
      durationScore = Math.max(0, (duration / this.config.minRepDurationMs) * 50);
      reasons.push("Movement too fast / rep duration too short");
      primaryFeedbackKey = "TOO_FAST";
    } else if (duration > this.config.maxRepDurationMs) {
      durationScore = 60;
      reasons.push("Rep duration too long / stalled");
    }

    // 2. Check Landmark Visibility
    let visibilityScore = Math.min(100, Math.round(metrics.visibility * 100));
    if (metrics.visibility < this.config.minLandmarkVisibility) {
      reasons.push("Landmark visibility too low");
      if (!primaryFeedbackKey) primaryFeedbackKey = "MOVE_WHOLE_BODY";
    }

    // 3. Check Range of Motion
    const romPercent = Math.round(metrics.romScore * 100);
    if (metrics.romScore < this.config.minRomScore) {
      reasons.push("Insufficient range of motion");
      if (!primaryFeedbackKey) primaryFeedbackKey = "GO_LOWER";
    }

    // 4. Check Elbow Flexion/Extension
    const targetTop = view === "side" ? this.config.sideTopElbowAngle : this.config.frontTopElbowAngle;
    const targetBottom = view === "side" ? this.config.sideBottomElbowAngle : this.config.frontBottomElbowAngle;

    let elbowScore = 100;
    if (metrics.minElbowAngleReached > targetBottom) {
      const penalty = (metrics.minElbowAngleReached - targetBottom) * 2.5;
      elbowScore -= penalty;
      reasons.push("Bottom position not reached (elbows not bent enough)");
      if (!primaryFeedbackKey) primaryFeedbackKey = "GO_LOWER";
    }
    if (metrics.maxElbowAngleReached < targetTop - 10) {
      const penalty = (targetTop - metrics.maxElbowAngleReached) * 2;
      elbowScore -= penalty;
      reasons.push("Top position not reached (elbows not fully extended)");
      if (!primaryFeedbackKey) primaryFeedbackKey = "COME_UP";
    }
    elbowScore = Math.max(0, Math.min(100, Math.round(elbowScore)));

    // 5. Check Body Alignment (Side View)
    let alignmentScore = 100;
    if (view === "side" && metrics.alignmentDeviation !== undefined) {
      if (metrics.alignmentDeviation > this.config.maxBodyAlignmentDev) {
        const penalty = (metrics.alignmentDeviation - this.config.maxBodyAlignmentDev) * 2.5;
        alignmentScore = Math.max(0, 100 - penalty);
        reasons.push("Body alignment poor (excessive hip or back bending)");
        if (!primaryFeedbackKey) primaryFeedbackKey = "BODY_STRAIGHT";
      } else {
        alignmentScore = Math.max(70, 100 - metrics.alignmentDeviation);
      }
    }

    // 6. Check Arm Asymmetry (Front View)
    let asymmetryScore = 100;
    if (view === "front" && metrics.armAsymmetry !== undefined) {
      if (metrics.armAsymmetry > this.config.maxArmAsymmetry) {
        const penalty = (metrics.armAsymmetry - this.config.maxArmAsymmetry) * 150;
        asymmetryScore = Math.max(0, 100 - penalty);
        reasons.push("Left and right arm movement asymmetrical");
        if (!primaryFeedbackKey) primaryFeedbackKey = "IMPROVE_POSITION";
      }
    }

    // 7. Check Body Movement vs Arm Movement Ratio
    let bodyMovementScore = 100;
    const travelRatio = metrics.torsoLength > 0.05 ? metrics.shoulderTravel / metrics.torsoLength : metrics.shoulderTravel * 3;
    if (travelRatio < this.config.minShoulderTravelRatio) {
      const penalty = ((this.config.minShoulderTravelRatio - travelRatio) / this.config.minShoulderTravelRatio) * 60;
      bodyMovementScore = Math.max(0, 100 - penalty);
      reasons.push("Body movement insufficient (arms only / torso stationary)");
      if (!primaryFeedbackKey) primaryFeedbackKey = "MOVE_WHOLE_BODY";
    }

    // 8. Overall Weighted Form Score
    const postureScore = view === "side" ? alignmentScore : asymmetryScore;
    const formScore = Math.max(0, Math.min(100, Math.round(
      romPercent * 0.30 +
      elbowScore * 0.25 +
      postureScore * 0.15 +
      bodyMovementScore * 0.15 +
      visibilityScore * 0.10 +
      (durationScore * 0.05)
    )));

    if (formScore < this.config.minFormScore) {
      reasons.push(`Form score ${formScore} below minimum threshold ${this.config.minFormScore}`);
      if (!primaryFeedbackKey) primaryFeedbackKey = "REP_NOT_COUNTED";
    }

    // Determine validity
    const valid = formScore >= this.config.minFormScore &&
                  metrics.bottomValid &&
                  metrics.topValid &&
                  metrics.romScore >= this.config.minRomScore &&
                  duration >= this.config.minRepDurationMs &&
                  metrics.visibility >= this.config.minLandmarkVisibility &&
                  reasons.length === 0;

    if (valid && !primaryFeedbackKey) {
      primaryFeedbackKey = "GOOD_FORM";
    }

    return {
      valid,
      formScore,
      reasons,
      primaryFeedbackKey,
      metrics
    };
  }
}
