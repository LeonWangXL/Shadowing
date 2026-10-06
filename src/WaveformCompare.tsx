import { useEffect, useRef, useState } from 'react';
import type { Attempt, Segment } from './types';
import { waveformEnvelope } from './waveform';
import { sourceWaveform } from './sourceWaveform';

type Comparison = { original?: number[]; recording: number[]; timeline: number; originalDuration?: number; recordingDuration: number; speed: number };
export function WaveformCompare({ attempt, reference, source, disabled = false, onStart }: { attempt: Attempt; reference: Segment; source: string; disabled?: boolean; onStart: () => void }) {
  const [result, setResult] = useState<Comparison>();
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const originalCanvas = useRef<HTMLCanvasElement>(null), recordingCanvas = useRef<HTMLCanvasElement>(null);
  const generation = useRef(0);
  const recordingBuffer = useRef<AudioBuffer | undefined>(undefined);
  const pending = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    const token = ++generation.current;
    pending.current?.abort(); recordingBuffer.current = undefined;
    setResult(undefined); setError(''); setLoading(false);
    const context = new AudioContext();
    void (async () => {
      try {
        const audio = await context.decodeAudioData(await attempt.blob.arrayBuffer());
        if (token !== generation.current) return;
        recordingBuffer.current = audio;
        const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
        setResult({ recording: waveformEnvelope(channels, audio.sampleRate, 0, audio.duration, audio.duration), timeline: audio.duration, recordingDuration: audio.duration, speed: attempt.referenceSpeed || 1 });
      } catch { if (token === generation.current) setError('录音波形解析失败，仍可使用下方播放器回听。'); }
      finally { await context.close().catch(() => {}); }
    })();
    return () => { generation.current++; pending.current?.abort(); recordingBuffer.current = undefined; };
  }, [attempt.id, attempt.blob, source, reference.start, reference.end]);
  useEffect(() => {
    if (!result) return;
    const peak = Math.max(...(result.original || []), ...result.recording, 0.001);
    for (const [canvas, envelope, color] of [[originalCanvas.current, result.original, '#245d4d'], [recordingCanvas.current, result.recording, '#b97d40']] as const) {
      const context = canvas?.getContext('2d'); if (!canvas || !context || !envelope) continue;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#dce5de'; context.beginPath(); context.moveTo(0, 50); context.lineTo(canvas.width, 50); context.stroke();
      context.fillStyle = color;
      envelope.forEach((value, i) => { const height = value / peak * 43; context.fillRect(i / envelope.length * canvas.width, 50 - height, canvas.width / envelope.length * 0.72, height * 2 || 1); });
    }
  }, [result]);
  async function generate() {
    const token = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(''); setProgress(0); onStart();
    try {
      const recording = recordingBuffer.current;
      if (!recording) throw new Error('录音尚未准备好。');
      const speed = attempt.referenceSpeed || 1;
      const sampled = await sourceWaveform(source, attempt.referenceStart ?? reference.start, attempt.referenceEnd ?? reference.end, speed, recording.duration, controller.signal, value => { if (token === generation.current) setProgress(Math.floor(value * 100)); });
      if (token !== generation.current) return;
      const channels = Array.from({ length: recording.numberOfChannels }, (_, i) => recording.getChannelData(i));
      setResult({ ...sampled, recording: waveformEnvelope(channels, recording.sampleRate, 0, recording.duration, sampled.timeline), recordingDuration: recording.duration, speed });
    } catch (cause) { if (token === generation.current && (cause as Error).name !== 'AbortError') setError((cause as Error).message || '原声采样失败，录音波形已保留。'); }
    finally { if (token === generation.current) setLoading(false); }
  }
  return <section className="waveform-compare" aria-label="原声与录音声波对比"><div className="section-heading"><h3>声波对比</h3><button className="text-button" disabled={disabled || loading || !source || !result} onClick={() => void generate()}>{loading ? `采样原声 ${progress}%` : result?.original ? '重新对比原声' : '对比原声'}</button></div>
    {!result && !error && <p className="small muted">正在生成我的录音波形…</p>}
    {loading && <p className="small muted">正在静音采样所选原声片段，按 1.0x 采样，计算时间接近原始片段时长。<button className="text-button" onClick={() => pending.current?.abort()}>取消采样</button></p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <><div className="waveform-track recording-wave"><span>我的录音 · {result.recordingDuration.toFixed(1)} 秒</span><canvas ref={recordingCanvas} width={960} height={100} role="img" aria-label="我的录音振幅波形" /></div>{result.original && <div className="waveform-track"><span>原声 · {result.originalDuration!.toFixed(1)} 秒 · {result.speed.toFixed(1)}x</span><canvas ref={originalCanvas} width={960} height={100} role="img" aria-label="原声振幅波形" /></div>}<div className="waveform-axis"><span>0 秒</span><span>{(result.timeline / 2).toFixed(1)} 秒</span><span>{result.timeline.toFixed(1)} 秒</span></div><p className="small muted">{result.original ? '两条波形共用时间与振幅刻度，原声按练习语速换算时间轴，未做逐词对齐。波形相似度不能代表发音准确度。' : '默认仅显示我的录音。点击“对比原声”后静音采样所选片段，不解码整份素材。'}</p>{result.original && attempt.referenceStart === undefined && <p className="small muted">历史录音没有保存当时的播放速度和时间轴，原声按当前字幕与 1.0x 显示。</p>}</>}
  </section>;
}
