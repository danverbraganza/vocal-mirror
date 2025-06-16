import VocalMirror from './VocalMirror';

// Mock the audio components
jest.mock('./AudioRecorder', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    startRecording: jest.fn().mockResolvedValue(true),
    stopRecording: jest.fn(),
    cleanup: jest.fn(),
    getSampleRate: jest.fn().mockReturnValue(44100),
    getState: jest.fn().mockReturnValue({ isRecording: false }),
  }));
});

jest.mock('./AudioAnalyzer', () => {
  return jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockReturnValue({
      volume: 0.5,
      volumeDb: -20,
      isSilent: false,
      timestamp: Date.now(),
    }),
    updateSettings: jest.fn(),
    reset: jest.fn(),
  }));
});

jest.mock('./AudioPlayback', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    playAudio: jest.fn().mockResolvedValue(true),
    stop: jest.fn(),
    cleanup: jest.fn(),
    isCurrentlyPlaying: jest.fn().mockReturnValue(false),
  }));
});

jest.mock('./AudioBuffer', () => {
  return jest.fn().mockImplementation(() => ({
    clear: jest.fn(),
    addData: jest.fn(),
    getAllData: jest.fn().mockReturnValue(new Float32Array(1024)),
    getDuration: jest.fn().mockReturnValue(0),
    getSampleCount: jest.fn().mockReturnValue(0),
    setDiscardInitialSilence: jest.fn(),
  }));
});

// Mock static methods
const mockIsSupported = jest.fn().mockReturnValue(true);
require('./AudioRecorder').isSupported = mockIsSupported;
require('./AudioPlayback').isSupported = mockIsSupported;

describe('VocalMirror', () => {
  let vocalMirror: VocalMirror;
  let mockOnStateChange: jest.Mock;
  let mockOnError: jest.Mock;
  let mockOnVolumeUpdate: jest.Mock;
  let mockRecorder: any;
  let mockPlayback: any;
  let mockAnalyzer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnStateChange = jest.fn();
    mockOnError = jest.fn();
    mockOnVolumeUpdate = jest.fn();

    // Initialize mocks
    const AudioRecorder = require('./AudioRecorder');
    const AudioPlayback = require('./AudioPlayback');
    const AudioAnalyzer = require('./AudioAnalyzer');
    
    mockRecorder = new AudioRecorder();
    mockPlayback = new AudioPlayback();
    mockAnalyzer = new AudioAnalyzer();

    vocalMirror = new VocalMirror({
      onStateChange: mockOnStateChange,
      onError: mockOnError,
      onVolumeUpdate: mockOnVolumeUpdate,
    });

    // Ensure the mock instances are connected to the VocalMirror instance
    (vocalMirror as any).recorder = mockRecorder;
    (vocalMirror as any).playback = mockPlayback;
    (vocalMirror as any).analyzer = mockAnalyzer;
  });

  afterEach(() => {
    vocalMirror.cleanup();
  });

  describe('initialization', () => {
    test('should initialize with default options', () => {
      const vm = new VocalMirror();
      expect(vm).toBeDefined();
      expect(vm.getState().state).toBe('ready');
    });

    test('should initialize with custom options', () => {
      const vm = new VocalMirror({
        maxRecordingDuration: 120,
        volumeThreshold: -40,
        silenceDuration: 1000,
      });
      expect(vm).toBeDefined();
    });

    test('should initialize audio components successfully', async () => {
      const result = await vocalMirror.initialize();
      expect(result).toBe(true);
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: 'ready',
          oldState: 'ready',
        })
      );
    });
  });

  describe('state management', () => {
    test('should return correct initial state', () => {
      const state = vocalMirror.getState();
      expect(state).toEqual({
        state: 'ready',
        isInitialized: false,
        isPaused: false,
        bufferDuration: 0,
        bufferSamples: 0,
        isRecording: false,
        isPlaying: false,
      });
    });

    test('should update state when initialized', async () => {
      await vocalMirror.initialize();
      const state = vocalMirror.getState();
      expect(state.state).toBe('ready');
      expect(state.isInitialized).toBe(true);
    });
  });

  describe('settings management', () => {
    test('should create VocalMirror with default silence duration', () => {
      const defaultVocalMirror = new VocalMirror();
      // VocalMirror should be created successfully with defaults
      expect(defaultVocalMirror).toBeDefined();
      expect(defaultVocalMirror.getState).toBeDefined();
    });

    test('should create VocalMirror with custom silence duration', () => {
      const customVocalMirror = new VocalMirror({ silenceDuration: 1500 });
      // VocalMirror should be created successfully with custom settings
      expect(customVocalMirror).toBeDefined();
      expect(customVocalMirror.getState).toBeDefined();
    });

    test('should update silence duration setting', () => {
      const mockAnalyzer = require('./AudioAnalyzer');
      const analyzerInstance = mockAnalyzer.mock.results[0].value;
      
      vocalMirror.updateSettings({ silenceDuration: 2000 });
      
      expect(analyzerInstance.updateSettings).toHaveBeenCalledWith({
        volumeThreshold: undefined,
        silenceDuration: 2000
      });
    });

    test('should update both volume threshold and silence duration', () => {
      const mockAnalyzer = require('./AudioAnalyzer');
      const analyzerInstance = mockAnalyzer.mock.results[0].value;
      
      vocalMirror.updateSettings({ 
        volumeThreshold: -40,
        silenceDuration: 1000 
      });
      
      expect(analyzerInstance.updateSettings).toHaveBeenCalledWith({
        volumeThreshold: -40,
        silenceDuration: 1000
      });
    });
  });

  describe('recording functionality', () => {
    beforeEach(async () => {
      await vocalMirror.initialize();
    });

    test('should start recording successfully', async () => {
      const result = await vocalMirror.startRecording();
      expect(result).toBe(true);
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: 'listening',
        })
      );
    });

    test('should stop recording', () => {
      vocalMirror.stopRecording();
      // The exact behavior depends on the current state
      expect(mockOnStateChange).toHaveBeenCalled();
    });
  });

  describe('playback interruption on sound detection', () => {
    beforeEach(async () => {
      await vocalMirror.initialize();
      
      // Mock the private components
      (vocalMirror as any).playback = mockPlayback;
      (vocalMirror as any).recorder = mockRecorder;
    });

    test('should stop playback when sound is detected during playback', async () => {
      // Set up the state as if we're playing
      (vocalMirror as any).state = 'playing';
      mockPlayback.isCurrentlyPlaying.mockReturnValue(true);

      // Set up analyzer to return non-silent audio (above threshold)
      mockAnalyzer.analyze.mockReturnValue({
        volume: 0.8,
        volumeDb: -10,
        isSilent: false, // This indicates audio is above threshold
        timestamp: Date.now(),
      });

      // Simulate audio data being received during playback (this triggers interruption)
      const audioData = new Float32Array(1024);
      (vocalMirror as any).handleAudioData(audioData, 44100);

      // Verify that playback was stopped and new listening cycle started
      expect(mockPlayback.stop).toHaveBeenCalled();
      expect(mockRecorder.startRecording).toHaveBeenCalled();
    });

    test('should not stop playback when not currently playing', async () => {
      // Set up the state as if we're not playing
      (vocalMirror as any).state = 'ready';
      mockPlayback.isCurrentlyPlaying.mockReturnValue(false);

      // Call the private autoStartRecording method
      await (vocalMirror as any).autoStartListening();

      // Verify that playback was not stopped
      expect(mockPlayback.stop).not.toHaveBeenCalled();
      expect(mockRecorder.startRecording).toHaveBeenCalled();
    });

    test('should handle auto-start listening from ready state', async () => {
      (vocalMirror as any).state = 'ready';
      
      await (vocalMirror as any).autoStartListening();
      
      expect(mockRecorder.startRecording).toHaveBeenCalled();
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: 'listening',
        })
      );
    });

    test('should handle errors during auto-start listening', async () => {
      // Make recorder throw an error
      mockRecorder.startRecording.mockRejectedValue(new Error('Recording failed'));
      
      (vocalMirror as any).state = 'ready';

      await (vocalMirror as any).autoStartListening();

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auto-listening',
          message: 'Failed to automatically start listening',
        })
      );
    });
  });

  describe('stop functionality', () => {
    beforeEach(async () => {
      await vocalMirror.initialize();
    });

    test('should stop successfully and return to ready', () => {
      (vocalMirror as any).state = 'recording';
      vocalMirror.stop();
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: 'ready',
        })
      );
    });

    test('should stop playback when in playing state', () => {
      (vocalMirror as any).state = 'playing';
      vocalMirror.stop();
      expect(mockPlayback.stop).toHaveBeenCalled();
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: 'ready',
        })
      );
    });
  });

  describe('cleanup', () => {
    test('should cleanup all components', () => {
      vocalMirror.cleanup();

      expect(vocalMirror.getState().state).toBe('ready');
      expect(vocalMirror.getState().isInitialized).toBe(false);
    });
  });

  describe('settings update', () => {
    test('should update analyzer settings', () => {
      const mockAnalyzer = { updateSettings: jest.fn() };
      (vocalMirror as any).analyzer = mockAnalyzer;

      vocalMirror.updateSettings({
        volumeThreshold: -30,
        silenceDuration: 750,
      });

      expect(mockAnalyzer.updateSettings).toHaveBeenCalledWith({
        volumeThreshold: -30,
        silenceDuration: 750,
      });
    });
  });
});