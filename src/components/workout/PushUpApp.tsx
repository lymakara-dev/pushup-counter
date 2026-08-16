"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import CameraView from '../camera/CameraView';
import { getPoseLandmarker } from '@/lib/pose/pose-landmarker';
import { PushUpDetector, PushUpState } from '@/lib/workout/pushup-detector';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseOverlay, PoseOverlayRef } from '../pose/PoseOverlay';
import { NormalizedLandmark } from '@/lib/pose/landmarks';
import { validatePushUpPosition } from '@/lib/workout/position-validator';
import { PositionGuide, PositionStatus } from './PositionGuide';
import { voiceGuide, VOICE_MESSAGES, VoicePriority } from '@/lib/voice/voice-guide';

export type AppState = "CAMERA_OFF" | "LOADING_MODEL" | "POSITIONING" | "READY" | "WORKOUT" | "PAUSED";

export default function PushUpApp() {
  const [appState, setAppState] = useState<AppState>("CAMERA_OFF");
  const [isModelReady, setIsModelReady] = useState(false);
  const [positionMessage, setPositionMessage] = useState<string>("Looking for your body...");
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true); // will sync on mount
  
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

  const appStateRef = useRef<AppState>("CAMERA_OFF");
  const readyStartTimeRef = useRef<number>(0);
  const invalidStartTimeRef = useRef<number>(0);
  // Ref tracking mirror state to avoid closure staleness without re-adding deps to loop
  const isMirroredRef = useRef<boolean>(true);
  const prevPushUpStateRef = useRef<PushUpState>(PushUpState.UNKNOWN);
  const prevRepCountRef = useRef<number>(0);
  const poseLostTimeRef = useRef<number>(0);

  const syncAppState = (newState: AppState) => {
    setAppState(newState);
    appStateRef.current = newState;
  };

  useEffect(() => {
    setVoiceEnabled(voiceGuide.isEnabled());
  }, []);

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    voiceGuide.setEnabled(newState);
  };

  // Load Model
  useEffect(() => {
    async function loadModel() {
      syncAppState("LOADING_MODEL");
      try {
        const landmarker = await getPoseLandmarker();
        landmarkerRef.current = landmarker;
        setIsModelReady(true);
        if (appStateRef.current === "LOADING_MODEL") {
          syncAppState("CAMERA_OFF");
        }
      } catch (err) {
        console.error("Failed to load pose model", err);
        syncAppState("CAMERA_OFF");
      }
    }
    loadModel();
  }, []);

  const handleVideoReady = useCallback((video: HTMLVideoElement, mirrored: boolean) => {
    videoRef.current = video;
    setIsMirrored(mirrored);
    isMirroredRef.current = mirrored;
    syncAppState("POSITIONING");
    startDetectionLoop();
  }, []);

  const handleCameraStop = useCallback(() => {
    syncAppState("CAMERA_OFF");
    voiceGuide.cancel();
    stopDetectionLoop();
  }, []);

  const stopDetectionLoop = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
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
          poseLostTimeRef.current = 0; // reset pose lost tracker
          const landmarks = results.landmarks[0] as NormalizedLandmark[];
          
          overlayRef.current?.drawPose(landmarks, video.videoWidth, video.videoHeight, isMirroredRef.current);

          const position = validatePushUpPosition(landmarks);

          if (appStateRef.current === "POSITIONING" || appStateRef.current === "READY") {
             if (position.ready) {
                if (readyStartTimeRef.current === 0) {
                   readyStartTimeRef.current = startTimeMs;
                   syncAppState("READY");
                   voiceGuide.speak(VOICE_MESSAGES.PERFECT_POSITION.text, VOICE_MESSAGES.PERFECT_POSITION.priority);
                   voiceGuide.speak(VOICE_MESSAGES.READY.text, VOICE_MESSAGES.READY.priority);
                   setPositionMessage("Hold still...");
                } else if (startTimeMs - readyStartTimeRef.current > 1000) {
                   syncAppState("WORKOUT");
                   voiceGuide.speak(VOICE_MESSAGES.GO.text, VOICE_MESSAGES.GO.priority, true);
                   setPositionMessage("");
                   detectorRef.current.reset(); // ensure fresh start
                   prevPushUpStateRef.current = PushUpState.UNKNOWN;
                   prevRepCountRef.current = 0;
                } else {
                   setPositionMessage("Perfect position. Hold still...");
                }
             } else {
                readyStartTimeRef.current = 0;
                syncAppState("POSITIONING");
                setPositionMessage(position.message);
                if (position.issue && VOICE_MESSAGES[position.issue]) {
                   voiceGuide.speak(VOICE_MESSAGES[position.issue].text, VOICE_MESSAGES[position.issue].priority);
                }
             }
          } else if (appStateRef.current === "WORKOUT") {
             if (!position.ready) {
                setPositionMessage(position.message);
                if (position.issue && VOICE_MESSAGES[position.issue]) {
                   voiceGuide.speak(VOICE_MESSAGES[position.issue].text, VOICE_MESSAGES[position.issue].priority);
                }
                
                if (invalidStartTimeRef.current === 0) {
                   invalidStartTimeRef.current = startTimeMs;
                } else if (startTimeMs - invalidStartTimeRef.current > 2000) {
                   syncAppState("PAUSED");
                   readyStartTimeRef.current = 0; // prepare for resuming
                }
             } else {
                setPositionMessage("");
                invalidStartTimeRef.current = 0;
             }
             
             const result = detectorRef.current.update(landmarks, startTimeMs);
             
             if (prevPushUpStateRef.current !== result.state) {
               if (result.state === PushUpState.DOWN) {
                 voiceGuide.speak(VOICE_MESSAGES.DOWN.text, VOICE_MESSAGES.DOWN.priority, true);
               } else if (result.state === PushUpState.READY && prevPushUpStateRef.current === PushUpState.DOWN) {
                 voiceGuide.speak(VOICE_MESSAGES.UP.text, VOICE_MESSAGES.UP.priority, true);
               }
               prevPushUpStateRef.current = result.state;
               setPushupState(result.state);
             }

             if (prevRepCountRef.current !== result.count) {
               voiceGuide.speakRep(result.count);
               prevRepCountRef.current = result.count;
               setRepCount(result.count);
             }
             
             setFeedback(prev => (prev !== result.feedback ? result.feedback : prev));

          } else if (appStateRef.current === "PAUSED") {
             setPositionMessage(position.message);
             if (position.ready) {
                if (readyStartTimeRef.current === 0) {
                   readyStartTimeRef.current = startTimeMs;
                   setPositionMessage("Hold still to resume...");
                } else if (startTimeMs - readyStartTimeRef.current > 1000) {
                   syncAppState("WORKOUT");
                   invalidStartTimeRef.current = 0;
                   setPositionMessage("");
                   voiceGuide.speak(VOICE_MESSAGES.GO.text, VOICE_MESSAGES.GO.priority, true);
                } else {
                   setPositionMessage("Perfect position. Resuming...");
                }
             } else {
                readyStartTimeRef.current = 0;
                if (position.issue && VOICE_MESSAGES[position.issue]) {
                   voiceGuide.speak(VOICE_MESSAGES[position.issue].text, VOICE_MESSAGES[position.issue].priority);
                }
             }
          }
        } else {
          // Pose lost
          overlayRef.current?.clear();
          setPositionMessage("Pose not detected");
          readyStartTimeRef.current = 0;
          
          if (poseLostTimeRef.current === 0) {
             poseLostTimeRef.current = startTimeMs;
          } else if (startTimeMs - poseLostTimeRef.current > 1000) {
             voiceGuide.speak(VOICE_MESSAGES.POSE_LOST.text, VOICE_MESSAGES.POSE_LOST.priority);
          }
          
          if (appStateRef.current === "WORKOUT") {
             if (invalidStartTimeRef.current === 0) invalidStartTimeRef.current = startTimeMs;
             else if (startTimeMs - invalidStartTimeRef.current > 2000) syncAppState("PAUSED");
          }
        }
      }
      
      if (appStateRef.current !== "CAMERA_OFF" && appStateRef.current !== "LOADING_MODEL") {
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
    syncAppState("POSITIONING");
    readyStartTimeRef.current = 0;
    invalidStartTimeRef.current = 0;
    prevPushUpStateRef.current = PushUpState.UNKNOWN;
    prevRepCountRef.current = 0;
    voiceGuide.cancel();
    voiceGuide.speak(VOICE_MESSAGES.RESET.text, VOICE_MESSAGES.RESET.priority, true);
  };

  const handleStart = () => {
    if (!isModelReady) return;
    // Wake up speech synthesis on user interaction
    voiceGuide.speak("", VoicePriority.LOW, true);
    syncAppState("POSITIONING");
    handleReset();
  };

  // Add scroll lock for body when workout is active
  useEffect(() => {
    if (appState !== "CAMERA_OFF" && appState !== "LOADING_MODEL") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [appState]);

  return (
    <div className="w-full flex justify-center bg-black min-h-[100dvh]">
      {appState === "CAMERA_OFF" || appState === "LOADING_MODEL" ? (
        <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center p-6 text-center min-h-[80dvh]">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-white">Push-Up Counter</h1>
          <p className="text-zinc-400 mb-8 max-w-md text-lg">
            Count your push-ups using real-time body tracking.
          </p>
          
          <div className="bg-zinc-800/50 p-4 rounded-lg mb-8 max-w-md border border-zinc-700/50">
            <p className="text-sm text-zinc-300">
              Your camera video stays on your device. Video is processed locally and never uploaded.
            </p>
          </div>
          
          {appState === "LOADING_MODEL" ? (
            <div className="px-8 py-4 bg-zinc-800 text-zinc-400 font-semibold rounded-full animate-pulse">
              Loading pose detection...
            </div>
          ) : !isModelReady ? (
            <div className="px-8 py-4 bg-red-900/30 text-red-400 font-semibold rounded-full border border-red-800/50">
              Failed to load pose model
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <button 
                onClick={handleStart}
                className="px-8 py-4 min-h-[56px] min-w-[200px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-lg transition-transform hover:scale-105 active:scale-95 touch-manipulation"
              >
                Start Camera
              </button>
              
              <button 
                onClick={toggleVoice}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
              >
                {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="fixed inset-0 sm:relative sm:w-full sm:max-w-md lg:max-w-4xl sm:h-[90dvh] sm:min-h-[600px] sm:my-8 bg-black sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
          
          {/* Header */}
          <div 
            className="flex-none p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent"
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <h1 className="text-xl font-bold text-white tracking-tight drop-shadow-md">Push-Up Counter</h1>
            <button
              onClick={toggleVoice}
              className="w-12 h-12 flex items-center justify-center text-white/80 hover:text-white bg-black/30 rounded-full backdrop-blur-sm transition-colors"
              aria-label={voiceEnabled ? "Disable Voice" : "Enable Voice"}
            >
              {voiceEnabled ? "🔊" : "🔇"}
            </button>
          </div>
          
          {/* Camera Area - takes remaining space */}
          <div className="flex-1 relative w-full overflow-hidden flex flex-col justify-end">
            <CameraView 
              isActive={true} 
              onVideoReady={handleVideoReady} 
              onCameraStop={handleCameraStop} 
              isMirrored={isMirrored}
            />
            
            <PoseOverlay ref={overlayRef} />
            <PositionGuide appState={appState} positionMessage={positionMessage} />
            <PositionStatus appState={appState} positionMessage={positionMessage} />
            
            {/* Overlaid UI inside Camera Area */}
            <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col items-center justify-end z-30 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none">
              
              {/* Rep Counter */}
              <div className="flex flex-col items-center mb-6">
                 <span className={`text-[6rem] md:text-[8rem] leading-none font-black tabular-nums tracking-tighter drop-shadow-2xl ${appState === 'WORKOUT' ? 'text-white' : 'text-white/50'}`}>
                   {repCount}
                 </span>
                 <span className="text-sm md:text-base font-bold tracking-widest uppercase text-white/80 drop-shadow-md mt-2">Push-Ups</span>
              </div>

              {/* Status Indicator */}
              <div className={`px-8 py-3 rounded-full font-bold text-xl md:text-2xl backdrop-blur-xl shadow-2xl border ${
                  appState !== 'WORKOUT' ? 'bg-zinc-800/80 text-zinc-300 border-zinc-600' :
                  pushupState === PushUpState.DOWN ? 'bg-amber-500/90 text-black border-amber-400' :
                  pushupState === PushUpState.READY ? 'bg-emerald-500/90 text-black border-emerald-400' :
                  'bg-zinc-800/80 text-zinc-300 border-zinc-600'
                }`}>
                 {appState === "WORKOUT" ? feedback : appState}
              </div>

            </div>
          </div>
          
          {/* Bottom Controls */}
          <div 
            className="flex-none p-6 pt-4 bg-black flex justify-center gap-4 z-20"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
             <button 
               onClick={handleReset} 
               className="w-16 h-16 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors active:scale-95 touch-manipulation"
               aria-label="Reset Workout"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
             </button>
             <button 
               onClick={handleCameraStop} 
               className="flex-1 max-w-[250px] h-16 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full transition-colors active:scale-95 touch-manipulation text-xl"
             >
               Stop Camera
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
