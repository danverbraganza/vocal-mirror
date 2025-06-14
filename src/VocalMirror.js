import AudioRecorder from './AudioRecorder.js';
import AudioAnalyzer from './AudioAnalyzer.js';
import AudioPlayback from './AudioPlayback.js';
import AudioBuffer from './AudioBuffer.js';

/**
 * Main VocalMirror class that orchestrates recording, analysis, and playback
 * Implements the core vocal practice feedback loop
 */
class VocalMirror {
  constructor(options = {}) {
    // Configuration
    this.maxRecordingDuration = options.maxRecordingDuration || 300; // 5 minutes
    this.volumeThreshold = options.volumeThreshold || -50; // dB
    this.silenceDuration = options.silenceDuration || 2000; // ms
    
    // Components
    this.recorder = null;
    this.analyzer = null;
    this.playback = null;
    this.buffer = null;
    
    // State
    this.state = 'idle'; // idle, recording, playing, error
    this.isInitialized = false;
    
    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onError = options.onError || (() => {});
    this.onVolumeUpdate = options.onVolumeUpdate || (() => {});
    
    this._initializeComponents();
  }

  /**
   * Initialize all audio components
   * @private
   */
  _initializeComponents() {
    // Initialize audio buffer
    this.buffer = new AudioBuffer(this.maxRecordingDuration);
    
    // Initialize audio analyzer
    this.analyzer = new AudioAnalyzer({
      volumeThreshold: this.volumeThreshold,
      silenceDuration: this.silenceDuration,
      onSilenceDetected: this._handleSilenceDetected.bind(this),
      onVolumeChange: this._handleVolumeChange.bind(this)
    });
    
    // Initialize audio recorder
    this.recorder = new AudioRecorder({
      onAudioData: this._handleAudioData.bind(this),
      onError: this._handleRecorderError.bind(this),
      onStateChange: this._handleRecorderStateChange.bind(this)
    });
    
    // Initialize audio playback
    this.playback = new AudioPlayback({
      onPlaybackStart: this._handlePlaybackStart.bind(this),
      onPlaybackEnd: this._handlePlaybackEnd.bind(this),
      onPlaybackError: this._handlePlaybackError.bind(this),
      onPlaybackInterrupted: this._handlePlaybackInterrupted.bind(this)
    });
  }

  /**
   * Initialize the vocal mirror system
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Check browser support
      if (!AudioRecorder.isSupported()) {
        throw new Error('Web Audio API not supported in this browser');
      }
      
      if (!AudioPlayback.isSupported()) {
        throw new Error('Audio playback not supported in this browser');
      }
      
      // Initialize recorder (this requests microphone permission)
      const recorderInitialized = await this.recorder.initialize();
      if (!recorderInitialized) {
        throw new Error('Failed to initialize audio recorder');
      }
      
      // Initialize playback
      const playbackInitialized = await this.playback.initialize();
      if (!playbackInitialized) {
        throw new Error('Failed to initialize audio playback');
      }
      
      this.isInitialized = true;
      this._setState('ready');
      
      return true;
    } catch (error) {
      this._handleError({
        type: 'initialization',
        message: error.message,
        error
      });
      return false;
    }
  }

  /**
   * Start recording audio
   * @returns {Promise<boolean>} Success status
   */
  async startRecording() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    if (this.state === 'playing') {
      // Interrupt playback to start recording
      this.playback.stop();
    }

    try {
      const started = await this.recorder.startRecording();
      if (started) {
        this.buffer.clear();
        this.analyzer.reset();
        this._setState('recording');
        return true;
      }
      return false;
    } catch (error) {
      this._handleError({
        type: 'recording',
        message: 'Failed to start recording',
        error
      });
      return false;
    }
  }

  /**
   * Stop recording and trigger playback
   */
  stopRecording() {
    if (this.state !== 'recording') return;
    
    this.recorder.stopRecording();
    this._triggerPlayback();
  }

  /**
   * Manually trigger playback of current buffer
   */
  triggerPlayback() {
    if (this.state === 'recording') {
      this.stopRecording();
    } else {
      this._triggerPlayback();
    }
  }

  /**
   * Stop current operation and return to ready state
   */
  stop() {
    if (this.state === 'recording') {
      this.recorder.stopRecording();
    } else if (this.state === 'playing') {
      this.playback.stop();
    }
    
    this._setState('ready');
  }

  /**
   * Get current system state
   * @returns {Object} State information
   */
  getState() {
    return {
      state: this.state,
      isInitialized: this.isInitialized,
      bufferDuration: this.buffer ? this.buffer.getDuration() : 0,
      bufferSamples: this.buffer ? this.buffer.getSampleCount() : 0,
      isRecording: this.recorder ? this.recorder.getState().isRecording : false,
      isPlaying: this.playback ? this.playback.isCurrentlyPlaying() : false
    };
  }

  /**
   * Update configuration
   * @param {Object} options - New configuration options
   */
  updateSettings(options) {
    if (options.volumeThreshold !== undefined) {
      this.volumeThreshold = options.volumeThreshold;
      if (this.analyzer) {
        this.analyzer.updateSettings({ volumeThreshold: options.volumeThreshold });
      }
    }
    
    if (options.silenceDuration !== undefined) {
      this.silenceDuration = options.silenceDuration;
      if (this.analyzer) {
        this.analyzer.updateSettings({ silenceDuration: options.silenceDuration });
      }
    }
  }

  /**
   * Clean up all resources
   */
  cleanup() {
    if (this.recorder) {
      this.recorder.cleanup();
    }
    
    if (this.playback) {
      this.playback.cleanup();
    }
    
    if (this.buffer) {
      this.buffer.clear();
    }
    
    this.isInitialized = false;
    this._setState('idle');
  }

  /**
   * Handle incoming audio data from recorder
   * @param {Float32Array} audioData - Audio samples
   * @param {number} sampleRate - Sample rate
   * @private
   */
  _handleAudioData(audioData, sampleRate) {
    if (this.state !== 'recording') return;
    
    // Add to buffer
    this.buffer.addData(audioData, sampleRate);
    
    // Analyze for silence detection
    this.analyzer.analyze(audioData, sampleRate);
    
    // Check if buffer is full (max duration reached)
    if (this.buffer.getDuration() >= this.maxRecordingDuration) {
      this._triggerPlayback();
    }
  }

  /**
   * Handle silence detection
   * @param {Object} silenceInfo - Silence detection information
   * @private
   */
  _handleSilenceDetected(silenceInfo) {
    if (this.state === 'recording') {
      // Trigger playback when silence is detected
      this._triggerPlayback();
    }
  }

  /**
   * Handle volume changes from analyzer
   * @param {Object} analysis - Volume analysis
   * @private
   */
  _handleVolumeChange(analysis) {
    this.onVolumeUpdate(analysis);
  }

  /**
   * Trigger audio playback
   * @private
   */
  async _triggerPlayback() {
    if (this.buffer.getDuration() === 0) return;
    
    // Stop recording
    this.recorder.stopRecording();
    
    // Get all buffered audio data
    const audioData = this.buffer.getAllData();
    const sampleRate = this.recorder.getSampleRate();
    
    // Start playback
    this._setState('playing');
    const playbackStarted = await this.playback.playAudio(audioData, sampleRate);
    
    if (!playbackStarted) {
      this._setState('ready');
    }
  }

  /**
   * Set system state and notify listeners
   * @param {string} newState - New state
   * @private
   */
  _setState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    this.onStateChange({
      oldState,
      newState,
      timestamp: Date.now(),
      stateInfo: this.getState()
    });
  }

  /**
   * Handle errors and set error state
   * @param {Object} errorInfo - Error information
   * @private
   */
  _handleError(errorInfo) {
    this._setState('error');
    this.onError(errorInfo);
  }

  // Event handlers for component callbacks
  _handleRecorderError(error) {
    this._handleError(error);
  }

  _handleRecorderStateChange(stateChange) {
    // Handle recorder state changes if needed
    console.log('Recorder state change:', stateChange);
  }

  _handlePlaybackStart(info) {
    console.log('Playback started:', info);
  }

  _handlePlaybackEnd(info) {
    // Return to ready state when playback completes
    this._setState('ready');
  }

  _handlePlaybackError(error) {
    this._handleError(error);
  }

  _handlePlaybackInterrupted(info) {
    // Playback was interrupted, likely by user starting new recording
    console.log('Playback interrupted:', info);
  }
}

export default VocalMirror;