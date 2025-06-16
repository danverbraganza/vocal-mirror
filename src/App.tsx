import React, { useState, useEffect, useRef } from 'react';
import VocalMirror from './VocalMirror';


type AppState = 'idle' | 'ready' | 'recording' | 'playing' | 'recording_and_playing' | 'paused' | 'error';

function App() {
  console.log('App: Component rendering');
  
  const [state, setState] = useState<AppState>('idle');
  const [volume, setVolume] = useState<number | null>(null);
  const [bufferDuration, setBufferDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(-50);
  const vocalMirrorRef = useRef<VocalMirror | null>(null);

  useEffect(() => {
    console.log('App: useEffect running');
    
    try {
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
      console.log('App: VocalMirror created successfully');
    } catch (err) {
      console.error('App: Error creating VocalMirror:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize VocalMirror');
    }

    // Cleanup on unmount
    return () => {
      console.log('App: Cleanup running');
      if (vocalMirrorRef.current) {
        vocalMirrorRef.current.cleanup();
      }
    };
  }, []);

  // Handle threshold changes separately to avoid recreating VocalMirror
  useEffect(() => {
    if (vocalMirrorRef.current) {
      vocalMirrorRef.current.updateSettings({ volumeThreshold: silenceThreshold });
    }
  }, [silenceThreshold]);

  const handleSilenceThresholdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSilenceThreshold(Number(event.target.value));
  };

  const handleButtonClick = async () => {
    console.log('App: Button clicked');
    
    if (!vocalMirrorRef.current) {
      console.log('App: No vocalMirrorRef');
      return;
    }

    try {
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
    } catch (err) {
      console.error('App: Error in button click:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const buttonText = {
    idle: 'Ready',
    ready: 'Ready',
    recording: 'Listening',
    playing: 'Playing',
    recording_and_playing: 'Recording',
    paused: 'Ready',
    error: 'Try Again',
    loading: 'Loading...'
  }[state] || 'Loading...';

  const statusText = {
    idle: 'Click to initialize microphone',
    ready: 'Click to start listening',
    recording: `Listening... (${bufferDuration.toFixed(1)}s)`,
    playing: 'Playing back your recording',
    recording_and_playing: 'Recording while playing - speak to interrupt',
    paused: 'Click to resume',
    error: 'Error occurred - click to retry',
    loading: 'Initializing...'
  }[state] || state;

  const formatVolume = (volumeDb: number | null) =>
    volumeDb === null || volumeDb === -Infinity ? 'Silent' : `${volumeDb.toFixed(1)} dB`;

  console.log('App: About to return JSX, state:', state);

  return (
    <div id="wrapper">
      <h1>Vocal Mirror</h1>
      <div className="copy">
        Vocal Mirror is a simple web tool to enable vocal practice with rapid feedback.
        Vocal Mirror will listen for you to speak or sing, and then replay that to you
        as soon as you stop.
      </div>
      <div id="display">
        {error && (
          <div className="subHeading" style={{ color: 'red' }}>
            Error: {error}
          </div>
        )}

        <button
          className={`button center status-button ${state === 'recording' || state === 'recording_and_playing' ? 'recording' : ''} ${state === 'playing' || state === 'recording_and_playing' ? 'playing' : ''}`}
          onClick={handleButtonClick}
          disabled={false}
        >
          <div className="button-content">
            <div className="button-text">{buttonText}</div>
            <div className="status-text">{statusText}</div>
          </div>
        </button>

        {(state === 'recording' || state === 'recording_and_playing') && volume !== null && (
          <div className="subHeading">
            Volume: <span className="cost">{formatVolume(volume)}</span>
          </div>
        )}

        {state === 'recording' && (
          <div className="subHeading">
            <small>
              Recording will automatically play back when you stop speaking (0.5s silence).
              Click to stop the cycle.
            </small>
          </div>
        )}

        {state === 'playing' && (
          <div className="subHeading">
            <small>
              Playing back your recording. Click to stop the cycle.
            </small>
          </div>
        )}

        <div className="silence-threshold-control">
          <label htmlFor="silence-threshold" className="threshold-label">
            Silence Level: {silenceThreshold} dB
          </label>
          <input
            id="silence-threshold"
            type="range"
            min="-70"
            max="-20"
            value={silenceThreshold}
            onChange={handleSilenceThresholdChange}
            className="threshold-slider"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
