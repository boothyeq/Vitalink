// FILE: frontend/src/App.js

import React, { useState } from 'react'; 
import './App.css';

// Import the new screen components
import CaptureScreen from './components/CaptureScreens';
import ManualEntryForm from './components/ManualEntryForm';
import ResultsScreen from './components/ResultsScreen';

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
    setAppState('capture');
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
          />
        );
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Digital Health Tracker</h1>
      </header>
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;