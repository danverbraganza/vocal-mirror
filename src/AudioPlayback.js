/**
 * Audio playback manager for playing back recorded audio
 * Handles conversion from raw audio data to playable format
 */
class AudioPlayback {
  constructor(options = {}) {
    this.audioContext = null;
    this.currentSource = null;
    this.audioBuffer = null;
    
    // State
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseTime = 0;
    
    // Callbacks
    this.onPlaybackStart = options.onPlaybackStart || (() => {});
    this.onPlaybackEnd = options.onPlaybackEnd || (() => {});
    this.onPlaybackError = options.onPlaybackError || (() => {});
    this.onPlaybackInterrupted = options.onPlaybackInterrupted || (() => {});
  }

  /**
   * Initialize audio playback system
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100
      });
      
      return true;
    } catch (error) {
      this.onPlaybackError({
        type: 'initialization',
        message: 'Failed to initialize audio playback',
        error
      });
      return false;
    }
  }

  /**
   * Play audio from raw audio data
   * @param {Float32Array} audioData - Raw audio samples
   * @param {number} sampleRate - Sample rate of the audio
   * @returns {Promise<boolean>} Success status
   */
  async playAudio(audioData, sampleRate = 44100) {
    if (!this.audioContext) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    try {
      // Stop any current playback
      this.stop();

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create audio buffer from raw data
      this.audioBuffer = this._createAudioBuffer(audioData, sampleRate);
      
      // Create and configure source node
      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = this.audioBuffer;
      this.currentSource.connect(this.audioContext.destination);
      
      // Set up playback end handling
      this.currentSource.onended = () => {
        if (this.isPlaying) {
          this._handlePlaybackEnd();
        }
      };
      
      // Start playback
      this.currentSource.start(0);
      this.isPlaying = true;
      this.startTime = this.audioContext.currentTime;
      
      this.onPlaybackStart({
        duration: this.audioBuffer.duration,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      this.onPlaybackError({
        type: 'playback',
        message: 'Failed to play audio',
        error
      });
      return false;
    }
  }

  /**
   * Stop current playback
   */
  stop() {
    if (this.currentSource && this.isPlaying) {
      try {
        this.currentSource.stop();
        this.onPlaybackInterrupted({
          timestamp: Date.now(),
          playedDuration: this.getPlaybackPosition()
        });
      } catch (error) {
        // Source might already be stopped, ignore error
      }
    }
    
    this._cleanup();
  }

  /**
   * Check if audio is currently playing
   * @returns {boolean} Playing status
   */
  isCurrentlyPlaying() {
    return this.isPlaying;
  }

  /**
   * Get current playback position in seconds
   * @returns {number} Current position
   */
  getPlaybackPosition() {
    if (!this.isPlaying || !this.audioContext) return 0;
    return this.audioContext.currentTime - this.startTime;
  }

  /**
   * Get total duration of loaded audio
   * @returns {number} Duration in seconds
   */
  getDuration() {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Create Web Audio API buffer from raw audio data
   * @param {Float32Array} audioData - Raw audio samples
   * @param {number} sampleRate - Sample rate
   * @returns {AudioBuffer} Web Audio API buffer
   * @private
   */
  _createAudioBuffer(audioData, sampleRate) {
    const buffer = this.audioContext.createBuffer(
      1, // mono
      audioData.length,
      sampleRate
    );
    
    // Copy audio data to buffer
    const channelData = buffer.getChannelData(0);
    channelData.set(audioData);
    
    return buffer;
  }

  /**
   * Handle natural playback end
   * @private
   */
  _handlePlaybackEnd() {
    const duration = this.getPlaybackPosition();
    this._cleanup();
    
    this.onPlaybackEnd({
      duration,
      timestamp: Date.now(),
      completed: true
    });
  }

  /**
   * Clean up current playback state
   * @private
   */
  _cleanup() {
    this.isPlaying = false;
    this.currentSource = null;
    this.startTime = 0;
  }

  /**
   * Check if Web Audio API playback is supported
   * @returns {boolean} Support status
   * @static
   */
  static isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }
}

export default AudioPlayback;