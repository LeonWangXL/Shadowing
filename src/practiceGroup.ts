import type { Segment } from './types.ts';

export function practiceGroup(segments: Segment[], start: number, size = 1): Segment & { segmentIds: string[]; lastIndex: number } {
  const members = segments.slice(start, start + Math.max(1, Math.floor(size)));
  if (!members.length) throw new Error('没有可练习的字幕。');
  const first = members[0], last = members[members.length - 1];
  return {
    id: members.length === 1 ? first.id : `group:${JSON.stringify(members.map(item => item.id))}`,
    start: first.start, end: last.end,
    text: members.map(item => item.text).join(' '),
    translation: members.map(item => item.translation).filter(Boolean).join(' ') || undefined,
    segmentIds: members.map(item => item.id), lastIndex: start + members.length - 1,
  };
}

export function segmentAtPosition(segments: Segment[], time: number): number {
  const found = segments.findIndex(cue => time < cue.end);
  return found < 0 ? segments.length - 1 : found;
}
