"use client";

import React, { useEffect, useRef, useState } from 'react';

export interface CameraViewProps {
  onVideoReady: (videoElement: HTMLVideoElement, isMirrored: boolean) => void;
  onCameraStop: () => void;
  isActive: boolean;
  isMirrored?: boolean; // Prop from parent
}

export default function CameraView({ onVideoReady, onCameraStop, isActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(true); // Default front camera

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    }
    getDevices();
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (!isActive || !videoRef.current) return;
      setError(null);

      try {
        const constraints: MediaStreamConstraints = {
          video: currentDeviceId ? { deviceId: { exact: currentDeviceId } } : { facingMode: "user" },
          audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Determine mirroring from track settings
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        let mirrored = true;
        
        // If the browser provides facingMode, use it
        if (settings.facingMode) {
          mirrored = settings.facingMode === 'user';
        } else if (track.label) {
          // Fallback heuristic based on label
          const label = track.label.toLowerCase();
          if (label.includes('back') || label.includes('environment') || label.includes('rear')) {
            mirrored = false;
          }
        }
        
        setIsMirrored(mirrored);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play();
              onVideoReady(videoRef.current, mirrored);
            }
          };
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setError("Camera access is required. Allow camera access in your browser settings and try again.");
        } else if (err.name === 'NotFoundError') {
          setError("No camera detected. Connect a webcam or use a device with a camera.");
        } else {
          setError(`Camera error: ${err.message || err.name}`);
        }
        onCameraStop();
      }
    }

    if (isActive) {
      startCamera();
    } else {
      // Cleanup
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, currentDeviceId, onVideoReady, onCameraStop]);

  const switchCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      setCurrentDeviceId(devices[nextIndex].deviceId);
    }
  };

  return (
    <div className="absolute inset-0 bg-black">
      {!isActive && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
          Camera is stopped
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black z-50">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="px-6 py-3 min-w-[44px] min-h-[44px] bg-zinc-800 rounded-full text-white font-bold hover:bg-zinc-700"
          >
            Try Again
          </button>
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
          className="absolute top-4 right-4 flex items-center justify-center w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full z-50 backdrop-blur-md transition-colors touch-manipulation"
          title="Switch Camera"
          aria-label="Switch Camera"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 Z"/></svg>
        </button>
      )}
    </div>
  );
}
