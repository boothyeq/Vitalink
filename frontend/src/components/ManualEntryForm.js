// FILE: frontend/src/components/ManualEntryForm.js

import React, { useState } from 'react';
import axios from 'axios';

const ManualEntryForm = ({ onSuccess, onCancel }) => {
  // State for all possible form fields
  const [spo2, setSpo2] = useState('');
  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState('');
  const [medicationTaken, setMedicationTaken] = useState(false);
  const [symptoms, setSymptoms] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const payload = {
      spo2: spo2 || null,
      weight: weight || null,
      steps: steps || null,
      medicationTaken: medicationTaken,
      symptoms: symptoms || null,
    };

    try {
        await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/add-manual-event`, payload);
        // For manual entry, we construct a simple result object for the results screen
        const manualResult = {
            spo2: spo2 || null,
            weight: weight || null,
            steps: steps || null,
            medicationTaken: medicationTaken,
            symptoms: symptoms || null,
        };
        onSuccess(manualResult);
    } catch (err) {
        setError(err.response?.data?.error || 'Failed to save data.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="manual-entry-container">
      <h3>Enter Other Health Data</h3>
      <form onSubmit={handleSubmit} className="manual-form">
        <div className="form-group"><label>SpO2 (%)</label><input type="number" value={spo2} onChange={e => setSpo2(e.target.value)} /></div>
        <div className="form-group"><label>Weight (kg)</label><input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} /></div>
        <div className="form-group"><label>Step Count</label><input type="number" value={steps} onChange={e => setSteps(e.target.value)} /></div>
        <div className="form-group-checkbox"><label>Did you take your medication?</label><input type="checkbox" checked={medicationTaken} onChange={e => setMedicationTaken(e.target.checked)} /></div>
        <div className="form-group-textarea"><label>Describe your symptoms</label><textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} /></div>
        {error && <p className="error" style={{textAlign: 'center'}}>{error}</p>}
        <div className="manual-form-controls">
          <button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Submit'}</button>
          <button type="button" onClick={onCancel} className="cancel-btn">Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default ManualEntryForm;