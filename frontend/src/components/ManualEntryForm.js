// FILE: frontend/src/components/ManualEntryForm.js

import React, { useState } from 'react';
import axios from 'axios';

const ManualEntryForm = ({ onSuccess, onCancel }) => {
  const [eventType, setEventType] = useState('blood_pressure');
  
  // State for all possible form fields
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [pulse, setPulse] = useState('');
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

    let payload = { type: eventType };

    // Build the payload based on the selected event type
    switch (eventType) {
        case 'blood_pressure':
            payload = { ...payload, value1: sys, value2: dia, value3: pulse };
            break;
        case 'spo2':
            payload = { ...payload, value1: spo2 };
            break;
        case 'weight':
            payload = { ...payload, value1: weight };
            break;
        case 'steps':
            payload = { ...payload, value1: steps };
            break;
        case 'medication':
            payload = { ...payload, valueBool: medicationTaken };
            break;
        case 'symptoms':
            payload = { ...payload, valueText: symptoms };
            break;
        default:
            setError('Invalid event type selected.');
            setIsLoading(false);
            return;
    }

    try {
        await axios.post('http://192.168.1.15:5000/api/add-manual-event', payload);
        // For manual entry, we construct a simple result object for the results screen
        const manualResult = {
            sys: sys || null,
            dia: dia || null,
            pulse: pulse || null,
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

  // Helper to render the correct form fields
  const renderFormFields = () => {
    switch (eventType) {
      case 'blood_pressure':
        return (
          <>
            <div className="form-group"><label>SYS</label><input type="number" value={sys} onChange={e => setSys(e.target.value)} required /></div>
            <div className="form-group"><label>DIA</label><input type="number" value={dia} onChange={e => setDia(e.target.value)} required /></div>
            <div className="form-group"><label>PULSE</label><input type="number" value={pulse} onChange={e => setPulse(e.target.value)} required /></div>
          </>
        );
      case 'spo2':
        return <div className="form-group"><label>SpO2 (%)</label><input type="number" value={spo2} onChange={e => setSpo2(e.target.value)} required /></div>;
      case 'weight':
        return <div className="form-group"><label>Weight (kg)</label><input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} required /></div>;
      case 'steps':
        return <div className="form-group"><label>Step Count</label><input type="number" value={steps} onChange={e => setSteps(e.target.value)} required /></div>;
      case 'medication':
        return <div className="form-group-checkbox"><label>Did you take your medication?</label><input type="checkbox" checked={medicationTaken} onChange={e => setMedicationTaken(e.target.checked)} /></div>;
      case 'symptoms':
        return <div className="form-group-textarea"><label>Describe your symptoms</label><textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} required /></div>;
      default:
        return null;
    }
  };

  return (
    <div className="manual-entry-container">
      <h3>Enter Health Data Manually</h3>
      <form onSubmit={handleSubmit} className="manual-form">
        <div className="form-group">
          <label htmlFor="eventType">Entry Type</label>
          <select id="eventType" value={eventType} onChange={e => setEventType(e.target.value)}>
            <option value="blood_pressure">Blood Pressure</option>
            <option value="spo2">Blood Oxygen (SpO2)</option>
            <option value="weight">Body Weight</option>
            <option value="steps">Walking Steps</option>
            <option value="medication">Medication</option>
            <option value="symptoms">Symptoms</option>
          </select>
        </div>
        {renderFormFields()}
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