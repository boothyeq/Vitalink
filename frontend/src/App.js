// FILE: frontend/src/App.js

import React, { useState } from 'react'; 
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CaptureScreen from './components/CaptureScreens';
import ManualEntryForm from './components/ManualEntryForm';
import ResultsScreen from './components/ResultsScreen';
import HealthLog from './components/HealthLog';

const App = () => {
  // appState determines which component to show the user
  const [appState, setAppState] = useState('capture');
  
  // State to hold the results from either OCR or manual entry
  const [results, setResults] = useState(null);
  const [annotatedImage, setAnnotatedImage] = useState(null); 
  const [error, setError] = useState('');
  const [debugImage, setDebugImage] = useState(null);

  // This function is called by a child component when it has results to show
  const handleSuccess = (data) => {
    setResults(data);
    if (data.annotatedImage) {
      setAnnotatedImage(`data:image/jpeg;base64,${data.annotatedImage}`);
    }
    setAppState('results');
  };

  // Called by a child component when it encounters an error
  const handleError = (err, dbgImg) => {
    setError(err);
    if (dbgImg) {
      setDebugImage(`data:image/png;base64,${dbgImg}`);
    }
    setAppState('capture'); // Set appState back to capture on error
  };

  // Resets the entire application to the beginning
  const resetApp = () => {
    setAppState('capture');
    setError('');
    setResults(null);
    setAnnotatedImage(null);
    setDebugImage(null);
  };

  const renderContent = () => {
    switch (appState) {
      case 'manual_entry':
        return <ManualEntryForm onSuccess={handleSuccess} onCancel={resetApp} />;
      case 'loading':
        return <div className="loader">Processing...</div>;
      case 'results':
        return <ResultsScreen results={results} annotatedImage={annotatedImage} onReset={resetApp} />;
      case 'capture':
      default:
        return (
          <CaptureScreen
              setAppState={setAppState}
              onSuccess={handleSuccess}
              onError={handleError}
              error={error}
              debugImage={debugImage}
              onReset={resetApp}
            />
        );
    }
  };

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Digital Health Tracker</h1>
          <nav className="nav">
            <Link to="/">Scanner</Link>
            <Link to="/log">Health Log</Link>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={renderContent()} />
            <Route path="/log" element={<HealthLog />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;