import React, { useRef, useState, useEffect } from 'react';

interface CameraCaptureProps {
  onPhotoTaken: (photoBlob: Blob, photoDataUrl: string) => void;
  onClose: () => void;
}

export function CameraCapture({ onPhotoTaken, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');

  const startCamera = async (facing: 'user' | 'environment' = 'environment') => {
    try {
      setError('');

      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Force vertical orientation for Instax-style photos
      const constraints = {
        video: {
          facingMode: facing,
          width: { ideal: 600, min: 400, max: 800 },   // Force narrower width
          height: { ideal: 955, min: 700, max: 1200 }  // Force taller height
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        // Debug: Log actual video track settings
        videoRef.current.onloadedmetadata = () => {
          console.log('Video stream loaded:', {
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight,
            aspectRatio: (videoRef.current?.videoWidth || 0) / (videoRef.current?.videoHeight || 1)
          });

          // Also log track settings
          const videoTrack = mediaStream.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings();
            console.log('Video track settings:', settings);
          }
        };
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setHasPermission(false);
      setError('Cannot access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const switchCamera = () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Force Instax Mini portrait orientation (54:86 ratio)
    const instaxRatio = 54 / 86; // 0.628 (width/height) - portrait ratio

    // FORCE exact Instax dimensions regardless of video input
    const outputWidth = 600;
    const outputHeight = 955; // Exact Instax portrait height

    // Explicitly set canvas size
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    console.log('FORCED canvas dimensions:', {
      width: canvas.width,
      height: canvas.height,
      ratio: canvas.width / canvas.height
    });

    console.log('Camera dimensions:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      outputWidth,
      outputHeight
    });

    // For MacBook cameras (typically landscape), we need to crop and rotate
    const videoAspectRatio = video.videoWidth / video.videoHeight;

    let sourceWidth, sourceHeight, sourceX, sourceY;

    if (videoAspectRatio > 1) {
      // Video is landscape (like MacBook camera), crop to portrait
      sourceHeight = video.videoHeight;
      sourceWidth = sourceHeight * instaxRatio; // Make it narrower for portrait
      sourceX = (video.videoWidth - sourceWidth) / 2;
      sourceY = 0;
    } else {
      // Video is already portrait, crop to Instax ratio
      sourceWidth = video.videoWidth;
      sourceHeight = sourceWidth / instaxRatio;
      sourceX = 0;
      sourceY = (video.videoHeight - sourceHeight) / 2;
    }

    // Draw cropped video frame to canvas in portrait orientation
    ctx.drawImage(
      video,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, outputWidth, outputHeight
    );

    // Debug: Log final canvas dimensions
    console.log('Final canvas dimensions:', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      aspectRatio: canvas.width / canvas.height
    });

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        console.log('Blob created:', {
          size: blob.size,
          type: blob.type
        });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        onPhotoTaken(blob, dataUrl);
      }
      setIsCapturing(false);
    }, 'image/jpeg', 0.9);

    // Simulate camera flash effect
    const flashOverlay = document.createElement('div');
    flashOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      z-index: 9999;
      pointer-events: none;
      opacity: 0.8;
    `;
    document.body.appendChild(flashOverlay);

    setTimeout(() => {
      document.body.removeChild(flashOverlay);
    }, 100);
  };

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, []);

  if (hasPermission === false) {
    return (
      <div className="camera-error">
        <div className="error-content">
          <div className="error-icon">📷</div>
          <h2>Camera Access Required</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={() => startCamera(facingMode)} className="retry-button">
              Try Again
            </button>
            <button onClick={onClose} className="close-button">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hasPermission === null) {
    return (
      <div className="camera-loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Requesting camera access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="camera-capture">
      <div className="camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
        />

        <canvas
          ref={canvasRef}
          className="camera-canvas"
          style={{ display: 'none' }}
        />

        <div className="camera-overlay">
          <div className="camera-header">
            <button
              onClick={onClose}
              className="camera-close"
              disabled={isCapturing}
            >
              ✕
            </button>
            <h2>📸 Instax Mini</h2>
            <button
              onClick={switchCamera}
              className="camera-switch"
              disabled={isCapturing}
            >
              🔄
            </button>
          </div>

          <div className="camera-controls">
            <div className="camera-grid">
              <div className="grid-line grid-line-h grid-line-1"></div>
              <div className="grid-line grid-line-h grid-line-2"></div>
              <div className="grid-line grid-line-v grid-line-1"></div>
              <div className="grid-line grid-line-v grid-line-2"></div>
            </div>

            <div className="camera-actions">
              <div></div>
              <button
                onClick={capturePhoto}
                className={`capture-button ${isCapturing ? 'capturing' : ''}`}
                disabled={isCapturing}
              >
                <div className="capture-inner"></div>
              </button>
              <div className="camera-info">
                <span className="facing-mode">
                  {facingMode === 'user' ? '🤳' : '📸'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}