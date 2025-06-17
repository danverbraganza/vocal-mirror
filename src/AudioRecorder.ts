import { ErrorInfo, StateChange, RecorderState } from './types';
import { AUDIO_CONFIG, MEDIA_CONSTRAINTS, ERROR_TYPES, ERROR_MESSAGES } from './config';

interface AudioRecorderOptions {
  bufferSize?: number;
  fftSize?: number;
  onAudioData?: (data: Float32Array, sampleRate: number) => void;
  onError?: (error: ErrorInfo) => void;
  onStateChange?: (change: StateChange) => void;
}

class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  private readonly bufferSize: number;
  private readonly fftSize: number;

  private isRecording = false;
  private isInitialized = false;

  private readonly onAudioData: (data: Float32Array, sampleRate: number) => void;
  private readonly onError: (error: ErrorInfo) => void;
  private readonly onStateChange: (change: StateChange) => void;

  constructor(options: AudioRecorderOptions = {}) {
    this.bufferSize = options.bufferSize || AUDIO_CONFIG.BUFFER_SIZE;
    this.fftSize = options.fftSize || AUDIO_CONFIG.FFT_SIZE;
    this.onAudioData = options.onAudioData || (() => {});
    this.onError = options.onError || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
  }

  async initialize(): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE
      });

      this.setupAudioNodes();
      this.isInitialized = true;
      this.notifyStateChange('initialized');
      return true;
    } catch (error) {
      this.onError({
        type: ERROR_TYPES.INITIALIZATION,
        message: ERROR_MESSAGES.INITIALIZATION,
        error: error as Error,
        timestamp: Date.now()
      });
      return false;
    }
  }

  async startRecording(): Promise<boolean> {
    if (!this.isInitialized && !(await this.initialize())) return false;

    try {
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }

      this.isRecording = true;
      this.notifyStateChange('recording');
      return true;
    } catch (error) {
      this.onError({
        type: ERROR_TYPES.RECORDING,
        message: ERROR_MESSAGES.RECORDING_FAILED,
        error: error as Error,
        timestamp: Date.now()
      });
      return false;
    }
  }

  stopRecording(): void {
    if (this.isRecording) {
      this.isRecording = false;
      this.notifyStateChange('stopped');
    }
  }

  cleanup(): void {
    this.stopRecording();
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.mediaStream = null;
    this.audioContext?.close();
    this.audioContext = null;
    this.isInitialized = false;
    this.notifyStateChange('cleanup');
  }

  getSampleRate(): number {
    return this.audioContext?.sampleRate || AUDIO_CONFIG.SAMPLE_RATE;
  }

  getState(): RecorderState {
    return {
      isRecording: this.isRecording,
      isInitialized: this.isInitialized,
      sampleRate: this.getSampleRate(),
      contextState: this.audioContext?.state || 'closed'
    };
  }

  static isSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext) &&
           !!navigator.mediaDevices?.getUserMedia;
  }

  private setupAudioNodes(): void {
    const ctx = this.audioContext!;

    this.sourceNode = ctx.createMediaStreamSource(this.mediaStream!);
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = this.fftSize;
    this.analyserNode.smoothingTimeConstant = AUDIO_CONFIG.SMOOTHING_TIME_CONSTANT;

    this.processorNode = ctx.createScriptProcessor(this.bufferSize, 1, 1);
    this.processorNode.onaudioprocess = (event) => {
      if (this.isRecording) {
        const audioData = new Float32Array(event.inputBuffer.getChannelData(0));
        this.onAudioData(audioData, this.getSampleRate());
      }
    };

    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.processorNode);
    this.processorNode.connect(ctx.destination);
  }

  private notifyStateChange(state: string): void {
    this.onStateChange({
      state,
      timestamp: Date.now(),
      details: this.getState()
    });
  }
}

export default AudioRecorder;
