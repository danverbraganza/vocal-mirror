/**
 * Circular audio buffer for storing recorded audio data
 * Maintains a 5-minute maximum with automatic overflow handling
 */
class AudioBuffer {
  constructor(maxDurationSeconds = 300) { // 5 minutes default
    this.maxDurationSeconds = maxDurationSeconds;
    this.chunks = [];
    this.currentDuration = 0;
    this.sampleRate = null;
  }

  /**
   * Add audio data to the buffer
   * @param {Float32Array} audioData - Audio samples
   * @param {number} sampleRate - Sample rate of the audio
   */
  addData(audioData, sampleRate) {
    if (!this.sampleRate) {
      this.sampleRate = sampleRate;
    }

    const chunkDuration = audioData.length / sampleRate;
    
    // Add new chunk
    this.chunks.push({
      data: new Float32Array(audioData),
      duration: chunkDuration,
      timestamp: Date.now()
    });
    
    this.currentDuration += chunkDuration;
    
    // Remove old chunks if we exceed max duration
    this._enforceMaxDuration();
  }

  /**
   * Get all audio data as a single Float32Array
   * @returns {Float32Array} Combined audio data
   */
  getAllData() {
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

  /**
   * Clear all buffered data
   */
  clear() {
    this.chunks = [];
    this.currentDuration = 0;
  }

  /**
   * Get current buffer duration in seconds
   * @returns {number} Duration in seconds
   */
  getDuration() {
    return this.currentDuration;
  }

  /**
   * Get current buffer size in samples
   * @returns {number} Number of samples
   */
  getSampleCount() {
    return this.chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
  }

  /**
   * Remove old chunks to stay within max duration
   * @private
   */
  _enforceMaxDuration() {
    while (this.currentDuration > this.maxDurationSeconds && this.chunks.length > 1) {
      const removedChunk = this.chunks.shift();
      this.currentDuration -= removedChunk.duration;
    }
  }
}

export default AudioBuffer;