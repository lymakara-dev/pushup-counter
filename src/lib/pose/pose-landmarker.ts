import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let poseLandmarkerInstance: PoseLandmarker | null = null;
let initPromise: Promise<PoseLandmarker> | null = null;

export async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarkerInstance) {
    return poseLandmarkerInstance;
  }
  
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = new Promise(async (resolve, reject) => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      );
      
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/pose_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      
      poseLandmarkerInstance = landmarker;
      resolve(landmarker);
    } catch (error) {
      console.warn("Failed to initialize with GPU delegate. Falling back to CPU...", error);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        poseLandmarkerInstance = landmarker;
        resolve(landmarker);
      } catch (fallbackError) {
        reject(fallbackError);
      }
    }
  });
  
  return initPromise;
}
