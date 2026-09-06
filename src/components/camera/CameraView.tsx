"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface CameraViewProps {
  onVideoReady: (videoElement: HTMLVideoElement, isMirrored: boolean) => void;
  onCameraStop: () => void;
  isActive: boolean;
  isMirrored?: boolean;
  errorPermission?: string;
  errorNotFound?: string;
  errorGeneric?: string;
  tryAgainLabel?: string;
  switchCameraLabel?: string;
}

export default function CameraView({
  onVideoReady,
  onCameraStop,
  isActive,
  errorPermission = "Camera access is required. Allow camera access in your browser settings and try again.",
  errorNotFound = "No camera detected. Connect a webcam or use a device with a camera.",
  errorGeneric = "Camera error",
  tryAgainLabel = "Try Again",
  switchCameraLabel = "Switch Camera",
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(true);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const refreshDevices = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devList.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, []);

  // Initial device enumeration and change listener
  useEffect(() => {
    refreshDevices();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  useEffect(() => {
    let isCancelled = false;
    let activeStream: MediaStream | null = null;
    const currentVideo = videoRef.current;

    async function startCamera() {
      if (!isActive || !currentVideo) return;
      setError(null);

      try {
        const constraints: MediaStreamConstraints = {
          video: currentDeviceId
            ? { deviceId: { ideal: currentDeviceId } }
            : { facingMode: "user" },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (isCancelled) {
          // Component unmounted or camera stopped while getUserMedia was resolving
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        activeStream = stream;

        // Refresh device list now that permissions have been granted
        refreshDevices();

        // Determine mirroring from track settings
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings();
        let mirrored = true;

        if (settings?.facingMode) {
          mirrored = settings.facingMode === 'user';
        } else if (track?.label) {
          const label = track.label.toLowerCase();
          if (label.includes('back') || label.includes('environment') || label.includes('rear')) {
            mirrored = false;
          }
        }

        setIsMirrored(mirrored);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (isCancelled || !videoRef.current) return;
            videoRef.current.play().catch(() => {});
            onVideoReady(videoRef.current, mirrored);
          };
        }
      } catch (err: any) {
        if (isCancelled) return;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError(errorPermission);
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError(errorNotFound);
        } else if (err.name === 'OverconstrainedError' && currentDeviceId) {
          // Fallback if ideal deviceId is unavailable
          setCurrentDeviceId(null);
        } else {
          setError(`${errorGeneric}: ${err.message || err.name}`);
        }
      }
    }

    if (isActive) {
      startCamera();
    }

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (currentVideo) {
        currentVideo.onloadedmetadata = null;
        if (currentVideo.srcObject) {
          const s = currentVideo.srcObject as MediaStream;
          s.getTracks().forEach(t => t.stop());
          currentVideo.srcObject = null;
        }
      }
    };
  }, [isActive, currentDeviceId, retryTrigger, onVideoReady, refreshDevices, errorPermission, errorNotFound, errorGeneric]);

  const switchCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      setCurrentDeviceId(devices[nextIndex].deviceId);
    }
  };

  const handleRetry = () => {
    setError(null);
    setRetryTrigger(prev => prev + 1);
  };

  return (
    <div className="absolute inset-0 bg-black">
      {!isActive && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500 select-none">
          Camera is stopped
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black z-50 select-none">
          <p className="text-red-400 mb-4 max-w-sm text-sm sm:text-base leading-relaxed">{error}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              className="px-6 py-3 min-w-[44px] min-h-[44px] bg-zinc-800 rounded-full text-white font-bold hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer"
            >
              {tryAgainLabel}
            </button>
            <button
              onClick={onCameraStop}
              className="px-6 py-3 min-w-[44px] min-h-[44px] bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white active:scale-95 transition-all cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        className={`w-full h-full object-cover transition-opacity duration-300 ${isActive && !error ? 'opacity-100' : 'opacity-0'} ${isMirrored ? 'scale-x-[-1]' : ''}`}
        autoPlay
        playsInline
        muted
      />

      {isActive && devices.length > 1 && !error && (
        <button
          onClick={switchCamera}
          className="absolute top-4 right-4 flex items-center justify-center w-12 h-12 min-w-[44px] min-h-[44px] bg-black/60 hover:bg-black/80 text-white rounded-full z-50 backdrop-blur-md transition-colors touch-manipulation cursor-pointer border border-white/20 shadow-lg"
          title={switchCameraLabel}
          aria-label={switchCameraLabel}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 Z"/></svg>
        </button>
      )}
    </div>
  );
}
