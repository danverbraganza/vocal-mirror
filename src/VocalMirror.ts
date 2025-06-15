import AudioRecorder from './AudioRecorder';
import AudioAnalyzer from './AudioAnalyzer';
import AudioPlayback from './AudioPlayback';
import AudioBuffer from './AudioBuffer';

type VocalMirrorState = 'idle' | 'ready' | 'recording' | 'playing' | 'recording_and_playing' | 'paused' | 'error';

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
  private concurrentBuffer: AudioBuffer | null = null;
  
  private state: VocalMirrorState = 'idle';
  private isInitialized = false;
  private isPaused = false;
  
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
    this.concurrentBuffer = new AudioBuffer(this.maxRecordingDuration);
    
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

  async startRecording(): Promise<boolean> {
    if (!this.isInitialized && !(await this.initialize())) return false;
    
    try {
      const started = await this.recorder!.startRecording();
      if (started) {
        if (this.state === 'playing') {
          // Start concurrent recording during playback
          this.concurrentBuffer?.clear();
          this.concurrentBuffer?.setDiscardInitialSilence(true);
          this.analyzer?.reset();
          this.setState('recording_and_playing');
        } else {
          // Normal recording
          this.buffer?.clear();
          this.buffer?.setDiscardInitialSilence(true);
          this.analyzer?.reset();
          this.setState('recording');
        }
      }
      return started;
    } catch (error) {
      this.handleError({
        type: 'recording',
        message: 'Failed to start recording',
        error: error as Error
      });
      return false;
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

  stop(): void {
    if (this.state === 'recording') this.recorder?.stopRecording();
    else if (this.state === 'playing') this.playback?.stop();
    this.setState('ready');
  }

  pause(): void {
    this.isPaused = true;
    this.stop();
    this.setState('paused');
  }

  resume(): void {
    this.isPaused = false;
    this.setState('ready');
  }

  getState(): StateInfo {
    return {
      state: this.state,
      isInitialized: this.isInitialized,
      isPaused: this.isPaused,
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
    this.playback?.dispose();
    this.buffer?.clear();
    this.concurrentBuffer?.clear();
    this.isInitialized = false;
    this.setState('idle');
  }

  private async autoStartRecording(): Promise<void> {
    if (this.isPaused) {
      this.setState('paused');
      return;
    }

    try {
      this.buffer?.clear();
      this.buffer?.setDiscardInitialSilence(true);
      this.analyzer?.reset();
      const started = await this.recorder!.startRecording();
      this.setState(started ? 'recording' : 'ready');
    } catch (error) {
      this.handleError({
        type: 'auto-recording',
        message: 'Failed to automatically start recording',
        error: error as Error
      });
    }
  }

  private handleAudioData(audioData: Float32Array, sampleRate: number): void {
    if (this.state !== 'recording' && this.state !== 'recording_and_playing') return;
    
    // Analyze audio to determine if it's silent
    const analysis = this.analyzer?.analyze(audioData, sampleRate);
    const isSilent = analysis?.isSilent || false;
    
    if (this.state === 'recording_and_playing') {
      // Recording during playback - use concurrent buffer
      this.concurrentBuffer?.addData(audioData, sampleRate, isSilent);
      
      if ((this.concurrentBuffer?.getDuration() || 0) >= this.maxRecordingDuration) {
        // Switch to new recording
        this.handleConcurrentRecordingComplete();
      }
    } else {
      // Normal recording
      this.buffer?.addData(audioData, sampleRate, isSilent);
      
      if ((this.buffer?.getDuration() || 0) >= this.maxRecordingDuration) {
        this.doTriggerPlayback();
      }
    }
  }

  private handleSilenceDetected(): void {
    if (this.state === 'recording') {
      this.doTriggerPlayback();
    } else if (this.state === 'recording_and_playing') {
      // User stopped speaking during playback - trigger new playback
      this.handleConcurrentRecordingComplete();
    }
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
    // Start concurrent recording when playback begins
    this.startRecording();
  }

  private handlePlaybackEnd(): void {
    if (this.state === 'recording_and_playing') {
      // Continue with concurrent recording if it has content
      if ((this.concurrentBuffer?.getDuration() || 0) > 0) {
        this.handleConcurrentRecordingComplete();
      } else {
        this.setState('recording');
      }
    } else {
      this.autoStartRecording();
    }
  }

  private handlePlaybackError(error: ErrorInfo): void {
    this.handleError(error);
  }

  private handlePlaybackInterrupted(): void {
    // Handle if needed
  }

  private async handleConcurrentRecordingComplete(): Promise<void> {
    if ((this.concurrentBuffer?.getDuration() || 0) === 0) return;
    
    // Stop current playback
    this.playback?.stop();
    
    // Move concurrent buffer data to main buffer
    const audioData = this.concurrentBuffer!.getAllData();
    this.buffer?.clear();
    this.buffer?.addData(audioData, this.recorder!.getSampleRate());
    this.concurrentBuffer?.clear();
    
    // Start playback of new recording
    this.setState('playing');
    const sampleRate = this.recorder!.getSampleRate();
    const started = await this.playback!.playAudio(audioData, sampleRate);
    if (!started) this.setState('ready');
  }
}

export default VocalMirror;