import { seekMedia } from './mediaSeek';
import { accumulateWaveform } from './waveform';

// Browser media decoder streams only the selected range. No source fetch,
// ArrayBuffer, AudioBuffer or PCM sample accumulation is needed.
export async function sourceWaveform(source: string, start: number, end: number, speed: number, recordingDuration: number, signal: AbortSignal, progress: (value: number) => void) {
  const media = document.createElement('audio');
  media.preload = 'metadata'; media.src = source;
  const context = new AudioContext();
  let node: MediaElementAudioSourceNode | undefined, worklet: AudioWorkletNode | undefined;
  const cleanups: (() => void)[] = [];
  const abortError = () => new DOMException('Cancelled', 'AbortError');
  try {
    await context.resume();
    await new Promise<void>((resolve, reject) => {
      const ready = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('无法读取原声音轨，请检查素材编码。')); };
      const abort = () => { cleanup(); reject(abortError()); };
      const timeout = setTimeout(fail, 15000);
      const cleanup = () => { clearTimeout(timeout); media.removeEventListener('loadedmetadata', ready); media.removeEventListener('error', fail); signal.removeEventListener('abort', abort); };
      cleanups.push(cleanup);
      media.addEventListener('loadedmetadata', ready); media.addEventListener('error', fail); signal.addEventListener('abort', abort, {once:true});
      if (signal.aborted) abort(); else if (media.readyState >= 1) ready();
    });
    const boundedEnd = Number.isFinite(media.duration) ? Math.min(end, media.duration) : end;
    if (start >= boundedEnd) throw new Error('这段字幕没有对应原声，请调整时间轴。');
    if (signal.aborted) throw abortError();
    await context.audioWorklet.addModule('/waveform-worklet.js');
    if (signal.aborted) throw abortError();
    node = context.createMediaElementSource(media);
    worklet = new AudioWorkletNode(context, 'waveform-energy');
    node.connect(worklet); worklet.connect(context.destination);
    // Freeze the render clock until playback has established its anchor.
    // Otherwise initial packets can arrive before the main-thread playing event.
    await context.suspend();
    await seekMedia(media, start, signal);
    const originalDuration = (boundedEnd - start) / speed;
    const timeline = Math.max(originalDuration, recordingDuration);
    const energies = new Float64Array(240), counts = new Float64Array(240);
    let anchor: number | undefined, flushed: (() => void) | undefined;
    worklet.port.onmessage = ({data}) => {
      if (data.flushed) { flushed?.(); return; }
      if (anchor === undefined || signal.aborted) return;
      accumulateWaveform(energies, counts, data.energy, data.count, (data.time - anchor) / speed, data.duration / speed, originalDuration, timeline);
    };
    // Sample native audio at 1x; stretch only the display timeline.
    // Browser pitch-preserving playback can shift samples at slow rates.
    media.playbackRate = 1;
    await new Promise<void>((resolve, reject) => {
      let complete = false;
      const finish = (error?: Error) => { if (complete) return; complete = true; cleanup(); media.pause(); error ? reject(error) : resolve(); };
      const playing = () => { if (anchor === undefined) { anchor = context.currentTime; void context.resume().catch(() => finish(new Error('音频采样无法启动，请重试。'))); } };
      const stalled = () => { if (anchor !== undefined) finish(new Error('原声播放发生缓冲，无法保证波形时间对应，请重试。')); };
      const ended = () => finish(), failed = () => finish(new Error('原声采样中断，请重试。')), aborted = () => finish(abortError());
      const poll = setInterval(() => { progress(Math.min(1, (media.currentTime - start) / (boundedEnd - start))); if (media.currentTime >= boundedEnd) finish(); }, 25);
      const timeout = setTimeout(() => finish(new Error('原声采样超时，录音波形已保留。')), (boundedEnd - start) * 1000 + 30000);
      const cleanup = () => { clearInterval(poll); clearTimeout(timeout); media.removeEventListener('playing', playing); media.removeEventListener('waiting', stalled); media.removeEventListener('ended', ended); media.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); };
      cleanups.push(cleanup);
      media.addEventListener('playing', playing); media.addEventListener('waiting', stalled); media.addEventListener('ended', ended); media.addEventListener('error', failed); signal.addEventListener('abort', aborted, {once:true});
      if (signal.aborted) aborted(); else void media.play().catch(() => finish(new Error('浏览器阻止原声采样，请点击对比按钮重试。')));
    });
    await new Promise<void>(resolve => { const timeout = setTimeout(resolve, 300); flushed = () => { clearTimeout(timeout); resolve(); }; worklet!.port.postMessage('flush'); });
    if (signal.aborted) throw abortError();
    if (!counts.some(value => value > 0)) throw new Error('未能采集原声音轨，录音波形已保留。');
    progress(1);
    return { original: Array.from(energies, (energy, i) => counts[i] ? Math.sqrt(energy / counts[i]) : 0), originalDuration, timeline };
  } finally {
    cleanups.forEach(cleanup => cleanup()); media.pause();
    node?.disconnect(); worklet?.disconnect();
    media.removeAttribute('src'); media.load();
    await context.close().catch(() => {});
  }
}
