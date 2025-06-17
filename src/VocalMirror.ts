import AudioRecorder from './AudioRecorder';
import AudioAnalyzer from './AudioAnalyzer';
import AudioPlayback from './AudioPlayback';
import AudioBuffer from './AudioBuffer';
import { VocalMirrorState, StateChangeInfo, StateInfo, ErrorInfo } from './types';
import { RECORDING_CONFIG, ERROR_TYPES, ERROR_MESSAGES } from './config';


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
    this.maxRecordingDuration = options.maxRecordingDuration || RECORDING_CONFIG.MAX_RECORDING_DURATION;
    this.volumeThreshold = options.volumeThreshold || RECORDING_CONFIG.DEFAULT_VOLUME_THRESHOLD;
    this.silenceDuration = options.silenceDuration || RECORDING_CONFIG.DEFAULT_SILENCE_DURATION;
    
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
        throw new Error(ERROR_MESSAGES.AUDIO_NOT_SUPPORTED);
      }
      
      const [recorderOk, playbackOk] = await Promise.all([
        this.recorder!.initialize(),
        this.playback!.initialize()
      ]);
      
      if (!recorderOk || !playbackOk) {
        throw new Error(ERROR_MESSAGES.INITIALIZATION);
      }
      
      this.isInitialized = true;
      this.setState('ready');
      return true;
    } catch (error) {
      this.handleError({
        type: ERROR_TYPES.INITIALIZATION,
        message: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN,
        error: error as Error,
        timestamp: Date.now()
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
        type: ERROR_TYPES.LISTENING,
        message: ERROR_MESSAGES.RECORDING_FAILED,
        error: error as Error,
        timestamp: Date.now()
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
   * 
   * This method is called in two scenarios:
   * 1. After playback completes naturally (user didn't interrupt)
   * 2. After user interrupts playback by speaking (immediate transition)
   * 
   * The recorder is already running, so we just need to clear the buffer and reset state.
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
        type: ERROR_TYPES.AUTO_LISTENING,
        message: ERROR_MESSAGES.AUTO_LISTENING_FAILED,
        error: error as Error,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handles incoming audio data from the microphone across all active states.
   * This is the core method that enables the app's real-time audio processing:
   * 
   * - LISTENING: Waits for user speech to start recording
   * - RECORDING: Captures audio to buffer while monitoring for silence
   * - PLAYING: Continues monitoring for user speech to interrupt playback
   * 
   * The same volume threshold is used consistently across all states for predictable behavior.
   */
  private handleAudioData(audioData: Float32Array, sampleRate: number): void {
    if (this.state !== 'listening' && this.state !== 'recording' && this.state !== 'playing') return;
    
    // Analyze audio to determine if it's silent and above threshold
    // The analyzer uses the user-configurable silence threshold consistently
    const analysis = this.analyzer?.analyze(audioData, sampleRate);
    const isSilent = analysis?.isSilent || false;
    const isAboveThreshold = !isSilent; // Analyzer returns false for isSilent when above threshold
    
    if (this.state === 'listening') {
      // LISTENING STATE: Wait for user speech above threshold to begin recording
      // This prevents false triggers from background noise while being responsive to speech
      if (isAboveThreshold) {
        this.transitionToRecording();
        // Add this first chunk to the buffer since it triggered recording
        this.buffer?.addData(audioData, sampleRate, isSilent);
      }
      // Discard audio chunks below threshold while listening (background noise, etc.)
      
    } else if (this.state === 'recording') {
      // RECORDING STATE: Capture all audio data while monitoring for silence
      // We record everything (speech + silence) to get natural playback timing
      this.buffer?.addData(audioData, sampleRate, isSilent);
      
      // Prevent infinite recording - trigger playback if buffer fills up
      if ((this.buffer?.getDuration() || 0) >= this.maxRecordingDuration) {
        this.doTriggerPlayback();
      }
      
    } else if (this.state === 'playing') {
      // PLAYING STATE: Simultaneously play recorded audio AND listen for interruption
      // The recorder keeps running during playback to detect user speech
      // Uses the same threshold as listening for consistent user experience
      if (isAboveThreshold) {
        // User spoke during playback - immediately interrupt and start listening for new recording
        this.playback?.stop();
        this.autoStartListening();
      }
      // Note: We don't add audio to buffer during playback - only monitor for interruption
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

  /**
   * Triggers playback of recorded audio while maintaining microphone input.
   * 
   * Key behavior: The recorder stays active during playback to enable interruption detection.
   * This allows the user to speak during playback to immediately interrupt and start a new cycle.
   */
  private async doTriggerPlayback(): Promise<void> {
    if ((this.buffer?.getDuration() || 0) === 0) return;
    
    // CRITICAL: DON'T stop recording - we need continuous microphone input during playback
    // This enables real-time interruption detection when user speaks during playback
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