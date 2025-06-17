/**
 * Centralized configuration for the Vocal Mirror application
 * Contains all magic numbers, constants, and default values
 */

/**
 * Audio processing configuration
 */
export const AUDIO_CONFIG = {
  /** Sample rate for audio recording and playback */
  SAMPLE_RATE: 44100,
  
  /** Buffer size for audio processing (power of 2) */
  BUFFER_SIZE: 4096,
  
  /** FFT size for frequency analysis (power of 2) */
  FFT_SIZE: 2048,
  
  /** Smoothing time constant for analyzer node */
  SMOOTHING_TIME_CONSTANT: 0.8,
} as const;

/**
 * Recording and buffer configuration
 */
export const RECORDING_CONFIG = {
  /** Maximum recording duration in seconds (5 minutes) */
  MAX_RECORDING_DURATION: 300,
  
  /** Default volume threshold in dB for silence detection */
  DEFAULT_VOLUME_THRESHOLD: -50,
  
  /** Default silence duration in milliseconds before triggering playback */
  DEFAULT_SILENCE_DURATION: 500,
  
  /** Analysis interval for silence detection in milliseconds */
  DEFAULT_ANALYSIS_INTERVAL: 100,
} as const;

/**
 * UI configuration and thresholds
 */
export const UI_CONFIG = {
  /** Volume meter configuration */
  VOLUME_METER: {
    /** Number of segments in the volume meter */
    SEGMENT_COUNT: 6,
    
    /** Volume thresholds for each segment in dB */
    SEGMENT_THRESHOLDS: [-55, -45, -35, -25, -15, -5],
    
    /** Color thresholds for volume meter segments */
    COLOR_THRESHOLDS: {
      GREEN_MAX: 1,    // Segments 0-1 are green
      YELLOW_MAX: 3,   // Segments 2-3 are yellow
      // Segments 4-5 are red
    },
  },
  
  /** Slider configuration */
  SLIDERS: {
    VOLUME_THRESHOLD: {
      MIN: -70,
      MAX: -20,
      STEP: 1,
    },
    SILENCE_DURATION: {
      MIN: 0.1,
      MAX: 2.0,
      STEP: 0.1,
    },
  },
} as const;

/**
 * Audio device constraints for getUserMedia
 */
export const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
  },
} as const;

/**
 * Browser compatibility requirements
 */
export const BROWSER_SUPPORT = {
  /** Minimum browser versions for full support */
  MIN_VERSIONS: {
    CHROME: 66,
    FIREFOX: 60,
    SAFARI: 14,
    EDGE: 79,
  },
} as const;

/**
 * Error messages and types
 */
export const ERROR_MESSAGES = {
  INITIALIZATION: 'Failed to initialize audio components',
  MICROPHONE_PERMISSION: 'Microphone permission denied',
  AUDIO_NOT_SUPPORTED: 'Audio recording/playback not supported',
  RECORDING_FAILED: 'Failed to start recording',
  PLAYBACK_FAILED: 'Failed to play audio',
  AUTO_LISTENING_FAILED: 'Failed to automatically start listening',
  UNKNOWN: 'An unknown error occurred',
} as const;

/**
 * Error types for consistent error handling
 */
export const ERROR_TYPES = {
  INITIALIZATION: 'initialization',
  RECORDING: 'recording',
  PLAYBACK: 'playback',
  LISTENING: 'listening',
  AUTO_LISTENING: 'auto-listening',
  MICROPHONE: 'microphone',
  BROWSER_SUPPORT: 'browser-support',
} as const;