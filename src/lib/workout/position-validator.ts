import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';
import { CameraViewMode } from './pushup-detector';

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
  | "FACE_CAMERA"
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

export function validatePushUpPosition(landmarks: NormalizedLandmark[] | null | undefined, mode: CameraViewMode = "front"): PositionResult {
  if (!landmarks || landmarks.length === 0) {
    return { ready: false, issue: "NO_PERSON", message: "Looking for your body..." };
  }

  const requiredJoints = [
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.LEFT_ELBOW,
    POSE_LANDMARKS.RIGHT_ELBOW,
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
    return { ready: false, issue: "BODY_NOT_VISIBLE", message: "Show your upper body" };
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

  // Check if standing upright instead of in pushup position
  if (mode === "side" && height > width * 1.5) {
    return { ready: false, issue: "GET_IN_PUSHUP_POSITION", message: "Get into push-up position" };
  } else if (mode === "front" && height > width * 2.2) {
    return { ready: false, issue: "GET_IN_PUSHUP_POSITION", message: "Get into push-up position" };
  }

  if (mode === "side") {
    // Turn sideways: distance between left and right shoulders should be small compared to body size
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    
    if (leftShoulder && rightShoulder && 
        (leftShoulder.visibility || 0) > POSITION_CONFIG.minVisibility && 
        (rightShoulder.visibility || 0) > POSITION_CONFIG.minVisibility) {
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      if (shoulderWidth > width * 0.4) {
        return { ready: false, issue: "TURN_SIDEWAYS", message: "Turn sideways" };
      }
    }
  } else if (mode === "front") {
    // For front view: shoulders should be wide apart relative to the image
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    
    if (leftShoulder && rightShoulder && 
        (leftShoulder.visibility || 0) > POSITION_CONFIG.minVisibility && 
        (rightShoulder.visibility || 0) > POSITION_CONFIG.minVisibility) {
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      if (shoulderWidth < width * 0.2) {
         return { ready: false, issue: "FACE_CAMERA", message: "Face the camera directly" };
      }
    }
  }

  return { ready: true, message: "Perfect position" };
}
