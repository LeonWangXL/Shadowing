import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseSubtitles, parseTimestamp, formatTime, validateSegments, serializeSrt, playableSegment } from '../src/subtitles.ts';
import { encodeWav } from '../src/audio.ts';
import { articleSentences } from '../src/article.ts';

test('articles preserve sentences, abbreviations, Chinese and long text without truncation', () => {
  assert.deepEqual(articleSentences('Dr. Smith walks. Next step!\n第三句话。第四句话！', 'en'), ['Dr. Smith walks.', 'Next step!', '第三句话。', '第四句话！']);
  const long = 'a'.repeat(4001);
  assert.equal(articleSentences(long, 'en').join(''), long);
  assert.throws(() => articleSentences(' \n ', 'en'), /请输入/);
});
import { recordingDuration } from '../src/practiceTiming.ts';
import type { Settings } from '../src/types.ts';
import { seekMedia } from '../src/mediaSeek.ts';
import { practiceGroup, segmentAtPosition } from '../src/practiceGroup.ts';
import { waveformEnvelope, accumulateWaveform } from '../src/waveform.ts';

test('source packets carry audio-clock timing and stereo energy without PCM', () => {
  const packets: any[] = []; let Processor: any;
  class Base { port = { onmessage: undefined as any, postMessage: (value: any) => packets.push(value) }; }
  runInNewContext(readFileSync(new URL('../public/waveform-worklet.js', import.meta.url), 'utf8'), { AudioWorkletProcessor: Base, currentTime: 12, sampleRate: 48000, registerProcessor: (_: string, value: any) => { Processor = value; } });
  const processor = new Processor();
  processor.process([[new Float32Array(128).fill(1), new Float32Array(128).fill(-1)]]);
  assert.equal(packets[0].energy, 256); assert.equal(packets[0].count, 256);
  assert.equal(packets[0].time, 12); assert.equal(packets[0].duration, 128 / 48000);
  assert.deepEqual(Object.keys(packets[0]).sort(), ['count', 'duration', 'energy', 'time']);
});
test('packet mapping clips preroll/tail, splits bins and ignores delivery order', () => {
  const energies = new Float64Array(4), counts = new Float64Array(4);
  accumulateWaveform(energies, counts, 20, 20, 0.5, 1, 2, 4);
  accumulateWaveform(energies, counts, 20, 20, -0.5, 1, 2, 4);
  accumulateWaveform(energies, counts, 20, 20, 1.5, 1, 2, 4);
  accumulateWaveform(energies, counts, 20, 20, 2.5, 1, 2, 4);
  assert.deepEqual(Array.from(energies), [20,20,0,0]);
  assert.deepEqual(Array.from(counts), [20,20,0,0]);
});

test('waveforms preserve silence, stereo energy, shared timeline and playback rate', () => {
  const samples = new Float32Array([1, 1, 0, 0]);
  assert.deepEqual(waveformEnvelope([samples], 2, 0, 2, 4, 4), [1, 0, 0, 0]);
  assert.deepEqual(waveformEnvelope([samples], 2, 0, 2, 4, 4, 0.5), [1, 1, 0, 0]);
  assert.deepEqual(waveformEnvelope([samples, new Float32Array([-1, -1, 0, 0])], 2, 0, 2, 2, 2), [1, 0]);
  assert.deepEqual(waveformEnvelope([samples], 2, 1, 2, 1, 2), [0, 0]);
});

test('multi-sentence units retain pauses, complete text and distinct recording identities', () => {
  const cues = [{ id: 'a', start: 1, end: 2, text: 'One.', translation: '一。' }, { id: 'b', start: 3, end: 4, text: 'Two.', translation: '二。' }, { id: 'c', start: 5, end: 6, text: 'Three.' }];
  const group = practiceGroup(cues, 0, 2);
  assert.equal(group.start, 1); assert.equal(group.end, 4);
  assert.equal(group.text, 'One. Two.'); assert.equal(group.translation, '一。 二。');
  assert.deepEqual(group.segmentIds, ['a', 'b']); assert.equal(group.lastIndex, 1);
  assert.notEqual(group.id, practiceGroup(cues, 0, 3).id);
  assert.equal(practiceGroup(cues, 0, 1).id, 'a');
  assert.equal(practiceGroup(cues, 2, 10).id, 'c');
  assert.equal(practiceGroup(cues, 2, 10).lastIndex, 2);
});

test('segment seek waits for decoded position and supports cancellation', async () => {
  class TestMedia extends EventTarget {
    currentTime = 1;
    seeking = true;
    pauses = 0;
    pause() { this.pauses++; }
  }
  const media = new TestMedia();
  let ready = false;
  const pending = seekMedia(media as unknown as HTMLMediaElement, 4.8).then(() => { ready = true; });
  await Promise.resolve(); assert.equal(ready, false);
  media.seeking = false; media.dispatchEvent(new Event('seeked'));
  await pending; assert.equal(ready, true); assert.equal(media.pauses, 1);
  media.seeking = true;
  const controller = new AbortController();
  const cancelled = seekMedia(media as unknown as HTMLMediaElement, 8, controller.signal);
  controller.abort(); await assert.rejects(cancelled, { name: 'AbortError' });
});

test('out-of-range cues stay intact while playback uses only existing media', () => {
  const cue = { id: 's1', start: 30, end: 45, text: 'Preserved text.' };
  assert.deepEqual(playableSegment(cue, 33), { ...cue, end: 33 });
  assert.equal(cue.end, 45);
  assert.equal(playableSegment({ ...cue, start: 33 }, 33), null);
  assert.equal(playableSegment(cue, Infinity), cue);
  assert.equal(playableSegment(cue, NaN), cue);
});

test('exported SRT preserves edited times, bilingual text and long timelines', () => {
  const segments = [{ id: 's1', start: 3600000.125, end: 3600002.999, text: 'Updated reference.', translation: '更新后的译文。' }];
  const output = serializeSrt(segments);
  assert.match(output, /1000:00:00,125 --> 1000:00:02,999/);
  assert.deepEqual(parseSubtitles(output), segments);
});

test('large SRT has no fixed cue count, text length or total duration cap', () => {
  const timestamp = (second: number) => `${String(Math.floor(second / 3600)).padStart(2, '0')}:${String(Math.floor(second / 60) % 60).padStart(2, '0')}:${String(second % 60).padStart(2, '0')},000`;
  const input = Array.from({ length: 50000 }, (_, i) => `${i + 1}\n${timestamp(i * 2)} --> ${timestamp(i * 2 + 1)}\nSentence ${i + 1}.`).join('\n\n');
  const result = parseSubtitles(input);
  assert.equal(result.length, 50000);
  assert.equal(result.at(-1)?.end, 99999);
  assert.equal(parseSubtitles(`1\n00:00:00,000 --> 00:00:01,000\n${'a'.repeat(10000)}`)[0].text.length, 10000);
  assert.equal(parseTimestamp('1000:00:00,000'), 3600000);
});

test('long practice keeps complete segments, custom time and a bounded recording budget', () => {
  const settings: Settings = { speed: 1, repeat: false, repeats: 1, autoNext: false, mode: 'listen', hideText: false, recordingSeconds: 60, groupSize: 1 };
  const segment = { id: 'long', start: 0, end: 90, text: 'Long passage.' };
  assert.equal(recordingDuration(segment, settings), 91.2);
  assert.equal(recordingDuration({ ...segment, end: 2 }, settings), 60);
  assert.equal(recordingDuration(segment, { ...settings, speed: 0.6, recordingSeconds: 0, groupSize: 1 }), 151.2);
  assert.equal(recordingDuration({ ...segment, end: 600 }, settings), 300);
  assert.equal(recordingDuration({ ...segment, end: 2 }, { ...settings, mode: 'shadow' }), 2.3);
});

test('SRT supports BOM, CRLF, multiline text and bilingual subtitles', () => {
  const result = parseSubtitles('\uFEFF1\r\n00:00:01,250 --> 00:00:04,500\r\nSmall steps\r\nmake a big difference.\r\n小小的进步。\r\n\r\n2\r\n00:00:05,000 --> 00:00:07,000\r\nKeep going.');
  assert.equal(result.length, 2); assert.equal(result[0].start, 1.25); assert.equal(result[0].end, 4.5);
  assert.equal(result[0].text, 'Small steps make a big difference.'); assert.equal(result[0].translation, '小小的进步。');
});
test('VTT accepts identifiers, cue settings and strips rendering tags', () => {
  const result = parseSubtitles('WEBVTT\n\nNOTE Example\nThis is a comment\n\ncue-1\n00:01.000 --> 00:03.000 align:start\n<v Speaker><b>Hello &amp; welcome.</b>\n\n00:03.500 --> 00:05.000\nKeep going.');
  assert.equal(result.length, 2); assert.equal(result[0].text, 'Hello & welcome.'); assert.equal(result[0].start, 1);
});
test('time validation rejects malformed, reversed and overlapping cues', () => {
  assert.throws(() => parseTimestamp('00:61:02.000'), /超出范围/);
  assert.throws(() => parseTimestamp('-00:01.000'), /格式/);
  assert.throws(() => parseSubtitles('1\n00:00:03,000 --> 00:00:01,000\nHello'), /结束时间/);
  assert.throws(() => parseSubtitles('1\n00:00:00,000 --> 00:00:03,000\nHello\n\n2\n00:00:02,000 --> 00:00:04,000\nWorld'), /重叠/);
  assert.throws(() => parseSubtitles('No timecodes'), /没有找到/);
  assert.throws(() => validateSegments([{ id: '1', start: NaN, end: 3, text: 'Hi' }]), /结束时间/);
});
test('included demo subtitle exactly matches audio manifest timing and content', () => {
  const parsed = parseSubtitles(readFileSync(new URL('../public/demo.srt', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../public/demo.json', import.meta.url), 'utf8'));
  assert.deepEqual(parsed, manifest); assert.equal(parsed.length, 8);
});
test('WAV encoder writes actual PCM data and saturates out-of-range samples', () => {
  const output = Buffer.from(encodeWav(new Float32Array([-2, -1, 0, 1, 2])));
  assert.equal(output.toString('ascii', 0, 4), 'RIFF'); assert.equal(output.readUInt32LE(24), 16000);
  assert.equal(output.readUInt32LE(40), 10); assert.equal(output.readInt16LE(44), -32768); assert.equal(output.readInt16LE(52), 32767);
});
test('time display handles empty and nonfinite positions', () => {
  assert.equal(formatTime(65.9), '01:05'); assert.equal(formatTime(NaN), '00:00'); assert.equal(formatTime(-1), '00:00');
});

test('explicit scrub selects target cue at gaps, boundaries and media end', () => {
  const cues = [{id:'a',start:2,end:4,text:'a'}, {id:'b',start:6,end:8,text:'b'}];
  assert.equal(segmentAtPosition(cues, 0), 0);
  assert.equal(segmentAtPosition(cues, 3), 0);
  assert.equal(segmentAtPosition(cues, 4), 1);
  assert.equal(segmentAtPosition(cues, 6), 1);
  assert.equal(segmentAtPosition(cues, 8), 1);
});

test('custom cue count preserves full group identity and clamps at the last cue', () => {
  const cues = Array.from({length:8}, (_, i)=>({id:`s${i}`,start:i*2,end:i*2+1,text:`cue ${i}`}));
  assert.equal(practiceGroup(cues, 2, 4).lastIndex, 5);
  assert.deepEqual(practiceGroup(cues, 2, 4).segmentIds, ['s2','s3','s4','s5']);
  assert.equal(practiceGroup(cues, 6, 40).lastIndex, 7);
});

test('manual listen mode respects selected recording duration', () => {
  const settings: Settings = {speed:1, repeat:false, repeats:1, autoNext:false, mode:'manual', hideText:false, recordingSeconds:60, groupSize:1};
  assert.equal(recordingDuration({id:'a',start:0,end:2,text:'a'},settings),60);
});
