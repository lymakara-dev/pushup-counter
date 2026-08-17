"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import CameraView from '../camera/CameraView';
import { getPoseLandmarker } from '@/lib/pose/pose-landmarker';
import { PushUpDetector, PushUpState, CameraViewMode } from '@/lib/workout/pushup-detector';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseOverlay, PoseOverlayRef } from '../pose/PoseOverlay';
import { NormalizedLandmark } from '@/lib/pose/landmarks';
import { validatePushUpPosition, PositionIssue } from '@/lib/workout/position-validator';
import { PositionGuide, PositionStatus } from './PositionGuide';
import { voiceGuide, VoicePriority, VOICE_PRIORITIES } from '@/lib/voice/voice-guide';
import { Language, getTranslation } from '@/lib/i18n/translations';

export type AppState = "CAMERA_OFF" | "LOADING_MODEL" | "POSITIONING" | "READY" | "WORKOUT" | "PAUSED";

export default function PushUpApp() {
  const [appState, setAppState] = useState<AppState>("CAMERA_OFF");
  const [isModelReady, setIsModelReady] = useState(false);
  const [positionIssueKey, setPositionIssueKey] = useState<PositionIssue | "PERFECT_POSITION" | "POSE_LOST" | "">("NO_PERSON");
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>("side");
  const [lang, setLang] = useState<Language>("en");
  
  // UI State that doesn't need to update every frame, just when count/state changes
  const [repCount, setRepCount] = useState(0);
  const [pushupState, setPushupState] = useState<PushUpState>(PushUpState.UNKNOWN);
  const [feedbackKey, setFeedbackKey] = useState<"READY" | "DOWN" | "UP">("READY");
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<PoseOverlayRef>(null);
  const animationRef = useRef<number | null>(null);
  const detectorRef = useRef<PushUpDetector>(new PushUpDetector());
  const lastVideoTimeRef = useRef<number>(-1);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  const appStateRef = useRef<AppState>("CAMERA_OFF");
  const readyStartTimeRef = useRef<number>(0);
  const invalidStartTimeRef = useRef<number>(0);
  const isMirroredRef = useRef<boolean>(true);
  const prevPushUpStateRef = useRef<PushUpState>(PushUpState.UNKNOWN);
  const prevRepCountRef = useRef<number>(0);
  const poseLostTimeRef = useRef<number>(0);
  const cameraModeRef = useRef<CameraViewMode>("side");

  const syncAppState = (newState: AppState) => {
    setAppState(newState);
    appStateRef.current = newState;
  };

  useEffect(() => {
    // Initial Hydration
    if (typeof window !== 'undefined') {
      setVoiceEnabled(voiceGuide.isEnabled());
      const storedLang = localStorage.getItem('pushup_lang');
      if (storedLang === 'km' || storedLang === 'en') {
        setLang(storedLang as Language);
        voiceGuide.setLanguage(storedLang as Language);
      }
    }
  }, []);

  const t = getTranslation(lang);

  const toggleLanguage = (newLang: Language) => {
    setLang(newLang);
    voiceGuide.setLanguage(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pushup_lang', newLang);
    }
  };

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    voiceGuide.setEnabled(newState);
  };

  const handleModeSwitch = (mode: CameraViewMode) => {
    setCameraMode(mode);
    cameraModeRef.current = mode;
    detectorRef.current.setMode(mode);
    syncAppState("POSITIONING");
    prevPushUpStateRef.current = PushUpState.UNKNOWN;
    setPushupState(PushUpState.UNKNOWN);
    // Voice feedback on mode switch isn't required by prompt, removing to keep it clean.
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
    let wasVideoReady = true;

    const loop = () => {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        
        const startTimeMs = performance.now();
        
        // Video Readiness Guard
        if (
          !video ||
          video.readyState < 2 || // HTMLMediaElement.HAVE_CURRENT_DATA
          video.videoWidth <= 0 ||
          video.videoHeight <= 0
        ) {
          if (wasVideoReady) {
            console.log(`[Pose] Detection paused, video dimensions are ${video ? video.videoWidth : 0}x${video ? video.videoHeight : 0}`);
            console.log(`[Pose] Video not ready (readyState: ${video ? video.readyState : 'N/A'}, videoWidth: ${video ? video.videoWidth : 'N/A'}, videoHeight: ${video ? video.videoHeight : 'N/A'})`);
            wasVideoReady = false;
          }
          if (appStateRef.current !== "CAMERA_OFF" && appStateRef.current !== "LOADING_MODEL") {
            animationRef.current = requestAnimationFrame(loop);
          }
          return;
        }

        if (!wasVideoReady) {
          console.log(`[Pose] Video ready, dimensions ${video.videoWidth}x${video.videoHeight}`);
          wasVideoReady = true;
        }

        try {
          const results = landmarkerRef.current?.detectForVideo(video, startTimeMs);

          if (results && results.landmarks && results.landmarks.length > 0) {
          poseLostTimeRef.current = 0;
          const landmarks = results.landmarks[0] as NormalizedLandmark[];
          
          overlayRef.current?.drawPose(landmarks, video.videoWidth, video.videoHeight, isMirroredRef.current);

          const position = validatePushUpPosition(landmarks, cameraModeRef.current);

          if (appStateRef.current === "POSITIONING" || appStateRef.current === "READY") {
             if (position.ready) {
                if (readyStartTimeRef.current === 0) {
                   readyStartTimeRef.current = startTimeMs;
                   syncAppState("READY");
                   voiceGuide.speakKey("PERFECT_POSITION");
                   voiceGuide.speakKey("READY");
                   setPositionIssueKey("PERFECT_POSITION");
                } else if (startTimeMs - readyStartTimeRef.current > 1000) {
                   syncAppState("WORKOUT");
                   voiceGuide.speakKey("GO", true);
                   setPositionIssueKey("");
                   prevPushUpStateRef.current = PushUpState.UNKNOWN;
                }
             } else {
                readyStartTimeRef.current = 0;
                syncAppState("POSITIONING");
                if (position.issue) {
                   setPositionIssueKey(position.issue);
                   voiceGuide.speakKey(position.issue as any);
                }
             }
          } else if (appStateRef.current === "WORKOUT") {
             if (!position.ready) {
                if (position.issue) {
                   setPositionIssueKey(position.issue);
                   voiceGuide.speakKey(position.issue as any);
                }
                
                if (invalidStartTimeRef.current === 0) {
                   invalidStartTimeRef.current = startTimeMs;
                } else if (startTimeMs - invalidStartTimeRef.current > 2000) {
                   syncAppState("PAUSED");
                   readyStartTimeRef.current = 0; // prepare for resuming
                }
             } else {
                setPositionIssueKey("");
                invalidStartTimeRef.current = 0;
             }
             
             const result = detectorRef.current.update(landmarks, startTimeMs);
             
             if (prevPushUpStateRef.current !== result.state) {
               if (result.state === PushUpState.DOWN) {
                 voiceGuide.speakKey("DOWN", true);
                 setFeedbackKey("DOWN");
               } else if (result.state === PushUpState.READY && prevPushUpStateRef.current === PushUpState.DOWN) {
                 voiceGuide.speakKey("UP", true);
                 setFeedbackKey("UP");
               }
               prevPushUpStateRef.current = result.state;
               setPushupState(result.state);
             }

             if (prevRepCountRef.current !== result.count) {
               voiceGuide.speakRep(result.count);
               prevRepCountRef.current = result.count;
               setRepCount(result.count);
             }

          } else if (appStateRef.current === "PAUSED") {
             if (position.issue) setPositionIssueKey(position.issue);
             if (position.ready) {
                if (readyStartTimeRef.current === 0) {
                   readyStartTimeRef.current = startTimeMs;
                   setPositionIssueKey("PERFECT_POSITION");
                } else if (startTimeMs - readyStartTimeRef.current > 1000) {
                   syncAppState("WORKOUT");
                   invalidStartTimeRef.current = 0;
                   setPositionIssueKey("");
                   voiceGuide.speakKey("GO", true);
                }
             } else {
                readyStartTimeRef.current = 0;
                if (position.issue) {
                   voiceGuide.speakKey(position.issue as any);
                }
             }
          }
        } else {
          // Pose lost
          overlayRef.current?.clear();
          setPositionIssueKey("POSE_LOST");
          readyStartTimeRef.current = 0;
          
          if (poseLostTimeRef.current === 0) {
             poseLostTimeRef.current = startTimeMs;
          } else if (startTimeMs - poseLostTimeRef.current > 1000) {
             voiceGuide.speakKey("POSE_LOST");
          }
          
          if (appStateRef.current === "WORKOUT") {
             if (invalidStartTimeRef.current === 0) invalidStartTimeRef.current = startTimeMs;
             else if (startTimeMs - invalidStartTimeRef.current > 2000) syncAppState("PAUSED");
          }
        }
      } catch (error) {
        console.error("[Pose] Detection error", error);
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
    setFeedbackKey("READY");
    syncAppState("POSITIONING");
    readyStartTimeRef.current = 0;
    invalidStartTimeRef.current = 0;
    prevPushUpStateRef.current = PushUpState.UNKNOWN;
    prevRepCountRef.current = 0;
    voiceGuide.cancel();
    voiceGuide.speakKey("RESET", true);
  };

  const handleStart = () => {
    if (!isModelReady) return;
    voiceGuide.preload();
    syncAppState("POSITIONING");
  };

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

  const positionMessage = positionIssueKey ? t[positionIssueKey as keyof typeof t] as string : "";

  return (
    <div className="w-full flex justify-center bg-black min-h-[100dvh]">
      {appState === "CAMERA_OFF" || appState === "LOADING_MODEL" ? (
        <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center p-6 text-center min-h-[80dvh]">
          
          <div className="absolute top-4 right-4 flex bg-zinc-900 rounded-full border border-zinc-800 p-1">
             <button onClick={() => toggleLanguage('en')} className={`px-4 py-1.5 text-sm font-bold rounded-full transition-colors ${lang === 'en' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}>EN</button>
             <button onClick={() => toggleLanguage('km')} className={`px-4 py-1.5 text-sm font-bold rounded-full transition-colors ${lang === 'km' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}>ខ្មែរ</button>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-white">{t.appName}</h1>
          <p className="text-zinc-400 mb-8 max-w-md text-lg">{t.appDescription}</p>
          
          <div className="bg-zinc-800/50 p-4 rounded-lg mb-8 max-w-md border border-zinc-700/50">
            <p className="text-sm text-zinc-300">{t.privacyMessage}</p>
          </div>
          
          {appState === "LOADING_MODEL" ? (
            <div className="px-8 py-4 bg-zinc-800 text-zinc-400 font-semibold rounded-full animate-pulse">
              {t.loadingModel}
            </div>
          ) : !isModelReady ? (
            <div className="px-8 py-4 bg-red-900/30 text-red-400 font-semibold rounded-full border border-red-800/50">
              {t.failedToLoadModel}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <button 
                onClick={handleStart}
                className="px-8 py-4 min-h-[56px] min-w-[200px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-lg transition-transform hover:scale-105 active:scale-95 touch-manipulation"
              >
                {t.startCamera}
              </button>
              
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={toggleVoice}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                >
                  {voiceEnabled ? t.voiceOn : t.voiceOff}
                </button>
                {voiceGuide.isVoiceUnavailable() && voiceEnabled && (
                  <span className="text-xs text-amber-500">Khmer voice unavailable / ឧបករណ៍នេះមិនមានសំឡេងខ្មែរទេ</span>
                )}
              </div>
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
            <h1 className="text-xl font-bold text-white tracking-tight drop-shadow-md">{t.appName}</h1>
            <div className="flex items-center gap-2">
              <div className="flex bg-black/30 rounded-full p-0.5 backdrop-blur-sm">
                 <button onClick={() => toggleLanguage('en')} className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${lang === 'en' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}>EN</button>
                 <button onClick={() => toggleLanguage('km')} className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${lang === 'km' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}>ខ្មែរ</button>
              </div>
              <button
                onClick={toggleVoice}
                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white bg-black/30 rounded-full backdrop-blur-sm transition-colors"
                aria-label={voiceEnabled ? t.disableVoice : t.enableVoice}
              >
                {voiceEnabled ? "🔊" : "🔇"}
              </button>
            </div>
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
            <PositionGuide appState={appState} positionMessage={appState === "PAUSED" ? t.pausedText(positionMessage) : positionMessage} bodyAreaText={t.BODY_AREA} />
            <PositionStatus appState={appState} positionMessage={positionMessage} />
            
            {/* Overlaid UI inside Camera Area */}
            <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col items-center justify-end z-30 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none">
              
              {/* Rep Counter */}
              <div className="flex flex-col items-center mb-6">
                 <span className={`text-[6rem] md:text-[8rem] leading-none font-black tabular-nums tracking-tighter drop-shadow-2xl ${appState === 'WORKOUT' ? 'text-white' : 'text-white/50'}`}>
                   {repCount}
                 </span>
                 <span className="text-sm md:text-base font-bold tracking-widest uppercase text-white/80 drop-shadow-md mt-2">{t.pushUps}</span>
              </div>

              {/* Status Indicator */}
              <div className={`px-8 py-3 rounded-full font-bold text-xl md:text-2xl backdrop-blur-xl shadow-2xl border ${
                  appState !== 'WORKOUT' ? 'bg-zinc-800/80 text-zinc-300 border-zinc-600' :
                  pushupState === PushUpState.DOWN ? 'bg-amber-500/90 text-black border-amber-400' :
                  pushupState === PushUpState.READY ? 'bg-emerald-500/90 text-black border-emerald-400' :
                  'bg-zinc-800/80 text-zinc-300 border-zinc-600'
                }`}>
                 {appState === "WORKOUT" ? t[feedbackKey] : ((t[appState as keyof typeof t] as string) || appState)}
              </div>

            </div>
          </div>
          
          {/* Bottom Controls */}
          <div 
            className="flex-none p-6 pt-4 bg-black flex flex-col gap-4 z-20"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {/* View Mode Switcher */}
            <div className="flex p-1 bg-zinc-900 rounded-full border border-zinc-800 w-full max-w-[300px] mx-auto mb-2">
              <button
                onClick={() => handleModeSwitch("side")}
                className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${cameraMode === "side" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                {t.sideView}
              </button>
              <button
                onClick={() => handleModeSwitch("front")}
                className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors ${cameraMode === "front" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                {t.frontView}
              </button>
            </div>

            <div className="flex justify-center gap-4">
              <button 
                onClick={handleReset} 
                className="w-16 h-16 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors active:scale-95 touch-manipulation"
                aria-label={t.reset}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <button 
                onClick={handleCameraStop} 
                className="flex-1 max-w-[250px] h-16 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full transition-colors active:scale-95 touch-manipulation text-xl"
              >
                {t.stopCamera}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
