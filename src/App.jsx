import React, { useState, useEffect, useRef } from 'react';
import VocalMirror from './VocalMirror.js';

function App() {
  const [state, setState] = useState('idle'); // idle, ready, recording, playing, paused, error
  const [volume, setVolume] = useState(null);
  const [bufferDuration, setBufferDuration] = useState(0);
  const [error, setError] = useState(null);
  const vocalMirrorRef = useRef(null);

  useEffect(() => {
    // Initialize VocalMirror when component mounts
    const vocalMirror = new VocalMirror({
      onStateChange: (stateInfo) => {
        setState(stateInfo.newState);
        setBufferDuration(stateInfo.stateInfo.bufferDuration);
      },
      onError: (errorInfo) => {
        setError(errorInfo.message);
        console.error('VocalMirror error:', errorInfo);
      },
      onVolumeUpdate: (analysis) => {
        setVolume(analysis.volumeDb);
      }
    });

    vocalMirrorRef.current = vocalMirror;

    // Cleanup on unmount
    return () => {
      if (vocalMirrorRef.current) {
        vocalMirrorRef.current.cleanup();
      }
    };
  }, []);

  const handleButtonClick = async () => {
    if (!vocalMirrorRef.current) return;

    switch (state) {
      case 'idle':
      case 'ready':
        setError(null);
        await vocalMirrorRef.current.startRecording();
        break;
      
      case 'recording':
      case 'playing':
        // Pause the vocal mirror to break the auto-cycle
        vocalMirrorRef.current.pause();
        break;
      
      case 'paused':
        // Resume the auto-cycle by starting recording
        vocalMirrorRef.current.resume();
        await vocalMirrorRef.current.startRecording();
        break;
      
      case 'error':
        setError(null);
        setState('idle');
        break;
    }
  };

  const getButtonText = () => {
    switch (state) {
      case 'idle': return 'Initialize Microphone';
      case 'ready': return 'Start Recording';
      case 'recording': return 'Pause';
      case 'playing': return 'Pause';
      case 'paused': return 'Resume';
      case 'error': return 'Try Again';
      default: return 'Loading...';
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'idle': return 'Ready to initialize';
      case 'ready': return 'Microphone ready';
      case 'recording': return `Recording... (${bufferDuration.toFixed(1)}s)`;
      case 'playing': return 'Playing back recording';
      case 'paused': return 'Paused - click Resume to continue';
      case 'error': return 'Error occurred';
      default: return state;
    }
  };

  const formatVolume = (volumeDb) => {
    if (volumeDb === null || volumeDb === -Infinity) return 'Silent';
    return `${volumeDb.toFixed(1)} dB`;
  };

  return (
    <div id="wrapper">
      <h1>Vocal Mirror</h1>
      <div className="copy">
        A simple web tool for vocal practice.
      </div>
      <div id="display">
        <div className="subHeading">
          Status: <span className="cost">{getStatusText()}</span>
        </div>
        
        {state === 'recording' && volume !== null && (
          <div className="subHeading">
            Volume: <span className="cost">{formatVolume(volume)}</span>
          </div>
        )}
        
        {error && (
          <div className="subHeading" style={{ color: 'red' }}>
            Error: {error}
          </div>
        )}
        
        <button 
          className="button center"
          onClick={handleButtonClick}
          disabled={state === 'loading'}
        >
          {getButtonText()}
        </button>
        
        {state === 'recording' && (
          <div className="subHeading">
            <small>
              Recording will automatically play back when you stop speaking (0.5s silence)
              or after 5 minutes. Then it will automatically start recording again.
              Click "Pause" to stop the automatic cycle.
            </small>
          </div>
        )}
        
        {state === 'playing' && (
          <div className="subHeading">
            <small>
              Playback will automatically start recording again when finished.
              Click "Pause" to stop the automatic cycle.
            </small>
          </div>
        )}
        
        {state === 'paused' && (
          <div className="subHeading">
            <small>
              Vocal Mirror is paused. Click "Resume" to start the automatic 
              record → playback → record cycle again.
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;