import { ErrorInfo, PlaybackInfo } from './types';
import { AUDIO_CONFIG, ERROR_TYPES, ERROR_MESSAGES } from './config';

interface PlaybackOptions {
  onPlaybackStart?: (info: PlaybackInfo) => void;
  onPlaybackEnd?: (info: PlaybackInfo) => void;
  onPlaybackError?: (error: ErrorInfo) => void;
  onPlaybackInterrupted?: (info: PlaybackInfo) => void;
}

class AudioPlayback {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private startTime = 0;

  private readonly onPlaybackStart: (info: PlaybackInfo) => void;
  private readonly onPlaybackEnd: (info: PlaybackInfo) => void;
  private readonly onPlaybackError: (error: ErrorInfo) => void;
  private readonly onPlaybackInterrupted: (info: PlaybackInfo) => void;

  constructor(options: PlaybackOptions = {}) {
    this.onPlaybackStart = options.onPlaybackStart || (() => {});
    this.onPlaybackEnd = options.onPlaybackEnd || (() => {});
    this.onPlaybackError = options.onPlaybackError || (() => {});
    this.onPlaybackInterrupted = options.onPlaybackInterrupted || (() => {});
  }

  async initialize(): Promise<boolean> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE
      });
      return true;
    } catch (error) {
      this.onPlaybackError({
        type: ERROR_TYPES.INITIALIZATION,
        message: ERROR_MESSAGES.INITIALIZATION,
        error: error as Error,
        timestamp: Date.now()
      });
      return false;
    }
  }

  async playAudio(audioData: Float32Array, sampleRate = AUDIO_CONFIG.SAMPLE_RATE): Promise<boolean> {
    if (!this.audioContext && !(await this.initialize())) return false;

    try {
      this.stop();

      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }

      this.audioBuffer = this.createAudioBuffer(audioData, sampleRate);
      this.currentSource = this.audioContext!.createBufferSource();
      this.currentSource.buffer = this.audioBuffer;
      this.currentSource.connect(this.audioContext!.destination);

      this.currentSource.onended = () => {
        if (this.isPlaying) this.handlePlaybackEnd();
      };

      this.currentSource.start(0);
      this.isPlaying = true;
      this.startTime = this.audioContext!.currentTime;

      this.onPlaybackStart({
        duration: this.audioBuffer.duration,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.onPlaybackError({
        type: ERROR_TYPES.PLAYBACK,
        message: ERROR_MESSAGES.PLAYBACK_FAILED,
        error: error as Error,
        timestamp: Date.now()
      });
      return false;
    }
  }

  stop(): void {
    if (this.currentSource && this.isPlaying) {
      try {
        this.currentSource.stop();
        this.onPlaybackInterrupted({
          timestamp: Date.now(),
          playedDuration: this.getPlaybackPosition()
        });
      } catch {
        // Source might already be stopped
      }
    }

    this.isPlaying = false;
    this.currentSource = null;
    this.startTime = 0;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  getPlaybackPosition(): number {
    return this.isPlaying && this.audioContext
      ? this.audioContext.currentTime - this.startTime
      : 0;
  }

  getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }

  cleanup(): void {
    if (this.currentSource && this.isPlaying) {
      try {
        this.currentSource.stop();
      } catch {
        // Source might already be stopped
      }
    }
    this.isPlaying = false;
    this.currentSource = null;
    this.startTime = 0;
    this.audioContext?.close();
    this.audioContext = null;
  }

  static isSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  private createAudioBuffer(audioData: Float32Array, sampleRate: number): AudioBuffer {
    const buffer = this.audioContext!.createBuffer(1, audioData.length, sampleRate);
    buffer.getChannelData(0).set(audioData);
    return buffer;
  }

  private handlePlaybackEnd(): void {
    const duration = this.getPlaybackPosition();
    this.isPlaying = false;
    this.currentSource = null;
    this.startTime = 0;
    this.onPlaybackEnd({
      duration,
      timestamp: Date.now(),
      completed: true
    });
  }
}

export default AudioPlayback;
