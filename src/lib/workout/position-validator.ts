import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';

export type PositionIssue =
  | "NO_PERSON"
  | "BODY_NOT_VISIBLE"
  | "TOO_CLOSE"
  | "TOO_FAR"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "MOVE_UP"
  | "MOVE_DOWN"
  | "TURN_SIDEWAYS"
  | "GET_IN_PUSHUP_POSITION"
  | "LOW_CONFIDENCE";

export interface PositionResult {
  ready: boolean;
  issue?: PositionIssue;
  message: string;
}

const POSITION_CONFIG = {
  minVisibility: 0.6,
  minBodySize: 0.35, 
  maxBodySize: 0.95,
  margin: 0.02,
};

export function validatePushUpPosition(landmarks: NormalizedLandmark[] | null | undefined): PositionResult {
  if (!landmarks || landmarks.length === 0) {
    return { ready: false, issue: "NO_PERSON", message: "Looking for your body..." };
  }

  const requiredJoints = [
    POSE_LANDMARKS.NOSE,
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
    POSE_LANDMARKS.LEFT_ANKLE,
    POSE_LANDMARKS.RIGHT_ANKLE,
    POSE_LANDMARKS.LEFT_WRIST,
    POSE_LANDMARKS.RIGHT_WRIST
  ];

  let visibleCount = 0;
  for (const idx of requiredJoints) {
    if ((landmarks[idx]?.visibility || 0) > POSITION_CONFIG.minVisibility) {
      visibleCount++;
    }
  }

  if (visibleCount < requiredJoints.length * 0.5) {
    return { ready: false, issue: "BODY_NOT_VISIBLE", message: "Show your whole body" };
  }

  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  let hasValidPoints = false;

  for (const lm of landmarks) {
    if ((lm.visibility || 0) > POSITION_CONFIG.minVisibility) {
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
      hasValidPoints = true;
    }
  }

  if (!hasValidPoints) {
    return { ready: false, issue: "LOW_CONFIDENCE", message: "Show your whole body" };
  }

  // Check bounds
  if (minX < POSITION_CONFIG.margin) return { ready: false, issue: "MOVE_RIGHT", message: "Move right" };
  if (maxX > 1 - POSITION_CONFIG.margin) return { ready: false, issue: "MOVE_LEFT", message: "Move left" };
  if (minY < POSITION_CONFIG.margin) return { ready: false, issue: "MOVE_DOWN", message: "Move down" };
  if (maxY > 1 - POSITION_CONFIG.margin) return { ready: false, issue: "MOVE_UP", message: "Move up" };

  const width = maxX - minX;
  const height = maxY - minY;
  const bodySize = Math.max(width, height);

  if (bodySize < POSITION_CONFIG.minBodySize) {
    return { ready: false, issue: "TOO_FAR", message: "Move closer" };
  }
  if (bodySize > POSITION_CONFIG.maxBodySize) {
    return { ready: false, issue: "TOO_CLOSE", message: "Move farther away" };
  }

  // Check orientation (Shoulders vs Hips in Z or X)
  // For a pushup, the body width (shoulder to ankle) should be larger than body height
  if (height > width * 1.2) {
    return { ready: false, issue: "GET_IN_PUSHUP_POSITION", message: "Get into push-up position" };
  }

  // Turn sideways: distance between left and right shoulders should be small compared to body size
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  
  if (leftShoulder && rightShoulder && 
      (leftShoulder.visibility || 0) > POSITION_CONFIG.minVisibility && 
      (rightShoulder.visibility || 0) > POSITION_CONFIG.minVisibility) {
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    if (shoulderWidth > width * 0.35) {
      return { ready: false, issue: "TURN_SIDEWAYS", message: "Turn sideways" };
    }
  }

  return { ready: true, message: "Perfect position" };
}
