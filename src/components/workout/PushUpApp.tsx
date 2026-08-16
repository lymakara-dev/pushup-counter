"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import CameraView from '../camera/CameraView';
import { getPoseLandmarker } from '@/lib/pose/pose-landmarker';
import { PushUpDetector, PushUpState } from '@/lib/workout/pushup-detector';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseOverlay, PoseOverlayRef } from '../pose/PoseOverlay';
import { NormalizedLandmark } from '@/lib/pose/landmarks';

export default function PushUpApp() {
  const [isActive, setIsActive] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  
  // UI State that doesn't need to update every frame, just when count/state changes
  const [repCount, setRepCount] = useState(0);
  const [pushupState, setPushupState] = useState<PushUpState>(PushUpState.UNKNOWN);
  const [feedback, setFeedback] = useState<string>("Ready");
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<PoseOverlayRef>(null);
  const animationRef = useRef<number | null>(null);
  const detectorRef = useRef<PushUpDetector>(new PushUpDetector());
  const lastVideoTimeRef = useRef<number>(-1);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  // Load Model
  useEffect(() => {
    async function loadModel() {
      setModelLoading(true);
      try {
        const landmarker = await getPoseLandmarker();
        landmarkerRef.current = landmarker;
        setIsModelReady(true);
      } catch (err) {
        console.error("Failed to load pose model", err);
      } finally {
        setModelLoading(false);
      }
    }
    loadModel();
  }, []);

  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    startDetectionLoop();
  }, []);

  const handleCameraStop = useCallback(() => {
    setIsActive(false);
    stopDetectionLoop();
  }, []);

  const stopDetectionLoop = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    // Clear canvas
    overlayRef.current?.clear();
  };

  const startDetectionLoop = () => {
    if (!videoRef.current || !landmarkerRef.current) return;
    
    const video = videoRef.current;

    const loop = () => {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        
        const startTimeMs = performance.now();
        const results = landmarkerRef.current?.detectForVideo(video, startTimeMs);

        if (results && results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0] as NormalizedLandmark[];
          
          // Draw skeleton over video
          overlayRef.current?.drawPose(landmarks, video.videoWidth, video.videoHeight);

          // Run push-up detection
          const result = detectorRef.current.update(landmarks, startTimeMs);
          
          // Only update React state if something changed to avoid re-rendering every frame
          setRepCount(prev => {
            if (prev !== result.count) return result.count;
            return prev;
          });
          setPushupState(prev => {
            if (prev !== result.state) return result.state;
            return prev;
          });
          setFeedback(prev => {
            if (prev !== result.feedback) return result.feedback;
            return prev;
          });
        } else {
          // Pose lost
          overlayRef.current?.clear();
        }
      }
      
      if (isActive) {
        animationRef.current = requestAnimationFrame(loop);
      }
    };
    
    animationRef.current = requestAnimationFrame(loop);
  };

  const handleReset = () => {
    detectorRef.current.reset();
    setRepCount(0);
    setPushupState(PushUpState.UNKNOWN);
    setFeedback("Ready");
  };

  const handleStart = () => {
    setIsActive(true);
    handleReset();
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center p-4">
      
      {!isActive ? (
        <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-2xl w-full text-center border border-zinc-800">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-white">Push-Up Counter</h1>
          <p className="text-zinc-400 mb-8 max-w-md text-lg">
            Count your push-ups using real-time body tracking.
          </p>
          
          <div className="bg-zinc-800/50 p-4 rounded-lg mb-8 max-w-md border border-zinc-700/50">
            <p className="text-sm text-zinc-300">
              Your camera video stays on your device. Video is processed locally and never uploaded.
            </p>
          </div>
          
          {modelLoading ? (
            <div className="px-8 py-4 bg-zinc-800 text-zinc-400 font-semibold rounded-full animate-pulse">
              Loading pose detection...
            </div>
          ) : !isModelReady ? (
            <div className="px-8 py-4 bg-red-900/30 text-red-400 font-semibold rounded-full border border-red-800/50">
              Failed to load pose model
            </div>
          ) : (
            <button 
              onClick={handleStart}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-lg transition-transform hover:scale-105 active:scale-95"
            >
              Start Camera
            </button>
          )}
        </div>
      ) : (
        <div className="w-full flex flex-col gap-4">
          
          {/* Top Stats Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between bg-zinc-900 p-6 rounded-2xl border border-zinc-800 gap-4">
            <div className="flex flex-col items-center md:items-start">
              <span className="text-zinc-500 font-medium uppercase tracking-wider text-sm">Push-ups</span>
              <span className="text-6xl font-bold text-white tabular-nums leading-none">{repCount}</span>
            </div>
            
            <div className="flex flex-col items-center md:items-end">
              <span className="text-zinc-500 font-medium uppercase tracking-wider text-sm mb-1">Status</span>
              <span className={`px-4 py-2 rounded-full font-bold text-lg ${
                pushupState === PushUpState.DOWN ? 'bg-amber-500/20 text-amber-400' :
                pushupState === PushUpState.READY ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-zinc-800 text-zinc-300'
              }`}>
                {feedback}
              </span>
            </div>
          </div>

          {/* Camera Container */}
          <div className="relative w-full aspect-video md:aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-zinc-800">
            <CameraView 
              isActive={isActive} 
              onVideoReady={handleVideoReady} 
              onCameraStop={handleCameraStop} 
            />
            {/* The PoseOverlay automatically manages its own canvas drawing without React re-renders */}
            <PoseOverlay ref={overlayRef} />
            
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 z-20 px-4">
              <button 
                onClick={handleReset}
                className="px-6 py-2 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-md text-white font-medium rounded-full shadow-lg border border-zinc-600 transition-colors"
              >
                Reset
              </button>
              <button 
                onClick={handleCameraStop}
                className="px-6 py-2 bg-red-500/90 hover:bg-red-500 backdrop-blur-md text-white font-bold rounded-full shadow-lg transition-colors"
              >
                Stop Camera
              </button>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
