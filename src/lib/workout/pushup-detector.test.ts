import { describe, it, expect, beforeEach } from 'vitest';
import { PushUpDetector, PushUpState } from './pushup-detector';
import { NormalizedLandmark, POSE_LANDMARKS } from '../pose/landmarks';

function createSideLandmarks(options: {
  elbowAngle: number;
  shoulderY?: number;
  hipY?: number;
  ankleY?: number;
  visibility?: number;
}): NormalizedLandmark[] {
  const visibility = options.visibility ?? 0.95;
  const shoulderY = options.shoulderY ?? 0.35;
  const hipY = options.hipY ?? shoulderY;
  const ankleY = options.ankleY ?? shoulderY;
  const shoulderX = 0.25;
  const hipX = 0.55;
  const ankleX = 0.85;

  const elbowX = shoulderX;
  const elbowY = shoulderY + 0.15;

  const rad = (options.elbowAngle * Math.PI) / 180;
  const wristX = elbowX + 0.15 * Math.sin(rad);
  const wristY = elbowY - 0.15 * Math.cos(rad);

  const landmarks = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));

  const lShoulder = { x: shoulderX, y: shoulderY, z: 0, visibility };
  const lElbow = { x: elbowX, y: elbowY, z: 0, visibility };
  const lWrist = { x: wristX, y: wristY, z: 0, visibility };
  const lHip = { x: hipX, y: hipY, z: 0, visibility };
  const lAnkle = { x: ankleX, y: ankleY, z: 0, visibility };

  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = lShoulder;
  landmarks[POSE_LANDMARKS.LEFT_ELBOW] = lElbow;
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = lWrist;
  landmarks[POSE_LANDMARKS.LEFT_HIP] = lHip;
  landmarks[POSE_LANDMARKS.LEFT_ANKLE] = lAnkle;

  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { ...lShoulder, visibility: 0.1 };
  landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { ...lElbow, visibility: 0.1 };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { ...lWrist, visibility: 0.1 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { ...lHip, visibility: 0.1 };
  landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { ...lAnkle, visibility: 0.1 };

  return landmarks;
}

function createFrontLandmarks(options: {
  leftElbowAngle: number;
  rightElbowAngle: number;
  shoulderMidY?: number;
  visibility?: number;
}): NormalizedLandmark[] {
  const visibility = options.visibility ?? 0.95;
  const midY = options.shoulderMidY ?? 0.35;
  const landmarks = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));

  const ls = { x: 0.45, y: midY, z: 0, visibility };
  const rs = { x: 0.55, y: midY, z: 0, visibility };

  const le = { x: 0.30, y: midY, z: 0, visibility };
  const re = { x: 0.70, y: midY, z: 0, visibility };

  const lRad = (options.leftElbowAngle * Math.PI) / 180;
  const rRad = (options.rightElbowAngle * Math.PI) / 180;

  const lw = {
    x: le.x + 0.15 * Math.cos(lRad),
    y: le.y + 0.15 * Math.sin(lRad),
    z: 0,
    visibility
  };
  const rw = {
    x: re.x - 0.15 * Math.cos(rRad),
    y: re.y + 0.15 * Math.sin(rRad),
    z: 0,
    visibility
  };

  const lh = { x: 0.45, y: midY + 0.3, z: 0, visibility };
  const rh = { x: 0.55, y: midY + 0.3, z: 0, visibility };

  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = ls;
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = rs;
  landmarks[POSE_LANDMARKS.LEFT_ELBOW] = le;
  landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = re;
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = lw;
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = rw;
  landmarks[POSE_LANDMARKS.LEFT_HIP] = lh;
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = rh;

  return landmarks;
}

const sendSideFrames = (
  det: PushUpDetector,
  elbowAngle: number,
  shoulderY: number,
  frameCount: number,
  startTs: number,
  extraOptions: Partial<Parameters<typeof createSideLandmarks>[0]> = {}
) => {
  let ts = startTs;
  for (let i = 0; i < frameCount; i++) {
    det.update(createSideLandmarks({ elbowAngle, shoulderY, ...extraOptions }), ts);
    ts += 33; // ~30fps
  }
  return ts;
};

const sendFrontFrames = (
  det: PushUpDetector,
  leftElbow: number,
  rightElbow: number,
  shoulderY: number,
  frameCount: number,
  startTs: number,
  extraOptions: Partial<Parameters<typeof createFrontLandmarks>[0]> = {}
) => {
  let ts = startTs;
  for (let i = 0; i < frameCount; i++) {
    det.update(createFrontLandmarks({ leftElbowAngle: leftElbow, rightElbowAngle: rightElbow, shoulderMidY: shoulderY, ...extraOptions }), ts);
    ts += 33;
  }
  return ts;
};

describe('Strict PushUpDetector (Side View Anti-Cheat)', () => {
  let detector: PushUpDetector;

  beforeEach(() => {
    detector = new PushUpDetector('strict');
    detector.setMode('side');
  });

  it('Valid Rep: READY -> DOWN (full flexion + torso travel) -> UP (full extension) => Count +1', () => {
    let ts = 0;
    // 1. Settle in READY (top: 160 deg, shoulderY = 0.35)
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    expect(detector.getState()).toBe(PushUpState.READY);

    // 2. Transition DOWN (bottom: 80 deg, shoulderY = 0.55 -> good travel)
    ts += 300;
    ts = sendSideFrames(detector, 80, 0.55, 8, ts);
    expect(detector.getState()).toBe(PushUpState.DOWN);

    // 3. Return UP (top: 160 deg, shoulderY = 0.35) with valid duration > 500ms
    ts += 400;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);

    expect(detector.getState()).toBe(PushUpState.READY);
    expect(detector.getCount()).toBe(1);
  });

  it('Two Valid Reps: Full cycle x2 => Count 2', () => {
    let ts = 0;
    // Rep 1
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    ts += 300;
    ts = sendSideFrames(detector, 80, 0.55, 8, ts);
    ts += 400;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    expect(detector.getCount()).toBe(1);

    // Rep 2
    ts += 300;
    ts = sendSideFrames(detector, 80, 0.55, 8, ts);
    ts += 400;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    expect(detector.getCount()).toBe(2);
  });

  it('Anti-Cheat: Partial Rep / Insufficient ROM (shallow 120 deg) => Rejected (Count 0)', () => {
    let ts = 0;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    ts += 300;
    // Shallow bottom: 120 deg (does not reach <= 100)
    ts = sendSideFrames(detector, 120, 0.40, 8, ts);
    ts += 400;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);

    expect(detector.getCount()).toBe(0);
  });

  it('Anti-Cheat: Arm-Only Movement (elbows flex but shoulder/torso does not move) => Rejected (Count 0)', () => {
    let ts = 0;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    ts += 300;
    // Elbow flexes to 80 deg, BUT shoulder stays exactly at 0.35 (zero torso travel)
    ts = sendSideFrames(detector, 80, 0.35, 8, ts);
    ts += 400;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);

    expect(detector.getCount()).toBe(0);
  });

  it('Anti-Cheat: Rapid Bouncing / Too Fast (< 500ms duration) => Rejected (Count 0)', () => {
    let ts = 0;
    ts = sendSideFrames(detector, 160, 0.35, 5, ts);
    ts += 50; // Only 50ms transition
    ts = sendSideFrames(detector, 80, 0.55, 3, ts);
    ts += 50; // Total rep duration ~200ms
    ts = sendSideFrames(detector, 160, 0.35, 5, ts);

    expect(detector.getCount()).toBe(0);
  });

  it('Anti-Cheat: Low Landmark Visibility (< 0.5) => Rejected (Count 0)', () => {
    let ts = 0;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    ts += 300;
    // Landmarks drop visibility to 0.2 during down
    ts = sendSideFrames(detector, 80, 0.55, 8, ts, { visibility: 0.2 });
    ts += 400;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);

    expect(detector.getCount()).toBe(0);
  });

  it('Anti-Cheat: Severe Body Alignment Issue / Sagging Hips => Rejected (Count 0)', () => {
    let ts = 0;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    ts += 300;
    // Hip severely sagging down to 0.8 while shoulder is at 0.5
    ts = sendSideFrames(detector, 80, 0.50, 8, ts, { hipY: 0.85 });
    ts += 400;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);

    expect(detector.getCount()).toBe(0);
  });

  it('Threshold Jitter / Noise around 140-150 deg => No False Reps', () => {
    let ts = 0;
    ts = sendSideFrames(detector, 145, 0.35, 3, ts);
    ts += 50;
    ts = sendSideFrames(detector, 138, 0.36, 3, ts);
    ts += 50;
    ts = sendSideFrames(detector, 148, 0.35, 3, ts);

    expect(detector.getCount()).toBe(0);
  });
});

describe('Strict PushUpDetector (Front View Anti-Cheat)', () => {
  let detector: PushUpDetector;

  beforeEach(() => {
    detector = new PushUpDetector('strict');
    detector.setMode('front');
  });

  it('Valid Front Rep: Bilateral Arm Flexion + Torso Travel => Count +1', () => {
    let ts = 0;
    // Settle UP (145 deg both arms, shoulderMidY = 0.35)
    ts = sendFrontFrames(detector, 145, 145, 0.35, 8, ts);
    expect(detector.getState()).toBe(PushUpState.READY);

    // Down (85 deg both arms, shoulderMidY = 0.55)
    ts += 300;
    ts = sendFrontFrames(detector, 85, 85, 0.55, 8, ts);
    expect(detector.getState()).toBe(PushUpState.DOWN);

    // Return UP
    ts += 400;
    ts = sendFrontFrames(detector, 145, 145, 0.35, 8, ts);

    expect(detector.getState()).toBe(PushUpState.READY);
    expect(detector.getCount()).toBe(1);
  });

  it('Anti-Cheat: Front View Arm Asymmetry (one arm moves 50%, other stationary) => Rejected (Count 0)', () => {
    let ts = 0;
    ts = sendFrontFrames(detector, 145, 145, 0.35, 8, ts);
    ts += 300;
    // Left arm bends to 80 deg, Right arm stays at 145 deg
    ts = sendFrontFrames(detector, 80, 145, 0.45, 8, ts);
    ts += 400;
    ts = sendFrontFrames(detector, 145, 145, 0.35, 8, ts);

    expect(detector.getCount()).toBe(0);
  });

  it('Anti-Cheat: Front View Arm-Only Movement (torso stationary) => Rejected (Count 0)', () => {
    let ts = 0;
    ts = sendFrontFrames(detector, 145, 145, 0.35, 8, ts);
    ts += 300;
    // Both arms bend to 85 deg, BUT shoulderMidY stays at 0.35
    ts = sendFrontFrames(detector, 85, 85, 0.35, 8, ts);
    ts += 400;
    ts = sendFrontFrames(detector, 145, 145, 0.35, 8, ts);

    expect(detector.getCount()).toBe(0);
  });

  it('Mode switch from Side to Front preserves workout rep count', () => {
    let ts = 0;
    detector.setMode('side');
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    ts += 300;
    ts = sendSideFrames(detector, 80, 0.55, 8, ts);
    ts += 400;
    ts = sendSideFrames(detector, 160, 0.35, 8, ts);
    expect(detector.getCount()).toBe(1);

    // Switch to Front
    detector.setMode('front');
    expect(detector.getCount()).toBe(1);

    // Rep 2 in Front mode
    ts += 300;
    ts = sendFrontFrames(detector, 145, 145, 0.35, 8, ts);
    ts += 300;
    ts = sendFrontFrames(detector, 85, 85, 0.55, 8, ts);
    ts += 400;
    ts = sendFrontFrames(detector, 145, 145, 0.35, 8, ts);

    expect(detector.getCount()).toBe(2);
  });
});

describe('Default Standard Mode PushUpDetector', () => {
  it('instantiates in standard validation mode by default', () => {
    const detector = new PushUpDetector();
    expect(detector.getValidationMode()).toBe('standard');
  });

  it('validates reps with standard thresholds by default', () => {
    const detector = new PushUpDetector();
    detector.setMode('side');

    let ts = 0;
    // Settle in READY (top: 145 deg, shoulderY = 0.35)
    ts = sendSideFrames(detector, 145, 0.35, 8, ts);
    expect(detector.getState()).toBe(PushUpState.READY);

    // Transition DOWN (bottom: 102 deg, shoulderY = 0.50 -> standard bottom <= 105 deg)
    ts += 300;
    ts = sendSideFrames(detector, 102, 0.50, 8, ts);
    expect(detector.getState()).toBe(PushUpState.DOWN);

    // Return UP (top: 145 deg)
    ts += 400;
    ts = sendSideFrames(detector, 145, 0.35, 8, ts);

    expect(detector.getState()).toBe(PushUpState.READY);
    expect(detector.getCount()).toBe(1);
  });
});

