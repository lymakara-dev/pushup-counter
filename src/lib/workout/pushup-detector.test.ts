import { describe, it, expect, beforeEach } from 'vitest';
import { PushUpDetector, PushUpState, PUSH_UP_CONFIG } from './pushup-detector';
import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';

function createLandmarks(angle: number, visible = true, isHorizontal = false): NormalizedLandmark[] {
  const landmarks = new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0 });
  const visibility = visible ? 0.9 : 0.1;
  
  // Angle for elbow
  const shoulder = { x: 0, y: 1, z: 0, visibility };
  const elbow = { x: 0, y: 0, z: 0, visibility };
  
  const rad = (angle * Math.PI) / 180;
  const wrist = {
    x: Math.sin(rad),
    y: Math.cos(rad),
    z: 0,
    visibility
  };
  
  const ankle = { x: 1, y: isHorizontal ? 1 : 2, z: 0, visibility };
  
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = shoulder;
  landmarks[POSE_LANDMARKS.LEFT_ELBOW] = elbow;
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = wrist;
  landmarks[POSE_LANDMARKS.LEFT_ANKLE] = ankle;
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.5, y: 1, z: 0, visibility };
  
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { ...shoulder, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { ...elbow, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { ...wrist, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { ...ankle, visibility };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.5, y: 1, z: 0, visibility };
  
  return landmarks;
}

describe('PushUpDetector (Side View)', () => {
  let detector: PushUpDetector;
  
  beforeEach(() => {
    detector = new PushUpDetector();
    detector.setMode("side");
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
    detector.update(createLandmarks(120, true, true), ts); // slightly DOWN (side threshold is 90)
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

describe('PushUpDetector (Front View)', () => {
  let detector: PushUpDetector;
  
  beforeEach(() => {
    detector = new PushUpDetector();
    detector.setMode("front");
  });

  const sendFrames = (det: PushUpDetector, angle: number, count: number, startTs: number) => {
    let ts = startTs;
    for (let i = 0; i < count; i++) {
      det.update(createLandmarks(angle, true, true), ts);
      ts += 33; // 30fps
    }
    return ts;
  };
  
  it('Valid: UP -> DOWN -> UP (Expected: 1)', () => {
    let ts = 0;
    ts = sendFrames(detector, 150, 10, ts); // settle UP
    ts += 100;
    ts = sendFrames(detector, 80, 10, ts); // settle DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    ts = sendFrames(detector, 150, 10, ts); // settle UP
    
    expect(detector.getCount()).toBe(1);
  });
  
  it('Two repetitions: UP -> DOWN -> UP -> DOWN -> UP (Expected: 2)', () => {
    let ts = 0;
    ts = sendFrames(detector, 150, 10, ts); // UP
    ts += 100;
    ts = sendFrames(detector, 80, 10, ts); // DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    ts = sendFrames(detector, 150, 10, ts); // UP (1)
    ts += 100;
    ts = sendFrames(detector, 80, 10, ts); // DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    ts = sendFrames(detector, 150, 10, ts); // UP (2)
    
    expect(detector.getCount()).toBe(2);
  });
  
  it('Incomplete: UP -> DOWN (Expected: 0)', () => {
    let ts = 0;
    detector.update(createLandmarks(150, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(80, true, true), ts); // DOWN
    
    expect(detector.getCount()).toBe(0);
  });
  
  it('No movement: READY -> READY -> READY (Expected: 0)', () => {
    let ts = 0;
    detector.update(createLandmarks(150, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(150, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(150, true, true), ts); // UP
    
    expect(detector.getCount()).toBe(0);
  });
  
  it('Threshold noise: small fluctuations (Expected: 0)', () => {
    let ts = 0;
    detector.update(createLandmarks(130, true, true), ts); // Not quite UP
    ts += 100;
    detector.update(createLandmarks(136, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(100, true, true), ts); // Not quite DOWN
    ts += 100;
    detector.update(createLandmarks(130, true, true), ts); // Not quite UP
    
    expect(detector.getCount()).toBe(0);
  });

  it('Mode switch preserves count', () => {
    let ts = 0;
    detector.setMode("side");
    detector.update(createLandmarks(160, true, true), ts); // UP
    ts += 100;
    detector.update(createLandmarks(80, true, true), ts); // DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    detector.update(createLandmarks(160, true, true), ts); // UP
    
    expect(detector.getCount()).toBe(1);

    // Switch to front
    detector.setMode("front");
    expect(detector.getCount()).toBe(1); // Count remains 1!
    expect(detector.getState()).toBe(PushUpState.UNKNOWN); // State resets

    // Do another rep in front mode
    ts += 100;
    ts = sendFrames(detector, 150, 10, ts); // UP
    ts += 100;
    ts = sendFrames(detector, 80, 10, ts); // DOWN
    ts += PUSH_UP_CONFIG.minRepDurationMs + 50;
    ts = sendFrames(detector, 150, 10, ts); // UP

    expect(detector.getCount()).toBe(2);
  });
});
