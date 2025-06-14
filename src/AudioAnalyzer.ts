type DetectionStrategy = 'volume' | 'custom';

interface AnalyzerOptions {
  volumeThreshold?: number;
  silenceDuration?: number;
  analysisInterval?: number;
  detectionStrategy?: DetectionStrategy;
  customDetector?: (analysis: Analysis, audioData: Float32Array, sampleRate: number) => boolean;
  onSilenceDetected?: (info: SilenceInfo) => void;
  onVolumeChange?: (analysis: Analysis) => void;
}

interface Analysis {
  volume: number;
  volumeDb: number;
  isSilent: boolean;
  timestamp: number;
}

interface SilenceInfo {
  duration: number;
  timestamp: number;
  analysis: Analysis;
}

class AudioAnalyzer {
  private volumeThreshold: number;
  private silenceDuration: number;
  private readonly analysisInterval: number;
  private detectionStrategy: DetectionStrategy;
  private customDetector: ((analysis: Analysis, audioData: Float32Array, sampleRate: number) => boolean) | null;
  
  private lastVolumeTime = Date.now();
  private isCurrentlySilent = false;
  private silenceStartTime = 0;
  
  private readonly onSilenceDetected: (info: SilenceInfo) => void;
  private readonly onVolumeChange: (analysis: Analysis) => void;

  constructor(options: AnalyzerOptions = {}) {
    this.volumeThreshold = options.volumeThreshold || -50;
    this.silenceDuration = options.silenceDuration || 2000;
    this.analysisInterval = options.analysisInterval || 100;
    this.detectionStrategy = options.detectionStrategy || 'volume';
    this.customDetector = options.customDetector || null;
    
    this.onSilenceDetected = options.onSilenceDetected || (() => {});
    this.onVolumeChange = options.onVolumeChange || (() => {});
  }

  analyze(audioData: Float32Array, sampleRate: number): Analysis {
    const volume = this.calculateVolume(audioData);
    const volumeDb = this.amplitudeToDb(volume);
    const timestamp = Date.now();
    
    const analysis: Analysis = {
      volume,
      volumeDb,
      isSilent: this.isSilent(volume, volumeDb, audioData, sampleRate),
      timestamp
    };
    
    this.trackSilence(analysis);
    this.onVolumeChange(analysis);
    
    return analysis;
  }

  updateSettings(options: Partial<AnalyzerOptions>): void {
    if (options.volumeThreshold !== undefined) this.volumeThreshold = options.volumeThreshold;
    if (options.silenceDuration !== undefined) this.silenceDuration = options.silenceDuration;
    if (options.detectionStrategy !== undefined) this.detectionStrategy = options.detectionStrategy;
    if (options.customDetector !== undefined) this.customDetector = options.customDetector;
  }

  reset(): void {
    this.isCurrentlySilent = false;
    this.lastVolumeTime = Date.now();
    this.silenceStartTime = 0;
  }

  private isSilent(volume: number, volumeDb: number, audioData: Float32Array, sampleRate: number): boolean {
    switch (this.detectionStrategy) {
      case 'volume':
        return volumeDb < this.volumeThreshold;
      case 'custom':
        return this.customDetector?.({ volume, volumeDb, isSilent: false, timestamp: Date.now() }, audioData, sampleRate) || false;
      default:
        return volumeDb < this.volumeThreshold;
    }
  }

  private trackSilence(analysis: Analysis): void {
    const now = Date.now();
    
    if (analysis.isSilent) {
      if (!this.isCurrentlySilent) {
        this.silenceStartTime = now;
        this.isCurrentlySilent = true;
      }
      
      const silenceDurationMs = now - this.silenceStartTime;
      if (silenceDurationMs >= this.silenceDuration) {
        this.onSilenceDetected({ duration: silenceDurationMs, timestamp: now, analysis });
        this.silenceStartTime = now; // Reset to avoid multiple triggers
      }
    } else {
      if (this.isCurrentlySilent) {
        this.isCurrentlySilent = false;
        this.lastVolumeTime = now;
      }
    }
  }

  private calculateVolume(audioData: Float32Array): number {
    const sum = audioData.reduce((acc, sample) => acc + sample * sample, 0);
    return Math.sqrt(sum / audioData.length);
  }

  private amplitudeToDb(amplitude: number): number {
    return amplitude === 0 ? -Infinity : 20 * Math.log10(amplitude);
  }
}

export default AudioAnalyzer;