// FILE: frontend/src/components/ResultsScreen.js

import React from 'react';

const ResultsScreen = ({ results, annotatedImage, onReset }) => {
    // Helper to render the results based on what data is available
    const renderResultsData = () => {
        if (results.sys) { // It's a blood pressure reading
            return (
                <>
                    <p><strong>SYS:</strong> {results.sys}</p>
                    <p><strong>DIA:</strong> {results.dia}</p>
                    <p><strong>PULSE:</strong> {results.pulse}</p>
                </>
            );
        }
        if (results.spo2) {
            return <p><strong>SpO2:</strong> {results.spo2} %</p>;
        }
        if (results.weight) {
            return <p><strong>Weight:</strong> {results.weight} kg</p>;
        }
        if (results.steps) {
            return <p><strong>Steps:</strong> {results.steps}</p>;
        }
        if (results.medicationTaken !== undefined) {
            return <p><strong>Medication Taken:</strong> {results.medicationTaken ? 'Yes' : 'No'}</p>;
        }
        if (results.symptoms) {
            return <p><strong>Symptoms:</strong> {results.symptoms}</p>;
        }
        return <p>Data saved successfully.</p>;
    };

    return (
        <div className="results-container">
            <h2>Results</h2>
            {annotatedImage && (
                <div className="annotated-image-container">
                    <h3>Processed Image</h3>
                    <img src={annotatedImage} alt="Annotated OCR Result" className="annotated-image" />
                </div>
            )}
            <div className="results">
                {renderResultsData()}
            </div>
            <button onClick={onReset}>Scan Another</button>
        </div>
    );
};

export default ResultsScreen;