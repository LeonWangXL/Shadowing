import type { Segment, Settings } from './types.ts';

export function recordingDuration(segment: Segment, settings: Settings): number {
  const original = (segment.end - segment.start) / settings.speed;
  const automatic = original + (settings.mode !== 'shadow' ? 1.2 : 0.3);
  const requested = settings.mode !== 'shadow' ? settings.recordingSeconds : 0;
  return Math.min(300, Math.max(automatic, Number.isFinite(requested) ? requested : 0));
}
