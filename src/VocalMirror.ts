import AudioRecorder from './AudioRecorder';
import AudioAnalyzer from './AudioAnalyzer';
import AudioPlayback from './AudioPlayback';
import AudioBuffer from './AudioBuffer';

/**
 * VocalMirrorState represents the current state of the Vocal Mirror core logic.
 * 
 * State Flow:
 * Ready -> Listening -> Recording -> Playing -> Listening (cycle continues)
 *                                 \-> Ready (user interrupts)
 *    \-> Error (on failures) -> Ready (user retries)
 */
type VocalMirrorState = 
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

interface StateChangeInfo {
  oldState: VocalMirrorState;
  newState: VocalMirrorState;
  timestamp: number;
  stateInfo: StateInfo;
}

interface StateInfo {
  state: VocalMirrorState;
  isInitialized: boolean;
  isPaused: boolean;
  bufferDuration: number;
  bufferSamples: number;
  isRecording: boolean;
  isPlaying: boolean;
}

interface ErrorInfo {
  type: string;
  message: string;
  error?: Error;
}

interface VocalMirrorOptions {
  maxRecordingDuration?: number;
  volumeThreshold?: number;
  silenceDuration?: number;
  onStateChange?: (info: StateChangeInfo) => void;
  onError?: (error: ErrorInfo) => void;
  onVolumeUpdate?: (analysis: any) => void;
}

class VocalMirror {
  private readonly maxRecordingDuration: number;
  private readonly volumeThreshold: number;
  private readonly silenceDuration: number;
  
  private recorder: AudioRecorder | null = null;
  private analyzer: AudioAnalyzer | null = null;
  private playback: AudioPlayback | null = null;
  private buffer: AudioBuffer | null = null;
  // Removed concurrent buffer - using single buffer with interruption handling
  
  private state: VocalMirrorState = 'ready';
  private isInitialized = false;
  
  private readonly onStateChange: (info: StateChangeInfo) => void;
  private readonly onError: (error: ErrorInfo) => void;
  private readonly onVolumeUpdate: (analysis: any) => void;

  constructor(options: VocalMirrorOptions = {}) {
    this.maxRecordingDuration = options.maxRecordingDuration || 300;
    this.volumeThreshold = options.volumeThreshold || -50;
    this.silenceDuration = options.silenceDuration || 500;
    
    this.onStateChange = options.onStateChange || (() => {});
    this.onError = options.onError || (() => {});
    this.onVolumeUpdate = options.onVolumeUpdate || (() => {});
    
    this.initializeComponents();
  }

  private initializeComponents(): void {
    this.buffer = new AudioBuffer(this.maxRecordingDuration);
    
    this.analyzer = new AudioAnalyzer({
      volumeThreshold: this.volumeThreshold,
      silenceDuration: this.silenceDuration,
      onSilenceDetected: this.handleSilenceDetected.bind(this),
      onVolumeChange: this.handleVolumeChange.bind(this)
    });
    
    this.recorder = new AudioRecorder({
      onAudioData: this.handleAudioData.bind(this),
      onError: this.handleRecorderError.bind(this),
      onStateChange: this.handleRecorderStateChange.bind(this)
    });
    
    this.playback = new AudioPlayback({
      onPlaybackStart: this.handlePlaybackStart.bind(this),
      onPlaybackEnd: this.handlePlaybackEnd.bind(this),
      onPlaybackError: this.handlePlaybackError.bind(this),
      onPlaybackInterrupted: this.handlePlaybackInterrupted.bind(this)
    });
  }

  async initialize(): Promise<boolean> {
    try {
      if (!AudioRecorder.isSupported() || !AudioPlayback.isSupported()) {
        throw new Error('Audio recording/playback not supported');
      }
      
      const [recorderOk, playbackOk] = await Promise.all([
        this.recorder!.initialize(),
        this.playback!.initialize()
      ]);
      
      if (!recorderOk || !playbackOk) {
        throw new Error('Failed to initialize audio components');
      }
      
      this.isInitialized = true;
      this.setState('ready');
      return true;
    } catch (error) {
      this.handleError({
        type: 'initialization',
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error as Error
      });
      return false;
    }
  }

  /**
   * Starts the vocal mirror cycle. This initiates the Ready -> Listening transition.
   * In Listening state, we monitor for audio above threshold before starting to record.
   * Public method for UI to call.
   */
  async startRecording(): Promise<boolean> {
    if (!this.isInitialized && !(await this.initialize())) return false;
    
    try {
      const started = await this.recorder!.startRecording();
      if (started) {
        this.buffer?.clear();
        this.buffer?.setDiscardInitialSilence(true);
        this.analyzer?.reset();
        this.setState('listening');
      }
      return started;
    } catch (error) {
      this.handleError({
        type: 'listening',
        message: 'Failed to start listening',
        error: error as Error
      });
      return false;
    }
  }

  /**
   * Transitions from Listening to Recording when audio above threshold is detected.
   * Internal method for state transitions.
   */
  private transitionToRecording(): void {
    if (this.state === 'listening') {
      this.setState('recording');
    }
  }

  stopRecording(): void {
    if (this.state === 'recording') {
      this.recorder?.stopRecording();
      this.triggerPlayback();
    }
  }

  triggerPlayback(): void {
    if (this.state === 'recording') this.stopRecording();
    else this.doTriggerPlayback();
  }

  /**
   * Stops all audio operations and returns to Ready state.
   * This is called when user interrupts the cycle.
   */
  stop(): void {
    if (this.state === 'listening' || this.state === 'recording') {
      this.recorder?.stopRecording();
    } else if (this.state === 'playing') {
      this.playback?.stop();
    }
    this.buffer?.clear();
    this.setState('ready');
  }

  // Removed pause/resume functionality - user can only reset to ready or let cycle continue

  getState(): StateInfo {
    return {
      state: this.state,
      isInitialized: this.isInitialized,
      isPaused: false, // Always false now - we removed pause functionality
      bufferDuration: this.buffer?.getDuration() || 0,
      bufferSamples: this.buffer?.getSampleCount() || 0,
      isRecording: this.recorder?.getState().isRecording || false,
      isPlaying: this.playback?.isCurrentlyPlaying() || false
    };
  }

  updateSettings(options: Partial<VocalMirrorOptions>): void {
    const settings = {
      volumeThreshold: options.volumeThreshold,
      silenceDuration: options.silenceDuration
    };
    this.analyzer?.updateSettings(settings);
  }

  cleanup(): void {
    this.recorder?.cleanup();
    this.playback?.cleanup();
    this.buffer?.clear();
    this.isInitialized = false;
    this.setState('ready');
  }

  /**
   * Automatically transitions from Playing back to Listening to continue the cycle.
   */
  private async autoStartListening(): Promise<void> {
    try {
      this.buffer?.clear();
      this.buffer?.setDiscardInitialSilence(true);
      this.analyzer?.reset();
      const started = await this.recorder!.startRecording();
      this.setState(started ? 'listening' : 'ready');
    } catch (error) {
      this.handleError({
        type: 'auto-listening',
        message: 'Failed to automatically start listening',
        error: error as Error
      });
    }
  }

  private handleAudioData(audioData: Float32Array, sampleRate: number): void {
    if (this.state !== 'listening' && this.state !== 'recording' && this.state !== 'playing') return;
    
    // Analyze audio to determine if it's silent and above threshold
    const analysis = this.analyzer?.analyze(audioData, sampleRate);
    const isSilent = analysis?.isSilent || false;
    const isAboveThreshold = !isSilent; // Analyzer returns false for isSilent when above threshold
    
    if (this.state === 'listening') {
      // In listening state, wait for audio above threshold to start recording
      if (isAboveThreshold) {
        this.transitionToRecording();
        // Add this first chunk to the buffer
        this.buffer?.addData(audioData, sampleRate, isSilent);
      }
      // Discard chunks below threshold while listening
    } else if (this.state === 'recording') {
      // Normal recording - add all data
      this.buffer?.addData(audioData, sampleRate, isSilent);
      
      if ((this.buffer?.getDuration() || 0) >= this.maxRecordingDuration) {
        this.doTriggerPlayback();
      }
    } else if (this.state === 'playing') {
      // During playback, listen for interruption
      if (isAboveThreshold) {
        // User spoke - interrupt playback and start new listening cycle
        this.playback?.stop();
        this.autoStartListening();
      }
    }
  }

  private handleSilenceDetected(): void {
    if (this.state === 'recording') {
      // Silence detected during recording - trigger playback
      this.doTriggerPlayback();
    }
    // In listening state, silence is expected - we're waiting for audio
    // In playing state, silence from user is fine - we're playing back
  }

  private handleVolumeChange(analysis: any): void {
    this.onVolumeUpdate(analysis);
  }

  private async doTriggerPlayback(): Promise<void> {
    if ((this.buffer?.getDuration() || 0) === 0) return;
    
    this.recorder?.stopRecording();
    const audioData = this.buffer!.getAllData();
    const sampleRate = this.recorder!.getSampleRate();
    
    this.setState('playing');
    const started = await this.playback!.playAudio(audioData, sampleRate);
    if (!started) this.setState('ready');
  }

  private setState(newState: VocalMirrorState): void {
    const oldState = this.state;
    this.state = newState;
    
    this.onStateChange({
      oldState,
      newState,
      timestamp: Date.now(),
      stateInfo: this.getState()
    });
  }

  private handleError(errorInfo: ErrorInfo): void {
    this.setState('error');
    this.onError(errorInfo);
  }

  private handleRecorderError(error: ErrorInfo): void {
    this.handleError(error);
  }

  private handleRecorderStateChange(): void {
    // Handle if needed
  }

  private handlePlaybackStart(): void {
    // Playback started - we're now in playing state and listening for interruption
    // Audio data handling will manage interruption detection
  }

  private handlePlaybackEnd(): void {
    // Playback completed naturally - start listening for next cycle
    this.autoStartListening();
  }

  private handlePlaybackError(error: ErrorInfo): void {
    this.handleError(error);
  }

  private handlePlaybackInterrupted(): void {
    // Handle if needed
  }

  // Removed handleConcurrentRecordingComplete - no longer using concurrent buffer approach
}

export default VocalMirror;