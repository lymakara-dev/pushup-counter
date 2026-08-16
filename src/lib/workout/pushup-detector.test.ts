import { describe, it, expect, beforeEach } from 'vitest';
import { PushUpDetector, PushUpState, PUSH_UP_CONFIG } from './pushup-detector';
import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';

function createLandmarks(angle: number, visible = true, isHorizontal = false): NormalizedLandmark[] {
  const landmarks = new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0 });
  const visibility = visible ? 0.9 : 0.1;
  
  // To create a specific angle, we can fix elbow at (0,0) and shoulder at (0,1).
  // Then wrist can be placed based on the angle.
  // Shoulder at (0,1) -> vector from elbow to shoulder is (0,1).
  const shoulder = { x: 0, y: 1, z: 0, visibility };
  const elbow = { x: 0, y: 0, z: 0, visibility };
  
  // Angle from y-axis:
  const rad = (angle * Math.PI) / 180;
  // If angle is 180, wrist should be at (0,-1)
  // If angle is 90, wrist should be at (1,0)
  const wrist = {
    x: Math.sin(rad),
    y: Math.cos(rad),
    z: 0,
    visibility
  };
  
  // Mock ankle to make the horizontal check pass
  // The check is `Math.abs(ankle.y - shoulder.y) > 0.6` for vertical, so we make it < 0.6 for horizontal.
  // shoulder is at y=1. So ankle at y=1 makes it perfectly horizontal.
  const ankle = { x: 1, y: isHorizontal ? 1 : 2, z: 0, visibility };
  
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = shoulder;
  landmarks[POSE_LANDMARKS.LEFT_ELBOW] = elbow;
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = wrist;
  landmarks[POSE_LANDMARKS.LEFT_ANKLE] = ankle;
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.5, y: 1, z: 0, visibility };
  
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { ...shoulder, visibility: 0 };
  landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { ...elbow, visibility: 0 };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { ...wrist, visibility: 0 };
  landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { ...ankle, visibility: 0 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.5, y: 1, z: 0, visibility: 0 };
  
  return landmarks;
}

describe('PushUpDetector', () => {
  let detector: PushUpDetector;
  
  beforeEach(() => {
    detector = new PushUpDetector();
  });
  
  it('Valid: UP -> DOWN -> UP (Expected: 1)', () => {
    let ts = 0;
    detector.update(createLandmarks(160, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(80, true, true), ts); // DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    detector.update(createLandmarks(160, true, true), ts); // UP
    
    expect(detector.getCount()).toBe(1);
  });
  
  it('Two repetitions: UP -> DOWN -> UP -> DOWN -> UP (Expected: 2)', () => {
    let ts = 0;
    detector.update(createLandmarks(160, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(80, true, true), ts); // DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    detector.update(createLandmarks(160, true, true), ts); // UP (1)
    ts += 100;
    detector.update(createLandmarks(80, true, true), ts); // DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    detector.update(createLandmarks(160, true, true), ts); // UP (2)
    
    expect(detector.getCount()).toBe(2);
  });
  
  it('Incomplete: UP -> DOWN (Expected: 0)', () => {
    let ts = 0;
    detector.update(createLandmarks(160, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(80, true, true), ts); // DOWN
    
    expect(detector.getCount()).toBe(0);
  });
  
  it('False movement: UP -> slightly DOWN -> UP (Expected: 0)', () => {
    let ts = 0;
    detector.update(createLandmarks(160, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(120, true, true), ts); // slightly DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    detector.update(createLandmarks(160, true, true), ts); // UP
    
    expect(detector.getCount()).toBe(0);
  });
  
  it('Repeated DOWN: UP -> DOWN -> DOWN -> DOWN -> UP (Expected: 1)', () => {
    let ts = 0;
    detector.update(createLandmarks(160, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(80, true, true), ts); // DOWN
    ts += 100;
    detector.update(createLandmarks(70, true, true), ts); // DOWN
    ts += 100;
    detector.update(createLandmarks(80, true, true), ts); // DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    detector.update(createLandmarks(160, true, true), ts); // UP
    
    expect(detector.getCount()).toBe(1);
  });
});
