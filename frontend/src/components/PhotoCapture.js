import React, { useState, useRef, useCallback } from 'react';
import { Icons } from './Icons';

function PhotoCapture({ onPhotoCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      setError('Could not access camera. Please ensure camera permissions are granted.');
      console.error('Camera error:', err);
    }
  }, []);

  React.useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageDataUrl);

    // Stop the video stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const usePhoto = () => {
    if (!capturedImage) return;

    // Convert data URL to File
    fetch(capturedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onPhotoCapture(file, capturedImage);
        onClose();
      });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          width: '100%',
          marginBottom: '16px'
        }}>
          <h2 style={{ margin: 0 }}>Take Photo</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ 
          position: 'relative',
          width: '100%',
          maxWidth: '640px',
          background: '#000',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden'
        }}>
          {!capturedImage ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ 
                width: '100%',
                display: 'block'
              }}
            />
          ) : (
            <img 
              src={capturedImage} 
              alt="Captured" 
              style={{ 
                width: '100%',
                display: 'block'
              }} 
            />
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginTop: '16px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {!capturedImage ? (
            <>
              <button 
                className="btn btn-primary btn-lg"
                onClick={capturePhoto}
                disabled={!!error}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Icons.Camera size={18} /> Capture
              </button>
              <button 
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn btn-success btn-lg"
                onClick={usePhoto}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Icons.Check size={18} /> Use This Photo
              </button>
              <button 
                className="btn btn-secondary"
                onClick={retake}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Icons.Refresh size={16} /> Retake
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhotoCapture;
