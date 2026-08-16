"use client";

import React, { useEffect, useRef, useState } from 'react';

export interface CameraViewProps {
  onVideoReady: (videoElement: HTMLVideoElement) => void;
  onCameraStop: () => void;
  isActive: boolean;
}

export default function CameraView({ onVideoReady, onCameraStop, isActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

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
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play();
              onVideoReady(videoRef.current);
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
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-900 rounded-xl overflow-hidden">
      {!isActive && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
          Camera is stopped
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-zinc-900 z-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="px-4 py-2 bg-zinc-800 rounded-md text-white hover:bg-zinc-700"
          >
            Try Again
          </button>
        </div>
      )}
      
      <video
        ref={videoRef}
        className={`w-full h-full object-cover ${isActive && !error ? 'opacity-100' : 'opacity-0'} transform -scale-x-100`}
        autoPlay
        playsInline
        muted
      />
      
      {isActive && devices.length > 1 && !error && (
        <button
          onClick={switchCamera}
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full z-10 backdrop-blur-sm transition-colors"
          title="Switch Camera"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 Z"/></svg>
        </button>
      )}
    </div>
  );
}
