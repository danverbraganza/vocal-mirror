/**
 * Web Audio API recorder with real-time analysis capabilities
 * Provides clean interface for recording, analysis, and state management
 */
class AudioRecorder {
  constructor(options = {}) {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.processorNode = null;
    
    // Configuration
    this.bufferSize = options.bufferSize || 4096;
    this.fftSize = options.fftSize || 2048;
    
    // State
    this.isRecording = false;
    this.isInitialized = false;
    
    // Callbacks
    this.onAudioData = options.onAudioData || (() => {});
    this.onError = options.onError || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
  }

  /**
   * Initialize audio recording system
   * Requests microphone permissions and sets up Web Audio API
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100
      });

      // Set up audio nodes
      this._setupAudioNodes();
      
      this.isInitialized = true;
      this._notifyStateChange('initialized');
      
      return true;
    } catch (error) {
      this.onError({
        type: 'initialization',
        message: 'Failed to initialize audio recording',
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

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isRecording = true;
      this._notifyStateChange('recording');
      
      return true;
    } catch (error) {
      this.onError({
        type: 'recording',
        message: 'Failed to start recording',
        error
      });
      return false;
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    this._notifyStateChange('stopped');
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopRecording();
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
    this._notifyStateChange('cleanup');
  }

  /**
   * Get current sample rate
   * @returns {number} Sample rate in Hz
   */
  getSampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 44100;
  }

  /**
   * Get current recording state
   * @returns {Object} State information
   */
  getState() {
    return {
      isRecording: this.isRecording,
      isInitialized: this.isInitialized,
      sampleRate: this.getSampleRate(),
      contextState: this.audioContext ? this.audioContext.state : 'closed'
    };
  }

  /**
   * Set up Web Audio API nodes for recording and analysis
   * @private
   */
  _setupAudioNodes() {
    // Create source node from microphone stream
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Create analyser node for real-time analysis
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    // Create script processor for audio data capture
    // Note: ScriptProcessorNode is deprecated but widely supported
    // TODO: Migrate to AudioWorklet for production
    this.processorNode = this.audioContext.createScriptProcessor(
      this.bufferSize, 
      1, // mono input
      1  // mono output
    );
    
    // Process audio data
    this.processorNode.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      
      const inputBuffer = event.inputBuffer;
      const audioData = inputBuffer.getChannelData(0); // Get mono channel
      
      // Copy data to prevent buffer reuse issues
      const audioDataCopy = new Float32Array(audioData);
      
      // Send audio data to callback
      this.onAudioData(audioDataCopy, this.getSampleRate());
    };
    
    // Connect nodes
    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  /**
   * Notify state change listeners
   * @param {string} state - New state
   * @private
   */
  _notifyStateChange(state) {
    this.onStateChange({
      state,
      timestamp: Date.now(),
      details: this.getState()
    });
  }

  /**
   * Check if Web Audio API is supported
   * @returns {boolean} Support status
   * @static
   */
  static isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext) &&
           !!navigator.mediaDevices &&
           !!navigator.mediaDevices.getUserMedia;
  }
}

export default AudioRecorder;