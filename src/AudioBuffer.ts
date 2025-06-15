interface AudioChunk {
  data: Float32Array;
  duration: number;
  timestamp: number;
}

class AudioBuffer {
  private readonly maxDurationSeconds: number;
  private chunks: AudioChunk[] = [];
  private currentDuration = 0;
  private sampleRate: number | null = null;
  private discardSilence = false;
  private hasReceivedAudio = false;

  constructor(maxDurationSeconds = 300) {
    this.maxDurationSeconds = maxDurationSeconds;
  }

  addData(audioData: Float32Array, sampleRate: number, isSilent = false): void {
    if (!this.sampleRate) this.sampleRate = sampleRate;

    // If discarding silence and we haven't received non-silent audio yet
    if (this.discardSilence && !this.hasReceivedAudio) {
      if (isSilent) {
        return; // Discard silent audio
      } else {
        this.hasReceivedAudio = true; // First non-silent audio received
      }
    }

    const chunkDuration = audioData.length / sampleRate;
    
    this.chunks.push({
      data: new Float32Array(audioData),
      duration: chunkDuration,
      timestamp: Date.now()
    });
    
    this.currentDuration += chunkDuration;
    this.enforceMaxDuration();
  }

  getAllData(): Float32Array {
    if (this.chunks.length === 0) return new Float32Array(0);
    
    const totalSamples = this.chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const result = new Float32Array(totalSamples);
    
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk.data, offset);
      offset += chunk.data.length;
    }
    
    return result;
  }

  clear(): void {
    this.chunks = [];
    this.currentDuration = 0;
    this.hasReceivedAudio = false;
  }

  setDiscardInitialSilence(discard: boolean): void {
    this.discardSilence = discard;
    if (discard) {
      this.hasReceivedAudio = false;
    }
  }

  getDuration(): number {
    return this.currentDuration;
  }

  getSampleCount(): number {
    return this.chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
  }

  private enforceMaxDuration(): void {
    while (this.currentDuration > this.maxDurationSeconds && this.chunks.length > 1) {
      const removedChunk = this.chunks.shift()!;
      this.currentDuration -= removedChunk.duration;
    }
  }
}

export default AudioBuffer;