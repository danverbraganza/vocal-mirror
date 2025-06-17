/**
 * Shared types for the Vocal Mirror application
 */

/**
 * VocalMirrorState represents the current state of the Vocal Mirror application.
 * 
 * State Flow:
 * Ready -> Listening -> Recording -> Playing -> Listening (cycle continues)
 *                                 \-> Ready (user interrupts)
 *    \-> Error (on failures) -> Ready (user retries)
 */
export type VocalMirrorState = 
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
   * - If user speaks (any audible speech) -> immediately stops playback, transitions to Listening
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

/**
 * Standard error information interface used across all modules
 */
export interface ErrorInfo {
  type: string;
  message: string;
  error?: Error;
  timestamp?: number;
}

/**
 * State change information for vocal mirror components
 */
export interface StateChangeInfo {
  oldState: VocalMirrorState;
  newState: VocalMirrorState;
  timestamp: number;
  stateInfo: StateInfo;
}

/**
 * Complete state information for the vocal mirror
 */
export interface StateInfo {
  state: VocalMirrorState;
  isInitialized: boolean;
  isPaused: boolean;
  bufferDuration: number;
  bufferSamples: number;
  isRecording: boolean;
  isPlaying: boolean;
}

/**
 * Audio analysis results
 */
export interface Analysis {
  volume: number;
  volumeDb: number;
  isSilent: boolean;
  timestamp: number;
}

/**
 * Silence detection information
 */
export interface SilenceInfo {
  duration: number;
  timestamp: number;
  analysis: Analysis;
}

/**
 * Audio recorder state information
 */
export interface RecorderState {
  isRecording: boolean;
  isInitialized: boolean;
  sampleRate: number;
  contextState: AudioContextState;
}

/**
 * State change information for audio components
 */
export interface StateChange {
  state: string;
  timestamp: number;
  details: RecorderState;
}

/**
 * Audio playback information
 */
export interface PlaybackInfo {
  duration?: number;
  timestamp: number;
  playedDuration?: number;
  completed?: boolean;
}

/**
 * Audio chunk data structure
 */
export interface AudioChunk {
  data: Float32Array;
  duration: number;
  timestamp: number;
}

/**
 * Detection strategy for audio analysis
 */
export type DetectionStrategy = 'volume' | 'custom';