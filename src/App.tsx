import React, { useState, useEffect, useRef } from 'react';
import VocalMirror from './VocalMirror';

// Volume meter component
const VolumeMeter: React.FC<{ 
  volume: number | null; 
  isRecording: boolean; 
}> = ({ volume, isRecording }) => {
  // Calculate which segments should be lit based on volume
  // Volume ranges from -Infinity to ~0 dB
  // We'll map this to 6 segments
  const getActiveSegments = (volumeDb: number | null): number => {
    if (!volumeDb || volumeDb === -Infinity || !isRecording) return 0;
    
    // Map dB range to segments (typical speaking range is roughly -60 to -10 dB)
    // Segment thresholds: -55, -45, -35, -25, -15, -5 dB
    if (volumeDb >= -5) return 6;   // Very loud
    if (volumeDb >= -15) return 5;  // Loud
    if (volumeDb >= -25) return 4;  // Moderate-high
    if (volumeDb >= -35) return 3;  // Moderate
    if (volumeDb >= -45) return 2;  // Low-moderate
    if (volumeDb >= -55) return 1;  // Low
    return 0; // Very quiet/silent
  };

  const activeSegments = getActiveSegments(volume);

  return (
    <div className="volume-meter">
      {[...Array(6)].map((_, index) => {
        const segmentIndex = 5 - index; // Bottom to top (5, 4, 3, 2, 1, 0)
        const isActive = segmentIndex < activeSegments;
        
        // Determine color: 0-1 green, 2-3 yellow, 4-5 red
        let colorClass = '';
        if (segmentIndex <= 1) colorClass = 'green';
        else if (segmentIndex <= 3) colorClass = 'yellow';
        else colorClass = 'red';
        
        return (
          <div
            key={index}
            className={`volume-segment ${colorClass} ${isActive ? 'active' : 'dimmed'}`}
          />
        );
      })}
    </div>
  );
};


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
   * - If user speaks loudly (above threshold) -> immediately stops playback, transitions to Listening
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

function App() {
  console.log('App: Component rendering');

  const [state, setState] = useState<AppState>('ready');
  const [volume, setVolume] = useState<number | null>(null);
  const [bufferDuration, setBufferDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(-50);
  const [silenceDuration, setSilenceDuration] = useState(0.5);
  const vocalMirrorRef = useRef<VocalMirror | null>(null);

  useEffect(() => {
    console.log('App: useEffect running');

    try {
      // Initialize VocalMirror when component mounts
      const vocalMirror = new VocalMirror({
        silenceDuration: silenceDuration * 1000, // Convert seconds to milliseconds
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
  }, [silenceDuration]); // Include silenceDuration in dependencies so VocalMirror gets recreated if it changes before initialization

  // Handle threshold and duration changes separately to avoid recreating VocalMirror
  useEffect(() => {
    if (vocalMirrorRef.current) {
      vocalMirrorRef.current.updateSettings({ 
        volumeThreshold: silenceThreshold,
        silenceDuration: silenceDuration * 1000 // Convert seconds to milliseconds
      });
    }
  }, [silenceThreshold, silenceDuration]);

  const handleSilenceThresholdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSilenceThreshold(Number(event.target.value));
  };

  const handleSilenceDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSilenceDuration(Number(event.target.value));
  };

  const handleButtonClick = async () => {
    console.log('App: Button clicked');

    if (!vocalMirrorRef.current) {
      console.log('App: No vocalMirrorRef');
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
      console.error('App: Error in button click:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const buttonText = {
    ready: 'Start',
    listening: 'Stop',
    recording: 'Stop',
    playing: 'Stop',
    error: 'Try Again',
    loading: 'Loading...'
  }[state] || 'Loading...';

  const statusText = {
    ready: 'Click to start listening for audio',
    listening: `Listening for audio... (${bufferDuration.toFixed(1)}s)`,
    recording: `Recording audio... (${bufferDuration.toFixed(1)}s)`,
    playing: 'Playing back your recording - speak to interrupt',
    error: 'Error occurred - click to retry',
    loading: 'Initializing...'
  }[state] || state;

  const formatVolume = (volumeDb: number | null) =>
    volumeDb === null || volumeDb === -Infinity ? 'Silent' : `${volumeDb.toFixed(1)} dB`;

  console.log('App: About to return JSX, state:', state);

  return (
    <>
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
          <div className="button-content-with-meter">
            <VolumeMeter 
              volume={volume} 
              isRecording={state === 'listening' || state === 'recording'} 
            />
            <div className="button-content">
              <div className="button-text">{buttonText}</div>
              <div className="status-text">{statusText}</div>
            </div>
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
              Recording will automatically play back when you stop speaking ({silenceDuration}s silence).
              Click to stop the cycle.
            </small>
          </div>
        )}

        {state === 'playing' && (
          <div className="subHeading">
            <small>
              Playing back your recording. Speak loudly to interrupt, or click to stop the cycle.
            </small>
          </div>
        )}

        <div className="silence-controls">
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
          
          <div className="silence-duration-control">
            <label htmlFor="silence-duration" className="threshold-label">
              Silence Duration: {silenceDuration}s
            </label>
            <input
              id="silence-duration"
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={silenceDuration}
              onChange={handleSilenceDurationChange}
              className="threshold-slider"
            />
          </div>
        </div>
      </div>
      <div className="resources-section">
        <h2>Vocal Training Resources</h2>
        <p>Resources for vocal coaching:</p>

        <div className="resources-grid">
          <a href="https://rogerlove.com/set-your-voice-free3/" target="_blank" rel="noopener noreferrer" className="resource-card">
            <div className="resource-header">
              <h3>Set Your Voice Free</h3>
              <span className="resource-author">Roger Love & Donna Frazier</span>
            </div>
            <p className="resource-description">
              Singing & speaking voice improvement with revolutionary "middle voice" technique
            </p>
          </a>

          <a href="https://www.amazon.com/Freeing-Natural-Voice-Practice-Language/dp/0896762505" target="_blank" rel="noopener noreferrer" className="resource-card">
            <div className="resource-header">
              <h3>Freeing the Natural Voice</h3>
              <span className="resource-author">Kristin Linklater</span>
            </div>
            <p className="resource-description">
              Liberating your natural voice through exercises developed over 30 years
            </p>
          </a>

          <a href="https://www.chicagoreviewpress.com/the-voice-book-products-9781641603300.php" target="_blank" rel="noopener noreferrer" className="resource-card">
            <div className="resource-header">
              <h3>The Voice Book</h3>
              <span className="resource-author">Kate DeVore & Starr Cookman</span>
            </div>
            <p className="resource-description">
              Voice care, protection, and improvement with scientific methods
            </p>
          </a>

          <a href="https://www.amazon.com/Your-Voice-How-Use-Confidence/dp/0863698263" target="_blank" rel="noopener noreferrer" className="resource-card">
            <div className="resource-header">
              <h3>Your Voice and How to Use It</h3>
              <span className="resource-author">Cicely Berry</span>
            </div>
            <p className="resource-description">
              Practical exercises for relaxation, breathing, and vocal flexibility
            </p>
          </a>

          <a href="https://uad-lab.slhs.phhp.ufl.edu/2021/03/26/vocal-function-exercises/" target="_blank" rel="noopener noreferrer" className="resource-card">
            <div className="resource-header">
              <h3>Vocal Function Exercises</h3>
              <span className="resource-author">Joseph Stemple</span>
            </div>
            <p className="resource-description">
              Evidence-based therapeutic exercises for vocal rehabilitation
            </p>
          </a>
        </div>
      </div>
      </div>
      <footer className="attribution-footer">
        Made with <a href="https://imbue.com?utm_source=vocal-mirror&utm_medium=web-app&utm_campaign=attribution&utm_content=danverbraganza.com" target="_blank" rel="noopener noreferrer">Sculptor by Imbue</a>
      </footer>
    </>
  );
}

export default App;
