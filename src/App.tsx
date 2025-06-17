import React, { useState, useEffect, useRef } from 'react';
import VocalMirror from './VocalMirror';
import { VocalMirrorState } from './types';
import { UI_CONFIG, RECORDING_CONFIG } from './config';

// Volume meter component
const VolumeMeter: React.FC<{
  volume: number | null;
  isRecording: boolean;
}> = ({ volume, isRecording }) => {
  // Calculate which segments should be lit based on volume
  // Volume ranges from -Infinity to ~0 dB
  // We'll map this to segments using configuration
  const getActiveSegments = (volumeDb: number | null): number => {
    if (!volumeDb || volumeDb === -Infinity || !isRecording) return 0;

    // Use configured thresholds for volume meter segments
    const thresholds = UI_CONFIG.VOLUME_METER.SEGMENT_THRESHOLDS;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (volumeDb >= thresholds[i]) {
        return i + 1;
      }
    }
    return 0; // Very quiet/silent
  };

  const activeSegments = getActiveSegments(volume);

  return (
    <div className="volume-meter">
      {[...Array(UI_CONFIG.VOLUME_METER.SEGMENT_COUNT)].map((_, index) => {
        const segmentIndex = UI_CONFIG.VOLUME_METER.SEGMENT_COUNT - 1 - index; // Bottom to top
        const isActive = segmentIndex < activeSegments;

        // Determine color using configuration
        let colorClass = '';
        if (segmentIndex <= UI_CONFIG.VOLUME_METER.COLOR_THRESHOLDS.GREEN_MAX) colorClass = 'green';
        else if (segmentIndex <= UI_CONFIG.VOLUME_METER.COLOR_THRESHOLDS.YELLOW_MAX) colorClass = 'yellow';
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



function App() {
  console.log('App: Component rendering');

  const [state, setState] = useState<VocalMirrorState>('ready');
  const [volume, setVolume] = useState<number | null>(null);
  const [bufferDuration, setBufferDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(RECORDING_CONFIG.DEFAULT_VOLUME_THRESHOLD);
  const [silenceDuration, setSilenceDuration] = useState(RECORDING_CONFIG.DEFAULT_SILENCE_DURATION / 1000); // Convert to seconds for UI
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
        Vocal Mirror is a tool for rapid hands-free vocal practice and feedback.<br/>

		When active, Vocal Mirror will listen for you to speak or sing, and then replay that to you
        as soon as silence is detected. It's like a variable-length echo. <br/> <br/>

		Vocal Mirror was dreamed up by <a href="https://danverbraganza.com">Danver Braganza</a> and coded with <a href="https://imbue.com?utm_source=vocal-mirror&utm_medium=web-app&utm_campaign=attribution&utm_content=danverbraganza.com" target="_blank" rel="noopener noreferrer">Sculptor by Imbue</a>.
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
              Playing back your recording. Speak to interrupt, or click to stop the cycle.
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
              min={UI_CONFIG.SLIDERS.VOLUME_THRESHOLD.MIN}
              max={UI_CONFIG.SLIDERS.VOLUME_THRESHOLD.MAX}
              step={UI_CONFIG.SLIDERS.VOLUME_THRESHOLD.STEP}
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
              min={UI_CONFIG.SLIDERS.SILENCE_DURATION.MIN}
              max={UI_CONFIG.SLIDERS.SILENCE_DURATION.MAX}
              step={UI_CONFIG.SLIDERS.SILENCE_DURATION.STEP}
              value={silenceDuration}
              onChange={handleSilenceDurationChange}
              className="threshold-slider"
            />
          </div>
        </div>
      </div>
      <div className="resources-section">
        <h2>Vocal Training Resources</h2>
        <p>Resources that I found online. Not affiliated and non-monetized links.</p>

        <div className="resources-grid" visibile="false">
          <a href="https://rogerlove.com/" target="_blank" rel="noopener noreferrer" className="resource-card">
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

          <a href="https://www.amazon.com/Your-Voice-How-Use-Confidence/dp/0863698263" target="_blank" rel="noopener noreferrer" className="resource-card">
            <div className="resource-header">
              <h3>Your Voice and How to Use It</h3>
              <span className="resource-author">Cicely Berry</span>
            </div>
            <p className="resource-description">
              Practical exercises for relaxation, breathing, and vocal flexibility
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
