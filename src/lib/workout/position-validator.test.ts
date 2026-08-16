import { describe, it, expect } from 'vitest';
import { validatePushUpPosition, PositionIssue } from './position-validator';
import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';

function createMockLandmarks(overrides: Partial<NormalizedLandmark>[] = []): NormalizedLandmark[] {
  const landmarks = new Array(33).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  
  overrides.forEach((override, index) => {
    if (override) {
      landmarks[index] = { ...landmarks[index], ...override };
    }
  });

  return landmarks;
}

describe('validatePushUpPosition', () => {
  it('No person (Expected: NO_PERSON)', () => {
    const result = validatePushUpPosition([]);
    expect(result.ready).toBe(false);
    expect(result.issue).toBe("NO_PERSON");
  });

  it('Body outside frame/Too far left (Expected: MOVE_RIGHT)', () => {
    // If x < 0.02, it should prompt to move right (since mirrored)
    const landmarks = createMockLandmarks();
    landmarks[POSE_LANDMARKS.NOSE] = { x: 0.01, y: 0.5, z: 0, visibility: 0.9 };
    const result = validatePushUpPosition(landmarks);
    expect(result.ready).toBe(false);
    expect(result.issue).toBe("MOVE_RIGHT");
  });

  it('Too close (Expected: TOO_CLOSE)', () => {
    // Width > 0.95
    const landmarks = createMockLandmarks();
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.05, y: 0.5, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.98, y: 0.5, z: 0, visibility: 0.9 }; // Width = 0.93 - Wait, max = 0.95. Let's make it bigger.
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.025, y: 0.5, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.98, y: 0.5, z: 0, visibility: 0.9 }; 
    // Width = 0.955 > 0.95
    const result = validatePushUpPosition(landmarks);
    expect(result.ready).toBe(false);
    expect(result.issue).toBe("TOO_CLOSE");
  });

  it('Too far (Expected: TOO_FAR)', () => {
    // Max size < 0.35
    const landmarks = createMockLandmarks();
    // Keep everything close to 0.5
    for(let i=0; i<33; i++) {
        landmarks[i] = { x: 0.5 + Math.random()*0.1, y: 0.5 + Math.random()*0.1, z: 0, visibility: 0.9 };
    }
    const result = validatePushUpPosition(landmarks);
    expect(result.ready).toBe(false);
    expect(result.issue).toBe("TOO_FAR");
  });

  it('Standing (Expected: GET_IN_PUSHUP_POSITION)', () => {
    // Height > Width * 1.2
    const landmarks = createMockLandmarks();
    landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.1, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.5, y: 0.9, z: 0, visibility: 0.9 };
    // height = 0.8, width = 0 (or very small)
    const result = validatePushUpPosition(landmarks);
    expect(result.ready).toBe(false);
    expect(result.issue).toBe("GET_IN_PUSHUP_POSITION");
  });

  it('Wrong orientation (Expected: TURN_SIDEWAYS)', () => {
    // Shoulder width > overall width * 0.35
    const landmarks = createMockLandmarks();
    // Make body width = 0.6
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.2, y: 0.5, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.8, y: 0.5, z: 0, visibility: 0.9 };
    // Make shoulder width = 0.4
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.3, y: 0.5, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.7, y: 0.5, z: 0, visibility: 0.9 };
    // Width = 0.6, Height = 0, shoulderWidth = 0.4 > 0.6 * 0.35 = 0.21
    const result = validatePushUpPosition(landmarks);
    expect(result.ready).toBe(false);
    expect(result.issue).toBe("TURN_SIDEWAYS");
  });

  it('Correct push-up position (Expected: true)', () => {
    const landmarks = createMockLandmarks();
    // Ankle left, shoulder right, side-profile
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.2, y: 0.5, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.8, y: 0.4, z: 0, visibility: 0.9 };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.8, y: 0.4, z: 0, visibility: 0.1 }; // Not visible, side profile
    
    const result = validatePushUpPosition(landmarks);
    expect(result.ready).toBe(true);
  });
});
