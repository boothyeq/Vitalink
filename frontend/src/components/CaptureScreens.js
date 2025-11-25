import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import correctImage from '../assets/correct_image.jpeg';
import slantedImage from '../assets/slanted_image.jpg';

const CaptureScreen = ({ setAppState, onSuccess, onError, error, debugImage, onReset }) => {
  const [isPreview, setIsPreview] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showInstructionsPopup, setShowInstructionsPopup] = useState(false);
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoConstraints = { width: 1280, height: 720, facingMode: "environment" };

  const [pendingAction, setPendingAction] = useState(null);
  const [currentView, setCurrentView] = useState('main_menu'); // 'main_menu', 'bp_options', 'camera_view', 'manual_bp', 'manual_other'

  const handleOptionClick = (actionType) => {
    setPendingAction(actionType);
    setShowInstructionsPopup(true);
  };

  const handleContinue = () => {
    setShowInstructionsPopup(false);
    if (pendingAction === 'camera') {
      setShowCamera(true);
      setCurrentView('camera_view');
    } else if (pendingAction === 'gallery') {
      fileInputRef.current && fileInputRef.current.click();
    } else if (pendingAction === 'manual_bp') {
      setAppState('manual_entry'); // This will trigger the ManualEntryForm
    }
    setPendingAction(null);
  };

  const handleRecordBloodPressure = () => {
    setCurrentView('bp_options');
  };

  const handleRecordOtherReadings = () => {
    setAppState('manual_entry'); // This will trigger the ManualEntryForm for other readings
  };

  const processImage = async (imageFile) => {
    if (!imageFile) return;

    setAppState('loading');


    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/process-image`, formData, {
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

      {debugImage && (
        <div className="debug-image-container">
          <h3>Preprocessing Result (Debug View)</h3>
          <p>This is what the OCR script "saw". If digits are not clear and whole, the OCR will fail.</p>
          <img src={debugImage} alt="Debug OCR Result" className="debug-image" />
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error} Please ensure the blood pressure machine is not slanted and is clearly visible.</p>
          <button onClick={onReset}>Try Again</button>
        </div>
      )}

      {showInstructionsPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h2>How to take a good picture</h2>
            <p>Please center the blood pressure measuring machine and ensure it's facing upright, not slanted. This helps our system accurately read the values.</p>
            <div className="image-examples">
              <div className="example-image">
                <h3>✓ Correct:</h3>
                <img src={correctImage} alt="Correctly taken image" />
              </div>
              <div className="example-image">
                <h3>✗ Incorrect (Slanted):</h3>
                <img src={slantedImage} alt="Slanted image" />
              </div>
            </div>
            <button onClick={handleContinue} className="continue-button">Got It / Continue</button>
          </div>
        </div>
      )}

      {showCamera && (
        <div className="camera-container">
          {isPreview ? (
            <img src={capturedImage} alt="Captured Preview" />
          ) : (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.98}
              videoConstraints={videoConstraints}
              className="webcam"
            />
          )}
          {!isPreview && <div className="roi-overlay-auto"></div>}
          {!isPreview && <p className="instructions">Center the device in the frame and capture</p>}
        </div>
      )}

      <div className="controls">
        {currentView === 'main_menu' && (
          <div className="option-buttons">
            <button onClick={handleRecordBloodPressure}>
              <span className="btn-icon" aria-hidden="true">
                {/* Blood Pressure icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"></path></svg>
              </span>
              Record Blood Pressure Reading
            </button>
            <button onClick={handleRecordOtherReadings}>
              <span className="btn-icon" aria-hidden="true">
                {/* Other Readings icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"></path></svg>
              </span>
              Record Other Readings
            </button>
          </div>
        )}

        {currentView === 'bp_options' && (
          <div className="option-buttons">
            <button onClick={() => handleOptionClick('camera')}>
              <span className="btn-icon" aria-hidden="true">
                {/* camera icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path></svg>
              </span>
              Capture Using Camera
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
            <button onClick={() => handleOptionClick('gallery')}>
              <span className="btn-icon" aria-hidden="true">
                {/* gallery icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-4 10l3.5-4.5 2.5 3 3.5-4.5L20 17H6z"></path></svg>
              </span>
              Upload From Gallery
            </button>
            <button onClick={() => handleOptionClick('manual_bp')}>
              <span className="btn-icon" aria-hidden="true">
                {/* manual/edit icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>
              </span>
              Enter Manually
            </button>
            <button onClick={() => setCurrentView('main_menu')} className="cancel-btn">Back to Main Menu</button>
          </div>
        )}

        {currentView === 'camera_view' && showCamera && isPreview && (
          <div className="preview-controls">
            <button onClick={proceedWithCapturedImage}>Yes, Process Photo</button>
            <button onClick={retakePhoto} className="cancel-btn">Retake</button>
          </div>
        )}

        {currentView === 'camera_view' && showCamera && !isPreview && (
          <div className="preview-controls">
            <button onClick={capture}>
              <span className="btn-icon" aria-hidden="true">
                {/* camera icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path></svg>
              </span>
              Capture Photo
            </button>
            <button onClick={() => setCurrentView('bp_options')} className="cancel-btn">Cancel</button>
          </div>
        )}
      </div>
    </>
  );
};

export default CaptureScreen;