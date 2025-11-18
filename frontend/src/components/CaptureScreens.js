// FILE: frontend/src/components/CaptureScreen.js

import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const CaptureScreen = ({ setAppState, onSuccess, onError, error, debugImage }) => {
  const [isPreview, setIsPreview] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const webcamRef = useRef(null);
  const videoConstraints = { width: 1280, height: 720, facingMode: "environment" };

  const processImage = async (imageFile) => {
    if (!imageFile) return;
    setAppState('loading');

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await axios.post('http://192.168.100.56:5000/api/process-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.error) {
        onError(response.data.error, response.data.debugImage);
      } else {
        onSuccess(response.data);
      }
    } catch (err) {
      onError(err.response?.data?.error || 'An unknown network error occurred.');
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setIsPreview(true);
    }
  }, [webcamRef]);

  const proceedWithCapturedImage = async () => {
    if (capturedImage) {
      const blob = await fetch(capturedImage).then(res => res.blob());
      const file = new File([blob], "capture.jpeg", { type: "image/jpeg" });
      processImage(file);
    }
  };

  const onFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processImage(e.target.files[0]);
    }
  };
  
  const retakePhoto = () => {
    setCapturedImage(null);
    setIsPreview(false);
  };

  return (
    <>
      {error && (<div className="error-container"><p className="error">Error: {error}</p></div>)}
      {debugImage && (
        <div className="debug-image-container">
          <h3>Preprocessing Result (Debug View)</h3>
          <p>This is what the OCR script "saw". If digits are not clear and whole, the OCR will fail.</p>
          <img src={debugImage} alt="Debug OCR Result" className="debug-image" />
        </div>
      )}

      <div className="camera-container">
        {isPreview ? (
          <img src={capturedImage} alt="Captured Preview" />
        ) : (
          <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" screenshotQuality={0.98} videoConstraints={videoConstraints} className="webcam" />
        )}
        {!isPreview && <div className="roi-overlay-auto"></div>}
        {!isPreview && <p className="instructions">Center the device in the frame and capture</p>}
      </div>

      <div className="controls">
        {isPreview ? (
          <div className="preview-controls">
            <button onClick={proceedWithCapturedImage}>Yes, Process Photo</button>
            <button onClick={retakePhoto} className="cancel-btn">Retake</button>
          </div>
        ) : (
          <>
            <button onClick={capture}>Capture Photo</button>
            <p>OR</p>
            <input type="file" accept="image/*" onChange={onFileChange} />
            <p>OR</p>
            <button onClick={() => setAppState('manual_entry')}>Enter Manually</button>
          </>
        )}
      </div>
    </>
  );
};

export default CaptureScreen;