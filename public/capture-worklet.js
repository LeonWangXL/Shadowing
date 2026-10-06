class EchoCapture extends AudioWorkletProcessor {
  constructor() {
    super(); this.active = false; this.ready = false; this.started = false; this.frame = new Float32Array(2048); this.offset = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'start') { this.active = true; this.started = false; this.offset = 0; }
      if (data.type === 'stop') {
        this.flush(); this.active = false; this.port.postMessage({ type: 'stopped' });
      }
    };
  }
  flush() {
    if (this.offset) { const samples = this.frame.slice(0, this.offset); this.port.postMessage({ type: 'samples', samples }, [samples.buffer]); this.offset = 0; }
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input && !this.ready) { this.ready = true; this.port.postMessage({ type: 'ready' }); }
    if (input && this.active && !this.started) { this.started = true; this.port.postMessage({ type: 'started' }); }
    if (this.active && input) for (const sample of input) {
      this.frame[this.offset++] = sample;
      if (this.offset === this.frame.length) this.flush();
    }
    return true;
  }
}
registerProcessor('echo-capture', EchoCapture);
