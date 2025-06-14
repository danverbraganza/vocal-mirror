/**
 * Audio analysis module with extensible detection algorithms
 * Currently implements volume-based detection with clean extension points
 * for future silence detection algorithms
 */
class AudioAnalyzer {
  constructor(options = {}) {
    this.volumeThreshold = options.volumeThreshold || -50; // dB
    this.silenceDuration = options.silenceDuration || 2000; // ms
    this.analysisInterval = options.analysisInterval || 100; // ms
    
    // State tracking
    this.lastVolumeTime = Date.now();
    this.isCurrentlySilent = false;
    
    // Extension point: Detection strategy
    this.detectionStrategy = options.detectionStrategy || 'volume';
    this.customDetector = options.customDetector || null;
    
    // Event callbacks
    this.onSilenceDetected = options.onSilenceDetected || (() => {});
    this.onVolumeChange = options.onVolumeChange || (() => {});
  }

  /**
   * Analyze audio data and detect silence/volume changes
   * @param {Float32Array} audioData - Audio samples to analyze
   * @param {number} sampleRate - Sample rate of the audio
   * @returns {Object} Analysis results
   */
  analyze(audioData, sampleRate) {
    const analysis = {
      volume: this._calculateVolume(audioData),
      volumeDb: null,
      isSilent: false,
      timestamp: Date.now()
    };

    // Convert to decibels
    analysis.volumeDb = this._amplitudeToDb(analysis.volume);
    
    // Determine if current sample is silent
    analysis.isSilent = this._isSilent(analysis, audioData, sampleRate);
    
    // Track silence duration and trigger detection
    this._trackSilence(analysis);
    
    // Notify volume change
    this.onVolumeChange(analysis);
    
    return analysis;
  }

  /**
   * Extension point: Override this method to implement custom silence detection
   * @param {Object} analysis - Current analysis results
   * @param {Float32Array} audioData - Raw audio data
   * @param {number} sampleRate - Sample rate
   * @returns {boolean} True if silent
   * @protected
   */
  _isSilent(analysis, audioData, sampleRate) {
    switch (this.detectionStrategy) {
      case 'volume':
        return this._volumeBasedDetection(analysis);
      
      case 'custom':
        return this.customDetector ? 
          this.customDetector(analysis, audioData, sampleRate) : 
          false;
      
      // Future extension point: Add more strategies here
      // case 'spectral':
      //   return this._spectralBasedDetection(analysis, audioData, sampleRate);
      
      default:
        return this._volumeBasedDetection(analysis);
    }
  }

  /**
   * Volume-based silence detection
   * @param {Object} analysis - Analysis results
   * @returns {boolean} True if silent
   * @private
   */
  _volumeBasedDetection(analysis) {
    return analysis.volumeDb < this.volumeThreshold;
  }

  /**
   * Track silence duration and trigger detection when threshold is met
   * @param {Object} analysis - Current analysis
   * @private
   */
  _trackSilence(analysis) {
    const now = Date.now();
    
    if (analysis.isSilent) {
      // Continue or start silence period
      if (!this.isCurrentlySilent) {
        this.silenceStartTime = now;
        this.isCurrentlySilent = true;
      }
      
      // Check if silence duration threshold is met
      const silenceDurationMs = now - this.silenceStartTime;
      if (silenceDurationMs >= this.silenceDuration) {
        this.onSilenceDetected({
          duration: silenceDurationMs,
          timestamp: now,
          analysis
        });
        
        // Reset to avoid multiple triggers
        this.silenceStartTime = now;
      }
    } else {
      // End silence period
      if (this.isCurrentlySilent) {
        this.isCurrentlySilent = false;
        this.lastVolumeTime = now;
      }
    }
  }

  /**
   * Calculate RMS volume from audio samples
   * @param {Float32Array} audioData - Audio samples
   * @returns {number} RMS volume (0-1)
   * @private
   */
  _calculateVolume(audioData) {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Convert amplitude to decibels
   * @param {number} amplitude - Linear amplitude (0-1)
   * @returns {number} Volume in decibels
   * @private
   */
  _amplitudeToDb(amplitude) {
    if (amplitude === 0) return -Infinity;
    return 20 * Math.log10(amplitude);
  }

  /**
   * Update detection parameters
   * @param {Object} options - New options to apply
   */
  updateSettings(options) {
    if (options.volumeThreshold !== undefined) {
      this.volumeThreshold = options.volumeThreshold;
    }
    if (options.silenceDuration !== undefined) {
      this.silenceDuration = options.silenceDuration;
    }
    if (options.detectionStrategy !== undefined) {
      this.detectionStrategy = options.detectionStrategy;
    }
    if (options.customDetector !== undefined) {
      this.customDetector = options.customDetector;
    }
  }

  /**
   * Reset analyzer state
   */
  reset() {
    this.isCurrentlySilent = false;
    this.lastVolumeTime = Date.now();
    this.silenceStartTime = null;
  }
}

export default AudioAnalyzer;