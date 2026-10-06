// Development-only integration harness. Not a production entry point.
// Exercises the real AudioWorklet, resampler, WAV encoder, practice engine and IndexedDB
// using a generated signal. It never requests a real microphone or any cloud service.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createRecorder, encodeWav } from '../src/audio';
import type { Recorder } from '../src/audio';
import type { Attempt, Lesson, Settings } from '../src/types';
import { usePractice } from '../src/usePractice';
import * as storage from '../src/storage';
import { practiceGroup } from '../src/practiceGroup';
import { sourceWaveform } from '../src/sourceWaveform';

if (!import.meta.env.DEV) throw new Error('The diagnostics harness is development-only.');
const lesson: Lesson = { id: 'browser-diagnostics', title: 'Synthetic test signal', kind: 'audio', createdAt: 0, sourceUrl: '/demo.wav', segments: [{ id: '1', start: 0.65, end: 1.65, text: 'First test.' }, { id: '2', start: 4.8, end: 5.8, text: 'Second test.' }] };
async function syntheticRecorder(): Promise<Recorder> {
  const signalContext = new AudioContext(); await signalContext.resume();
  const destination = signalContext.createMediaStreamDestination();
  const oscillator = signalContext.createOscillator(); oscillator.frequency.value = 440;
  const gain = signalContext.createGain(); gain.gain.value = 0.15;
  oscillator.connect(gain); gain.connect(destination); oscillator.start();
  const capture = await createRecorder(async () => destination.stream);
  const cleanup = () => { oscillator.stop(); void signalContext.close(); };
  return { ...capture, async finish() { try { return await capture.finish(); } finally { cleanup(); } }, dispose() { capture.dispose(); cleanup(); } };
}
function Runner() {
  const media = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(0), [records, setRecords] = useState<Attempt[]>([]), [messages, setMessages] = useState<string[]>([]), [saved, setSaved] = useState('');
  const [settings, setSettings] = useState<Settings>({ speed: 1, repeat: true, repeats: 2, autoNext: true, mode: 'listen', hideText: false, recordingSeconds: 0, groupSize: 1 });
  const engine = usePractice({ media, lesson, index, select: setIndex, settings, recorderFactory: syntheticRecorder, notify: message => setMessages(previous => [...previous, message]), captured: async (audio, source, i, group) => {
    const record = { id: `diagnostic-${crypto.randomUUID()}`, lessonId: source.id, segmentId: group.id, segmentIds: group.segmentIds, text: group.text, createdAt: Date.now(), ...audio };
    await storage.save('attempts', record); setRecords(previous => [...previous, record]);
  } });
  const current = records.at(-1);
  const [url, setUrl] = useState('');
  async function testSourceTiming() {
    const rate = 16000, samples = new Float32Array(rate * 6);
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate;
      const amplitude = t < 0.25 || t >= 2 && t < 2.25 || t >= 2.5 && t < 3 || t >= 4 ? 0.3 : 0;
      samples[i] = amplitude * Math.sin(2 * Math.PI * 440 * t);
    }
    const source = URL.createObjectURL(new Blob([encodeWav(samples)], {type:'audio/wav'}));
    setSaved('Timing test running…');
    try {
      const results = [];
      for (const start of [0, 2]) for (const speed of [1, 0.8]) {
        const data = await sourceWaveform(source, start, start + 2, speed, 0, new AbortController().signal, () => {});
        const first = data.original.findIndex(value => value > 0.05);
        const onset = data.original.slice(0,25).filter(value=>value>0.05).length;
        const silent = data.original.slice(35,50).every(value=>value<0.01);
        const middle = start === 0 || data.original.slice(65,110).every(value=>value>0.05);
        const tail = data.original.slice(135,230).every(value=>value<0.01);
        results.push({start, speed, first, onset, silent, middle, tail, pass:first <= 1 && first >= 0 && onset >= 23 && silent && middle && tail});
      }
      setSaved('Source timing results: ' + JSON.stringify(results));
    } catch (error) { setSaved('Source timing failed: ' + (error as Error).message); }
    finally { URL.revokeObjectURL(source); }
  }
  async function installFixture() {
    if (!current) return;
    const id = 'diagnostic-ui-fixture';
    await storage.save('attempts', { ...current, id, lessonId: 'echo-small-steps', segmentId: 's3', text: 'Small steps make a big difference.' });
    setSaved('Synthetic UI fixture installed; reload practice page. No pronunciation score.');
  }
  async function cleanFixture() { await storage.remove('attempts', 'diagnostic-ui-fixture'); setSaved('Synthetic UI fixture removed'); }
  return <main style={{fontFamily:'sans-serif',maxWidth:900,margin:'40px auto',padding:20}}><h1>Echo 录音与流程集成验证</h1><p>合成信号，不访问真实麦克风，不调用云服务。</p><audio src="/demo.wav" ref={media} preload="auto" controls /><p role="status">phase: {engine.phase} | sentence: {index + 1} | round: {engine.round} | recordings: {records.length} | elapsed: {engine.elapsed.toFixed(2)}</p><label>句组<select aria-label="诊断句组" value={settings.groupSize} disabled={engine.busy} onChange={e => setSettings({...settings,groupSize:Number(e.target.value)})}><option value={1}>1 句</option><option value={2}>2 句</option></select></label> <label>录音秒数<select aria-label="诊断录音时长" value={settings.recordingSeconds} disabled={engine.busy} onChange={e => setSettings({...settings, recordingSeconds:Number(e.target.value), repeat:false, autoNext:false})}><option value={0}>自动</option><option value={35}>35 秒长录音验证</option></select></label> <label>模式<select aria-label="诊断模式" value={settings.mode} disabled={engine.busy} onChange={e => setSettings({...settings,mode:e.target.value as Settings['mode']})}><option value="listen">listen</option><option value="manual">manual</option><option value="shadow">shadow</option></select></label> <button disabled={engine.busy} onClick={() => { setIndex(0); setRecords([]); setMessages([]); void engine.start(0); }}>运行自动练习测试</button> <button disabled={engine.phase !== 'waiting'} onClick={engine.record}>手动开始录音</button><button disabled={!engine.busy} onClick={engine.stop}>停止测试</button><button disabled={!current || engine.busy} onClick={async () => { const all = await storage.list<Attempt>('attempts'); const found = all.filter(a => a.lessonId === lesson.id); setSaved(`IndexedDB: ${found.length} recordings; all WAV: ${found.every(a=>a.blob.type==='audio/wav')}`); const audioContext = new AudioContext(); const decoded = await audioContext.decodeAudioData(await current!.blob.arrayBuffer()); const header = new DataView(await current!.blob.arrayBuffer()); setMessages(previous => [...previous, `WAV header: ${header.getUint32(24,true)}Hz mono PCM; WAV decode: ${decoded.duration.toFixed(3)}s, ${decoded.sampleRate}Hz, ${decoded.numberOfChannels} channel(s)`]); await audioContext.close(); if(url)URL.revokeObjectURL(url);setUrl(URL.createObjectURL(current!.blob)); }}>验证持久化与WAV</button><button disabled={engine.busy} onClick={async () => { for(const record of (await storage.list<Attempt>('attempts')).filter(a=>a.lessonId===lesson.id)) await storage.remove('attempts',record.id); setSaved('Diagnostic records cleaned'); setRecords([]); }}>清理诊断录音</button><button disabled={!current || engine.busy} onClick={installFixture}>添加界面测试录音</button><button onClick={cleanFixture}>移除界面测试录音</button><button onClick={async () => { const signal = (await storage.list<Attempt>('attempts')).find(a => a.lessonId === lesson.id); if (!signal) { setSaved('No synthetic recording available. Run capture first.'); return; } const cues = await (await fetch('/demo.json')).json(); const group = practiceGroup(cues, 0, 3); await storage.save('attempts', { ...signal, id: 'waveform-ui-fixture', lessonId: 'echo-small-steps', segmentId: group.id, segmentIds: group.segmentIds, text: group.text, referenceStart: group.start, referenceEnd: group.end, referenceSpeed: 1 }); setSaved('Synthetic waveform fixture installed. Not a real voice or score.'); }}>添加声波测试录音</button><button onClick={async () => { await storage.remove('attempts', 'waveform-ui-fixture'); setSaved('Waveform fixture removed'); }}>移除声波测试录音</button><button onClick={() => void testSourceTiming()}>验证原声波形时间映射</button><p>{saved}</p>{url && <audio src={url} controls />}<pre>{JSON.stringify(records.map(({blob,...data})=>({...data,bytes:blob.size})),null,2)}</pre>{messages.map((message,i)=><p key={i}>{message}</p>)}</main>;
}
createRoot(document.getElementById('root')!).render(<Runner />);
