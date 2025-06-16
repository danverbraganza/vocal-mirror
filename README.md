# Vocal Mirror
## A simple web tool for vocal practice with instant feedback.

Created by Danver Braganza  
Coded with Sculptor by Imbue

Vocal Mirror is a simple tool intended for vocal practice and giving rapid
feedback on speech. It is a Single Page Web Application which requests
microphone permissions and provides an automatic feedback loop for
vocal practice with intelligent interruption capabilities.

## How It Works

Vocal Mirror operates in a seamless four-state cycle:

1. **Ready**: Initial state - click "Start" to begin
2. **Listening**: Actively monitoring for speech above the threshold
3. **Recording**: Capturing audio to buffer while monitoring for silence  
4. **Playing**: Playing back recorded audio while simultaneously listening for interruption

## Intelligent State Flow

### Ready → Listening → Recording → Playing → Listening (cycle continues)

1. **Start Session**: Click "Start" to begin listening for audio input
2. **Voice Detection**: App detects speech above the configurable threshold and begins recording
3. **Automatic Playback**: Recording stops and playback begins when you pause for the configured silence duration
4. **Smart Interruption**: During playback, speak at normal volume to immediately interrupt and start a new recording
5. **Continuous Cycle**: Creates a seamless practice loop with instant feedback

## Key Features

### 🎯 **Instant Interruption**
- Speak during playback to immediately interrupt and start recording new audio
- Uses the same sensitivity threshold for starting and interrupting (fully configurable)
- No need to wait for playback to finish - get immediate feedback

### ⚙️ **Fully Configurable**
- **Silence Level**: Adjust volume threshold (-70 to -20 dB) to match your environment
- **Silence Duration**: Set how long to wait (0.1 to 2.0 seconds) before triggering playback
- Real-time adjustment while practicing

### 📊 **Visual Feedback**
- Real-time volume meter during listening and recording
- Clear state indicators showing current app behavior
- Visual threshold guidance for optimal settings

## Controls

- **Start**: Begin the vocal practice session (Ready → Listening)
- **Stop**: Exit the practice cycle at any time (Any State → Ready)
- **Silence Level Slider**: Adjust volume sensitivity for your environment
- **Silence Duration Slider**: Control how quickly playback triggers

## Use Cases

### 🎤 **Vocal Practice**
- Practice pronunciation, intonation, and vocal exercises
- Immediate feedback for accent reduction and speech therapy
- Safe space to experiment with vocal techniques

### 🎭 **Performance Preparation**  
- Rehearse speeches, presentations, or performance pieces
- Perfect timing and delivery with real-time feedback
- Practice interruption recovery and natural flow

### 🗣️ **Speech Training**
- Language learning with pronunciation feedback
- Public speaking practice with natural pause detection
- Vocal therapy and rehabilitation exercises

## Technical Details

### Architecture
- **Frontend**: React with TypeScript for type-safe component architecture
- **Audio Engine**: Web Audio API for high-quality recording and playback
- **Real-time Processing**: Continuous audio analysis with configurable silence detection
- **State Management**: Clean state machine with predictable transitions

### Audio Processing
- **Simultaneous Operations**: Records and plays audio concurrently for interruption detection
- **Configurable Thresholds**: User-adjustable volume sensitivity (-70 to -20 dB range)
- **Efficient Buffering**: 5-minute circular buffer with intelligent memory management
- **Cross-browser Support**: Compatible with modern browsers supporting Web Audio API

### Performance
- **Low Latency**: Optimized for real-time audio processing and feedback
- **Memory Efficient**: Smart buffer management prevents memory leaks during long sessions
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Browser Compatibility

Requires a modern browser with Web Audio API support:
- Chrome 66+ (recommended for best performance)
- Firefox 60+
- Safari 14+
- Edge 79+

## Getting Started

1. Open the application in a compatible browser
2. Grant microphone permissions when prompted
3. Adjust silence level and duration settings to match your environment
4. Click "Start" to begin your vocal practice session
5. Speak naturally - the app will automatically handle recording and playback
