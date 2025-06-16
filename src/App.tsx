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
          <div className="button-content-with-meter">
            <VolumeMeter 
              volume={volume} 
              isRecording={state === 'recording' || state === 'recording_and_playing'} 
            />
            <div className="button-content">
              <div className="button-text">{buttonText}</div>
              <div className="status-text">{statusText}</div>
            </div>
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
      <div className="resources-section">
        <h2>Vocal Training Resources</h2>
        <p>Enhance your vocal skills with these recommended books and resources:</p>

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
      <footer className="attribution-footer">
        Made with <a href="https://imbue.com?utm_source=vocal-mirror&utm_medium=web-app&utm_campaign=attribution&utm_content=danverbraganza.com" target="_blank" rel="noopener noreferrer">Sculptor by Imbue</a>
      </footer>
    </div>
  );
}

export default App;
