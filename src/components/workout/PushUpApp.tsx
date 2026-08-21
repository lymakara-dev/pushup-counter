"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import CameraView from '../camera/CameraView';
import { getPoseLandmarker } from '@/lib/pose/pose-landmarker';
import { PushUpDetector, PushUpState, CameraViewMode, PushUpResult } from '@/lib/workout/pushup-detector';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseOverlay, PoseOverlayRef } from '../pose/PoseOverlay';
import { NormalizedLandmark } from '@/lib/pose/landmarks';
import { validatePushUpPosition, PositionIssue } from '@/lib/workout/position-validator';
import { PositionGuide, PositionStatus } from './PositionGuide';
import { voiceGuide } from '@/lib/voice/voice-guide';
import { Language, getTranslation } from '@/lib/i18n/translations';
import { WorkoutValidationMode } from '@/lib/workout/pushup-form-validator';

import { WorkoutHeader } from './WorkoutHeader';
import { StartScreen } from './StartScreen';
import { RepCounter } from './RepCounter';
import { WorkoutStatus } from './WorkoutStatus';
import { CameraModeSwitch } from './CameraModeSwitch';
import { WorkoutControls } from './WorkoutControls';
import { FormDebugOverlay } from './FormDebugOverlay';

export type AppState = "CAMERA_OFF" | "LOADING_MODEL" | "POSITIONING" | "READY" | "WORKOUT" | "PAUSED";

export default function PushUpApp() {
  const [appState, setAppState] = useState<AppState>("CAMERA_OFF");
  const [isModelReady, setIsModelReady] = useState(false);
  const [positionIssueKey, setPositionIssueKey] = useState<PositionIssue | "PERFECT_POSITION" | "POSE_LOST" | "">("NO_PERSON");
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>("front");
  const [validationMode, setValidationMode] = useState<WorkoutValidationMode>("strict");
  const [lang, setLang] = useState<Language>("en");
  const [showDebug, setShowDebug] = useState<boolean>(false);
  
  // UI State that updates on reps or state changes
  const [repCount, setRepCount] = useState(0);
  const [pushupState, setPushupState] = useState<PushUpState>(PushUpState.UNKNOWN);
  const [feedbackKey, setFeedbackKey] = useState<string>("READY");
  const [liveDebugResult, setLiveDebugResult] = useState<PushUpResult | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<PoseOverlayRef>(null);
  const animationRef = useRef<number | null>(null);
  const detectorRef = useRef<PushUpDetector>(new PushUpDetector("strict"));
  const lastVideoTimeRef = useRef<number>(-1);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  const appStateRef = useRef<AppState>("CAMERA_OFF");
  const readyStartTimeRef = useRef<number>(0);
  const invalidStartTimeRef = useRef<number>(0);
  const isMirroredRef = useRef<boolean>(true);
  const prevPushUpStateRef = useRef<PushUpState>(PushUpState.UNKNOWN);
  const prevRepCountRef = useRef<number>(0);
  const poseLostTimeRef = useRef<number>(0);
  const cameraModeRef = useRef<CameraViewMode>("front");

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
  };

  const handleValidationModeToggle = () => {
    const nextMode: WorkoutValidationMode = validationMode === "strict" ? "standard" : "strict";
    setValidationMode(nextMode);
    detectorRef.current.setValidationMode(nextMode);
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
            wasVideoReady = false;
          }
          if (appStateRef.current !== "CAMERA_OFF" && appStateRef.current !== "LOADING_MODEL") {
            animationRef.current = requestAnimationFrame(loop);
          }
          return;
        }

        if (!wasVideoReady) {
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
                     readyStartTimeRef.current = 0;
                  }
               } else {
                  setPositionIssueKey("");
                  invalidStartTimeRef.current = 0;
               }
               
               // Strict Anti-Cheat Form Detection
               const result = detectorRef.current.update(landmarks, startTimeMs);
               
               if (process.env.NODE_ENV !== 'production') {
                 setLiveDebugResult(result);
               }

               if (prevPushUpStateRef.current !== result.state) {
                 if (result.state === PushUpState.DOWN) {
                   voiceGuide.speakKey("DOWN", true);
                   setFeedbackKey("DOWN");
                 } else if (result.state === PushUpState.READY && prevPushUpStateRef.current === PushUpState.DOWN) {
                   if (result.valid && result.repCompleted) {
                     voiceGuide.speakKey("UP", true);
                     setFeedbackKey("UP");
                   } else if (result.primaryFeedbackKey) {
                     voiceGuide.speakKey(result.primaryFeedbackKey as any, true);
                     setFeedbackKey(result.primaryFeedbackKey);
                   } else {
                     voiceGuide.speakKey("UP", true);
                     setFeedbackKey("UP");
                   }
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

  // Get primary localized feedback string for workout status pill
  const getWorkoutFeedbackDisplay = (): string => {
    if (appState !== "WORKOUT") {
      const val = t[appState as keyof typeof t];
      return typeof val === 'string' ? val : appState;
    }
    if (feedbackKey) {
      const val = t[feedbackKey as keyof typeof t];
      if (typeof val === 'string') return val;
    }
    return feedbackKey;
  };

  return (
    <div className="w-full flex justify-center bg-[#09090b] min-h-[100dvh]">
      {appState === "CAMERA_OFF" || appState === "LOADING_MODEL" ? (
        <StartScreen
          t={t}
          lang={lang}
          onLanguageChange={toggleLanguage}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoice}
          validationMode={validationMode}
          onToggleValidationMode={handleValidationModeToggle}
          isModelReady={isModelReady}
          isLoadingModel={appState === "LOADING_MODEL"}
          onStart={handleStart}
          isVoiceUnavailable={voiceGuide.isVoiceUnavailable()}
        />
      ) : (
        <div
          className="w-full h-[100dvh] max-w-4xl mx-auto flex flex-col justify-between overflow-hidden relative select-none"
          style={{
            paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          {/* Header */}
          <WorkoutHeader
            lang={lang}
            onLanguageChange={toggleLanguage}
            voiceEnabled={voiceEnabled}
            onToggleVoice={toggleVoice}
            validationMode={validationMode}
            onToggleValidationMode={handleValidationModeToggle}
            isVoiceUnavailable={voiceGuide.isVoiceUnavailable()}
            showDebug={showDebug}
            onToggleDebug={() => setShowDebug(!showDebug)}
            disableVoiceLabel={t.disableVoice}
            enableVoiceLabel={t.enableVoice}
            strictLabel={t.modeStrict}
            standardLabel={t.modeStandard}
          />

          {/* Central Camera Viewport */}
          <div className="flex-1 w-full relative px-3 sm:px-6 my-1 min-h-[220px] max-h-[55vh] sm:max-h-[62vh] flex items-center justify-center">
            <div className="w-full h-full relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-zinc-800/60 shadow-2xl">
              <CameraView
                isActive={true}
                onVideoReady={handleVideoReady}
                onCameraStop={handleCameraStop}
                isMirrored={isMirrored}
              />

              <PoseOverlay ref={overlayRef} />
              
              <PositionGuide
                appState={appState}
                positionMessage={appState === "PAUSED" ? t.pausedText(positionMessage) : positionMessage}
                bodyAreaText={t.BODY_AREA}
              />
              
              <PositionStatus appState={appState} positionMessage={positionMessage} />

              {/* Dev Debug Overlay */}
              {process.env.NODE_ENV !== 'production' && showDebug && (
                <FormDebugOverlay cameraMode={cameraMode} result={liveDebugResult} />
              )}
            </div>
          </div>

          {/* Bottom Controls & Metrics Section */}
          <div className="flex-none w-full px-4 pt-2 pb-1 sm:pb-3 flex flex-col items-center gap-2 sm:gap-3 z-30">
            {/* Rep Counter */}
            <RepCounter
              count={repCount}
              label={t.pushUps}
              isActive={appState === 'WORKOUT'}
            />

            {/* Workout Status Badge */}
            <WorkoutStatus
              appState={appState}
              pushupState={pushupState}
              feedbackKey={feedbackKey}
              statusText={getWorkoutFeedbackDisplay()}
            />

            {/* View Mode Switcher */}
            <CameraModeSwitch
              currentMode={cameraMode}
              onModeChange={handleModeSwitch}
              frontLabel={t.frontView}
              sideLabel={t.sideView}
            />

            {/* Secondary Controls (Reset & Stop) */}
            <WorkoutControls
              onReset={handleReset}
              onStop={handleCameraStop}
              resetLabel={t.reset}
              stopLabel={t.stopCamera}
            />
          </div>
        </div>
      )}
    </div>
  );
}
