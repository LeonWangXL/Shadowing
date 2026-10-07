export interface Segment { id: string; start: number; end: number; text: string; translation?: string }
export interface Lesson {
  id: string; title: string; kind: 'audio' | 'video'; segments: Segment[];
  media?: Blob; fileName?: string; sourceUrl?: string; demo?: boolean; createdAt: number;
  subtitleFile?: Blob; subtitleFileName?: string;
  articleFile?: Blob; articleFileName?: string;
  deletedAt?: number;
}
export interface WordResult {
  word: string; accuracy?: number; error: string;
  phonemes: { text: string; accuracy?: number }[];
}
export interface Assessment {
  provider: 'Azure Speech'; assessedAt: number; accuracy?: number; fluency?: number;
  completeness?: number; prosody?: number; overall?: number; recognized: string;
  words: WordResult[];
}
export interface Attempt {
  id: string; lessonId: string; segmentId: string; text: string; createdAt: number;
  duration: number; blob: Blob; rms: number; peak: number;
  assessment?: Assessment; assessmentError?: string;
  segmentIds?: string[];
  referenceStart?: number; referenceEnd?: number; referenceSpeed?: number;
}
export interface ReviewItem { id: string; lessonId: string; segmentId: string; createdAt: number }
export interface Settings { speed: number; repeat: boolean; repeats: number; autoNext: boolean; mode: 'listen' | 'manual' | 'shadow'; hideText: boolean; recordingSeconds: number; groupSize: number }
export type Phase = 'idle' | 'waiting' | 'preparing' | 'listening' | 'recording' | 'saving' | 'break';
