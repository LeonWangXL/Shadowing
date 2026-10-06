import type { Segment } from './types';

export function playableSegment(segment: Segment, duration: number): Segment | null {
  if (!Number.isFinite(duration) || duration <= 0) return segment;
  if (segment.start >= duration) return null;
  return { ...segment, end: Math.min(segment.end, duration) };
}

export function parseTimestamp(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!/^(?:\d+:)?\d{2}:\d{2}\.\d{3}$/.test(normalized)) throw new Error(`时间格式不正确：${value}`);
  const parts = normalized.split(':').map(Number);
  const seconds = parts.pop()!;
  const minutes = parts.pop()!;
  const hours = parts.pop() || 0;
  if (minutes >= 60 || seconds >= 60) throw new Error(`时间超出范围：${value}`);
  const timestamp = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isFinite(timestamp) || timestamp > Number.MAX_SAFE_INTEGER) throw new Error(`时间超出范围：${value}`);
  return timestamp;
}

export function validateSegments(segments: Segment[]): Segment[] {
  if (!segments.length) throw new Error('没有找到字幕句子，请使用带时间轴的 SRT 或 VTT 文件。');
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!s.text.trim()) throw new Error(`第 ${i + 1} 句内容为空。`);
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end <= s.start) throw new Error(`第 ${i + 1} 句的结束时间必须大于开始时间。`);
    if (i > 0 && s.start < segments[i - 1].end - 0.001) throw new Error(`第 ${i + 1} 句与上一句重叠，请修正字幕时间轴后导入。`);
  }
  return segments;
}

export function parseSubtitles(input: string): Segment[] {
  const content = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const blocks = content.split(/\n\s*\n/);
  const segments: Segment[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (/^(WEBVTT|NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(lines[0])) continue;
    const timeIndex = lines.findIndex(line => line.includes('-->'));
    if (timeIndex < 0) continue;
    const match = lines[timeIndex].match(/^\s*(\S+)\s*-->\s*(\S+)/);
    if (!match) throw new Error(`字幕第 ${segments.length + 1} 句缺少正确时间轴。`);
    const textLines = lines.slice(timeIndex + 1).map(line => line.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()).filter(Boolean);
    const chinese = textLines.filter(line => /[\u3400-\u9fff]/.test(line));
    const english = textLines.filter(line => !/[\u3400-\u9fff]/.test(line));
    segments.push({ id: `s${segments.length + 1}`, start: parseTimestamp(match[1]), end: parseTimestamp(match[2]), text: (english.length ? english : textLines).join(' '), translation: english.length ? chinese.join(' ') || undefined : undefined });
  }
  return validateSegments(segments);
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function serializeSrt(segments: Segment[]): string {
  const timestamp = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  return segments.map((segment, i) => `${i + 1}\n${timestamp(segment.start)} --> ${timestamp(segment.end)}\n${segment.text}${segment.translation ? `\n${segment.translation}` : ''}`).join('\n\n') + '\n';
}
