import { useState, useEffect, useRef } from 'react';
import VocalMirror from './VocalMirror';

type AppState = 'idle' | 'ready' | 'recording' | 'playing' | 'recording_and_playing' | 'paused' | 'error';

function SafeApp() {
  console.log('SafeApp: Rendering');
  
  const [state, setState] = useState<AppState>('idle');
  const [volume, setVolume] = useState<number | null>(null);
  const [bufferDuration, setBufferDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const vocalMirrorRef = useRef<VocalMirror | null>(null);

  useEffect(() => {
    console.log('SafeApp: useEffect running');
    
    try {
      // Initialize VocalMirror when component mounts
      const vocalMirror = new VocalMirror({
        onStateChange: (stateInfo) => {
          console.log('SafeApp: State change:', stateInfo);
          setState(stateInfo.newState);
          setBufferDuration(stateInfo.stateInfo.bufferDuration);
        },
        onError: (errorInfo) => {
          console.error('SafeApp: VocalMirror error:', errorInfo);
          setError(errorInfo.message);
        },
        onVolumeUpdate: (analysis) => {
          setVolume(analysis.volumeDb);
        }
      });

      vocalMirrorRef.current = vocalMirror;
      console.log('SafeApp: VocalMirror initialized');
    } catch (err) {
      console.error('SafeApp: Error initializing VocalMirror:', err);
      setInitError(err instanceof Error ? err.message : String(err));
    }

    // Cleanup on unmount
    return () => {
      console.log('SafeApp: Cleanup');
      try {
        if (vocalMirrorRef.current) {
          vocalMirrorRef.current.cleanup();
        }
      } catch (err) {
        console.error('SafeApp: Cleanup error:', err);
      }
    };
  }, []);

  const handleButtonClick = async () => {
    console.log('SafeApp: Button clicked, state:', state);
    
    if (!vocalMirrorRef.current) {
      console.error('SafeApp: No vocalMirrorRef');
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
          vocalMirrorRef.current.pause();
          break;

        case 'paused':
          vocalMirrorRef.current.resume();
          await vocalMirrorRef.current.startRecording();
          break;

        case 'error':
          setError(null);
          setState('idle');
          break;
      }
    } catch (err) {
      console.error('SafeApp: Button click error:', err);
      setError(err instanceof Error ? err.message : String(err));
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
  }[state] || 'Loading...';

  const statusText = {
    idle: 'Click to initialize microphone',
    ready: 'Click to start listening',
    recording: `Listening... (${bufferDuration.toFixed(1)}s)`,
    playing: 'Playing back your recording',
    recording_and_playing: 'Recording while playing - speak to interrupt',
    paused: 'Click to resume',
    error: 'Error occurred - click to retry',
  }[state] || state;

  const formatVolume = (volumeDb: number | null) =>
    volumeDb === null || volumeDb === -Infinity ? 'Silent' : `${volumeDb.toFixed(1)} dB`;

  // If there's an initialization error, show it
  if (initError) {
    return (
      <div style={{ padding: '20px', color: 'red', backgroundColor: 'white' }}>
        <h1>Initialization Error</h1>
        <p>{initError}</p>
        <pre>{new Error().stack}</pre>
      </div>
    );
  }

  console.log('SafeApp: Returning JSX');

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
      </div>
    </div>
  );
}

export default SafeApp;