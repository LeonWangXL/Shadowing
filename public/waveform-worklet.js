class WaveformEnergy extends AudioWorkletProcessor {
  process(inputs) {
    const channels = inputs[0];
    if (channels?.length) {
      let energy = 0, count = 0;
      for (const channel of channels) for (const value of channel) { energy += value * value; count++; }
      this.port.postMessage({energy, count, time:currentTime, duration:channels[0].length / sampleRate});
    }
    // Outputs remain silent. No PCM is retained or transferred.
    return true;
  }
  constructor() {
    super();
    this.port.onmessage = ({data}) => { if (data === 'flush') this.port.postMessage({flushed:true}); };
  }
}
registerProcessor('waveform-energy', WaveformEnergy);
