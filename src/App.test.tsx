import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Mock the VocalMirror class
jest.mock('./VocalMirror', () => {
  return {
    default: jest.fn().mockImplementation((options) => {
      // Immediately call the onStateChange callback with initial state
      setTimeout(() => {
        options.onStateChange?.({
          newState: 'idle',
          oldState: 'idle',
          timestamp: Date.now(),
          stateInfo: {
            state: 'idle',
            isInitialized: false,
            isPaused: false,
            bufferDuration: 0,
            bufferSamples: 0,
            isRecording: false,
            isPlaying: false,
          },
        });
      }, 0);

      return {
        cleanup: jest.fn(),
        startRecording: jest.fn().mockResolvedValue(true),
        pause: jest.fn(),
        resume: jest.fn(),
      };
    }),
  };
});

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
  });

  test('renders Vocal Mirror heading', () => {
    render(<App />);
    const heading = screen.getByText(/Vocal Mirror/i);
    expect(heading).toBeInTheDocument();
  });

  test('renders description text', () => {
    render(<App />);
    const description = screen.getByText(/Vocal Mirror is a simple web tool/i);
    expect(description).toBeInTheDocument();
  });

  test('renders the main button', async () => {
    render(<App />);
    
    // Wait for the state to update and button to appear
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  test('button displays correct initial text', async () => {
    render(<App />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Ready');
    });
  });

  test('status text displays correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      const statusText = screen.getByText(/Click to initialize microphone/i);
      expect(statusText).toBeInTheDocument();
    });
  });

  test('component returns JSX elements', () => {
    const { container } = render(<App />);
    
    // Check that the wrapper div exists
    const wrapper = container.querySelector('#wrapper');
    expect(wrapper).toBeInTheDocument();
    
    // Check that display div exists
    const display = container.querySelector('#display');
    expect(display).toBeInTheDocument();
    
    // Verify the component actually renders content
    expect(container.firstChild).toBeTruthy();
  });

  test('VocalMirror is initialized on mount', () => {
    const VocalMirror = require('./VocalMirror').default;
    render(<App />);
    
    expect(VocalMirror).toHaveBeenCalledTimes(1);
    expect(VocalMirror).toHaveBeenCalledWith(
      expect.objectContaining({
        onStateChange: expect.any(Function),
        onError: expect.any(Function),
        onVolumeUpdate: expect.any(Function),
      })
    );
  });
});