import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { NormalizedLandmark } from '@/lib/pose/landmarks';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { calculateAngle } from '@/lib/pose/pose-utils';
import { POSE_LANDMARKS } from '@/lib/pose/landmarks';

export interface PoseOverlayRef {
  drawPose: (landmarks: NormalizedLandmark[], videoWidth: number, videoHeight: number, isMirrored: boolean) => void;
  clear: () => void;
}

const MIN_LANDMARK_VISIBILITY = 0.5;

const IMPORTANT_JOINTS = new Set([
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.LEFT_ELBOW,
  POSE_LANDMARKS.LEFT_WRIST,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.RIGHT_ELBOW,
  POSE_LANDMARKS.RIGHT_WRIST,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP
]);

export const PoseOverlay = forwardRef<PoseOverlayRef, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMirroredRef = useRef<boolean>(true); // track latest mirror state for CSS class

  useImperativeHandle(ref, () => ({
    drawPose: (landmarks, videoWidth, videoHeight, isMirrored) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Ensure intrinsic size matches the video exactly for precise 1:1 mapping
      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }
      
      // Update mirror styling
      if (isMirroredRef.current !== isMirrored) {
        isMirroredRef.current = isMirrored;
        if (isMirrored) {
          canvas.style.transform = 'scaleX(-1)';
        } else {
          canvas.style.transform = 'none';
        }
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!landmarks || landmarks.length === 0) return;

      // Make line width responsive
      const baseLineWidth = Math.max(2, Math.min(canvas.width, canvas.height) * 0.005);

      // Draw connections
      ctx.lineWidth = baseLineWidth;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // thin white lines
      
      PoseLandmarker.POSE_CONNECTIONS.forEach((connection) => {
        const start = landmarks[connection.start];
        const end = landmarks[connection.end];

        if (
          start && end &&
          (start.visibility || 0) > MIN_LANDMARK_VISIBILITY &&
          (end.visibility || 0) > MIN_LANDMARK_VISIBILITY
        ) {
          ctx.beginPath();
          ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
          ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw landmarks
      landmarks.forEach((landmark, index) => {
        if ((landmark.visibility || 0) > MIN_LANDMARK_VISIBILITY) {
          const isImportant = IMPORTANT_JOINTS.has(index);
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;
          
          ctx.beginPath();
          ctx.arc(x, y, isImportant ? baseLineWidth * 2.5 : baseLineWidth * 1.5, 0, 2 * Math.PI);
          
          ctx.fillStyle = isImportant ? '#10b981' : 'rgba(255, 255, 255, 0.9)'; // Emerald
          ctx.fill();
          
          ctx.lineWidth = isImportant ? 2 : 1;
          ctx.strokeStyle = isImportant ? '#ffffff' : '#cbd5e1';
          ctx.stroke();
        }
      });

      // Draw angles for elbows if visible
      const drawAngleText = (shoulderIdx: number, elbowIdx: number, wristIdx: number) => {
        const shoulder = landmarks[shoulderIdx];
        const elbow = landmarks[elbowIdx];
        const wrist = landmarks[wristIdx];

        if (
          shoulder && elbow && wrist &&
          (shoulder.visibility || 0) > MIN_LANDMARK_VISIBILITY &&
          (elbow.visibility || 0) > MIN_LANDMARK_VISIBILITY &&
          (wrist.visibility || 0) > MIN_LANDMARK_VISIBILITY
        ) {
          const angle = Math.round(calculateAngle(shoulder, elbow, wrist));
          
          ctx.save();
          ctx.translate(elbow.x * canvas.width, elbow.y * canvas.height);
          if (isMirrored) {
            ctx.scale(-1, 1); // Flip text back if mirrored
          }
          
          // Make text size responsive to video scale
          const fontSize = Math.max(16, Math.min(canvas.width, canvas.height) * 0.03);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(3, fontSize * 0.2);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          
          ctx.strokeText(`${angle}°`, 0, -10);
          ctx.fillText(`${angle}°`, 0, -10);
          
          ctx.restore();
        }
      };

      drawAngleText(POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST);
      drawAngleText(POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST);
    },
    
    clear: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }));

  // Initial transform class is -scale-x-100, we update dynamically via DOM
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10 transform scale-x-[-1]"
    />
  );
});

PoseOverlay.displayName = 'PoseOverlay';
