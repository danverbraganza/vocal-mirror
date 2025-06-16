import { useState, useEffect, useRef } from 'react';
import VocalMirror from './VocalMirror';

/**
 * AppState represents the current state of the Vocal Mirror application.
 * 
 * State Flow:
 * Ready -> Listening -> Recording -> Playing -> Listening (cycle continues)
 *                                 \-> Ready (user interrupts)
 *    \-> Error (on failures) -> Ready (user retries)
 */
type AppState = 
  /** 
   * Ready: Initial state when user has not started working with the app.
   * Call to Action: Click to begin listening for audio input.
   */
  | 'ready'
  
  /** 
   * Listening: App is actively listening for audio input above the volume threshold.
   * - If audio above threshold is detected -> transitions to Recording
   * - If user clicks button -> transitions to Ready
   * - Audio chunks below threshold are discarded
   */
  | 'listening'
  
  /** 
   * Recording: App is recording audio to the 5-minute buffer.
   * - Waits for silence longer than silenceDuration threshold -> transitions to Playing
   * - If user interrupts by pressing button -> transitions to Ready (discards all audio)
   * - Continues recording until buffer is full or silence detected
   */
  | 'recording' 
  
  /** 
   * Playing: App is playing back recorded audio AND listening for interruption.
   * - If user speaks (any audible speech) -> immediately stops playback, transitions to Listening
   * - If user presses button -> transitions to Ready (discards all audio)
   * - When playback completes naturally -> transitions to Listening
   */
  | 'playing'
  
  /** 
   * Error: Something went wrong (microphone permissions, audio API failure, etc.).
   * - User can click to retry and transition back to Ready
   * - Provides graceful error recovery mechanism
   */
  | 'error';

function SafeApp() {
  console.log('SafeApp: Rendering');
  
  const [state, setState] = useState<AppState>('ready');
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
        case 'ready':
          setError(null);
          await vocalMirrorRef.current.startRecording();
          break;

        case 'listening':
        case 'recording':
        case 'playing':
          // Stop the vocal mirror cycle and return to ready
          vocalMirrorRef.current.stop();
          break;

        case 'error':
          setError(null);
          setState('ready');
          break;
      }
    } catch (err) {
      console.error('SafeApp: Button click error:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const buttonText = {
    ready: 'Start',
    listening: 'Stop',
    recording: 'Stop',
    playing: 'Stop',
    error: 'Try Again',
  }[state] || 'Loading...';

  const statusText = {
    ready: 'Click to start listening for audio',
    listening: `Listening for audio... (${bufferDuration.toFixed(1)}s)`,
    recording: `Recording audio... (${bufferDuration.toFixed(1)}s)`,
    playing: 'Playing back your recording - speak to interrupt',
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
          className={`button center status-button ${state === 'listening' || state === 'recording' ? 'recording' : ''} ${state === 'playing' ? 'playing' : ''}`}
          onClick={handleButtonClick}
          disabled={false}
        >
          <div className="button-content">
            <div className="button-text">{buttonText}</div>
            <div className="status-text">{statusText}</div>
          </div>
        </button>

        {(state === 'listening' || state === 'recording') && volume !== null && (
          <div className="subHeading">
            Volume: <span className="cost">{formatVolume(volume)}</span>
          </div>
        )}

        {state === 'listening' && (
          <div className="subHeading">
            <small>
              Listening for audio above threshold. Speak to start recording.
              Click to stop.
            </small>
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
              Playing back your recording. Speak to interrupt, or click to stop the cycle.
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

export default SafeApp;