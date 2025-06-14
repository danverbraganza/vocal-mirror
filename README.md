# Vocal Mirror
## A simple web tool for vocal practice.

Created by Danver Braganza
Coded with Sculptor by Imbue

Vocal Mirror is a simple tool intended for vocal practice and giving rapid
feedback on speech. It is a Single Page Web Application which requests
permissions to record the user and provides an automatic feedback loop for
vocal practice.

## How It Works

Vocal Mirror operates in three main modes:

1. **Recording Mode**: Continuously records audio from the user to a buffer (maximum 5 minutes)
2. **Playback Mode**: Plays back the recorded audio to the user  
3. **Paused Mode**: Stops the automatic cycle, allowing manual control

## Automatic Workflow

1. **Start Recording**: Click "Start Recording" to begin the vocal practice session
2. **Automatic Playback**: Recording automatically stops and plays back when:
   - You stop speaking for 0.5 seconds (quick response for immediate feedback)
   - The 5-minute maximum recording time is reached
3. **Automatic Recording**: After playback completes, recording automatically starts again
4. **Continuous Cycle**: This creates a seamless record → playback → record cycle for uninterrupted practice

## Controls

- **Start Recording**: Begin the vocal practice session
- **Pause**: Stop the automatic cycle at any time (during recording or playback)
- **Resume**: Restart the automatic cycle from the paused state

## Features

- **Fast Feedback**: Only 0.5 seconds of silence needed to trigger playback (reduced from 2 seconds for snappier response)
- **Automatic Workflow**: No need to manually start/stop - just speak and listen
- **Volume Monitoring**: Real-time volume level display during recording
- **Error Handling**: Graceful handling of microphone permissions and audio errors
- **Browser Compatible**: Works in modern web browsers with Web Audio API support

## Technical Details

- Uses Web Audio API for high-quality audio recording and playback
- Real-time silence detection with configurable volume threshold (-50 dB default)
- Circular buffer for efficient memory usage during long recording sessions
- Responsive design that works on desktop and mobile devices
