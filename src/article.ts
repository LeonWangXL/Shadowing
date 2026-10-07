import { encodeWav } from './audio.ts';
import { serializeSrt, validateSegments } from './subtitles.ts';
import type { Lesson, Segment } from './types';

export function articleSentences(text: string, language: string): string[] {
  const sentences: string[] = [];
  const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' });
  for (const paragraph of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    for (const entry of segmenter.segment(paragraph)) {
      let remaining = entry.segment.trim();
      // Only the upstream request is bounded; long articles are split, never truncated.
      while (remaining.length > 1800) {
        let end = remaining.lastIndexOf(' ', 1800);
        if (end < 900) end = 1800;
        if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
        sentences.push(remaining.slice(0, end).trim()); remaining = remaining.slice(end).trim();
      }
      if (remaining) {
        const previous = sentences.at(-1);
        if (previous && previous.length + remaining.length < 1800 && /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St)\.$/i.test(previous)) sentences[sentences.length - 1] += ' ' + remaining;
        else sentences.push(remaining);
      }
    }
  }
  if (!sentences.length) throw new Error('请输入文章内容。');
  return sentences;
}

export async function articleLesson(text: string, title: string, voice: string, signal: AbortSignal, progress: (value: string) => void): Promise<Lesson> {
  const sentences = articleSentences(text, voice.startsWith('zh-') ? 'zh-CN' : 'en');
  const context = new AudioContext({ sampleRate: 24000 });
  const sampleRate = context.sampleRate;
  const parts: BlobPart[] = [], segments: Segment[] = [];
  let sampleCount = 0;
  try {
    for (let i = 0; i < sentences.length; i++) {
      signal.throwIfAborted(); progress(`正在生成 ${i + 1} / ${sentences.length} 句…`);
      const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sentences[i], voice }), signal });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || '当前后端不支持文章语音生成，请使用本地 Node 服务。'); }
      const audio = await context.decodeAudioData(await response.arrayBuffer());
      signal.throwIfAborted();
      if (audio.numberOfChannels !== 1 || !audio.length) throw new Error('语音服务返回了不支持的音频。');
      const pcm = encodeWav(audio.getChannelData(0), sampleRate).slice(44);
      const start = sampleCount / sampleRate; sampleCount += audio.length;
      segments.push({ id: `s${i + 1}`, text: sentences[i], start, end: sampleCount / sampleRate });
      parts.push(pcm);
      if (i < sentences.length - 1) { const pause = Math.round(sampleRate * 0.25); parts.push(new Uint8Array(pause * 2)); sampleCount += pause; }
    }
    signal.throwIfAborted(); validateSegments(segments);
    const header = encodeWav(new Float32Array(0), sampleRate);
    // WAV uses 32-bit sizes. This is an output-format limit, not an import cap.
    if (sampleCount * 2 > 0xffffffff - 36) throw new Error('生成音频超出 WAV 格式容量，请把文章分为多个素材。');
    new DataView(header).setUint32(4, 36 + sampleCount * 2, true);
    new DataView(header).setUint32(40, sampleCount * 2, true);
    const name = (title.trim() || '文章朗读').replace(/[\\/:*?"<>|]/g, '_');
    return { id: crypto.randomUUID(), title: title.trim() || '文章朗读', kind: 'audio', media: new Blob([header, ...parts], { type: 'audio/wav' }), fileName: `${name}.wav`, subtitleFile: new Blob([serializeSrt(segments)], { type: 'text/plain;charset=utf-8' }), subtitleFileName: `${name}.srt`, articleFile: new Blob([text], { type: 'text/plain;charset=utf-8' }), articleFileName: `${name}.txt`, segments, createdAt: Date.now() };
  } finally { await context.close(); }
}
