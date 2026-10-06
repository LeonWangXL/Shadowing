export interface CapturedAudio { blob: Blob; duration: number; rms: number; peak: number }
export interface Recorder { start: () => Promise<void>; finish: () => Promise<CapturedAudio>; dispose: () => void; level: () => number }

export function encodeWav(samples: Float32Array, sampleRate = 16000): ArrayBuffer {
  const data = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(data);
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => { const s = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + index * 2, s < 0 ? s * 32768 : s * 32767, true); });
  return data;
}

export async function createRecorder(acquireStream?: () => Promise<MediaStream>): Promise<Recorder> {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error('此浏览器无法录音，请使用最新版 Chrome 或 Edge，并在 HTTPS 或 localhost 打开。');
  let stream: MediaStream;
  try { stream = acquireStream ? await acquireStream() : await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false }); }
  catch (error) {
    const name = (error as DOMException).name;
    if (name === 'NotAllowedError') throw new Error('麦克风权限未开启。请在浏览器网站权限中允许麦克风后重试。');
    if (name === 'NotFoundError') throw new Error('没有找到麦克风，请连接设备后重试。');
    throw new Error('无法访问麦克风，请检查设备是否被其他程序占用。');
  }
  const context = new AudioContext();
  let source: MediaStreamAudioSourceNode | undefined;
  let capture: AudioWorkletNode | undefined;
  const chunks: Float32Array[] = [];
  let capturedSamples = 0;
  const maxSamples = Math.floor(context.sampleRate * 300);
  let active = false, currentLevel = 0, finishing = false;
  let onStarted: (() => void) | undefined;
  const dispose = () => { active = false; stream.getTracks().forEach(track => track.stop()); source?.disconnect(); capture?.disconnect(); void context.close().catch(() => {}); };
  try {
    await context.resume();
    await context.audioWorklet.addModule('/capture-worklet.js');
    source = context.createMediaStreamSource(stream);
    capture = new AudioWorkletNode(context, 'echo-capture');
    const ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('录音设备没有传入音频。')), 3000);
      capture!.port.onmessage = event => { if (event.data.type === 'ready') { clearTimeout(timeout); resolve(); } };
    });
    const initialHandler = capture.port.onmessage;
    capture.port.onmessage = event => {
      initialHandler?.call(capture!.port, event);
      if (event.data.type === 'started') onStarted?.();
      if (event.data.type === 'samples' && active) {
        const samples = event.data.samples as Float32Array;
        const remaining = maxSamples - capturedSamples;
        if (remaining > 0) { const bounded = samples.slice(0, remaining); chunks.push(bounded); capturedSamples += bounded.length; }
        let energy = 0; for (const sample of samples) energy += sample * sample;
        currentLevel = Math.min(1, Math.sqrt(energy / samples.length) * 6);
      }
    };
    source.connect(capture); capture.connect(context.destination);
    await ready;
  } catch { dispose(); throw new Error('录音初始化失败，请使用支持 AudioWorklet 的浏览器并重试。'); }
  return {
    async start() {
      if (finishing) throw new Error('录音已结束。');
      chunks.length = 0; capturedSamples = 0; active = true; currentLevel = 0;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('录音启动超时，请重试。')), 3000);
        onStarted = () => { clearTimeout(timeout); onStarted = undefined; resolve(); };
        capture!.port.postMessage({ type: 'start' });
      });
    },
    level: () => currentLevel,
    dispose,
    async finish() {
      if (finishing) throw new Error('录音已结束。');
      finishing = true;
      // The worklet flushes its final partial frame before acknowledging stop.
      await new Promise<void>(resolve => {
        const previous = capture!.port.onmessage;
        capture!.port.onmessage = event => {
          if (event.data.type === 'stopped') resolve();
          else previous?.call(capture!.port, event);
        };
        capture!.port.postMessage({ type: 'stop' });
        setTimeout(resolve, 1000);
      });
      active = false;
      const count = Math.min(chunks.reduce((total, chunk) => total + chunk.length, 0), maxSamples);
      const duration = count / context.sampleRate;
      if (!count || duration < 0.3) { dispose(); throw new Error('录音太短，请至少朗读半秒后结束。'); }
      const samples = new Float32Array(count);
      let offset = 0, energy = 0, peak = 0;
      for (const chunk of chunks) { const length = Math.min(chunk.length, count - offset); if (length <= 0) break; samples.set(chunk.subarray(0, length), offset); offset += length; }
      for (const value of samples) { energy += value * value; peak = Math.max(peak, Math.abs(value)); }
      const inputRate = context.sampleRate;
      dispose();
      const offline = new OfflineAudioContext(1, Math.ceil(duration * 16000), 16000);
      const buffer = offline.createBuffer(1, samples.length, inputRate);
      buffer.copyToChannel(samples, 0);
      const node = offline.createBufferSource(); node.buffer = buffer; node.connect(offline.destination); node.start();
      const rendered = await offline.startRendering();
      return { blob: new Blob([encodeWav(rendered.getChannelData(0))], { type: 'audio/wav' }), duration, rms: Math.sqrt(energy / count), peak };
    },
  };
}
