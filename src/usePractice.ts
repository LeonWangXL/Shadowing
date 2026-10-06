import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Lesson, Phase, Settings, Segment } from './types';
import { createRecorder } from './audio';
import { recordingDuration } from './practiceTiming';
import { playableSegment } from './subtitles';
import { seekMedia } from './mediaSeek';
import { practiceGroup } from './practiceGroup';
import type { CapturedAudio, Recorder } from './audio';

interface Options {
  media: RefObject<HTMLMediaElement | null>; lesson: Lesson | undefined; index: number;
  settings: Settings; select: (index: number) => void;
  captured: (audio: CapturedAudio, lesson: Lesson, index: number, group: ReturnType<typeof practiceGroup>, speed: number) => Promise<void>;
  notify: (message: string) => void;
  recorderFactory?: () => Promise<Recorder>;
}
class Cancelled extends Error {}

export function usePractice(options: Options) {
  const current = useRef(options); current.current = options;
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [round, setRound] = useState(1);
  const [recordingLimit, setRecordingLimit] = useState(0);
  const run = useRef(0), recorder = useRef<Recorder | null>(null);
  const beginRecording = useRef<(() => void) | null>(null);
  const interrupt = useRef<(() => void) | null>(null);
  const busy = phase !== 'idle';
  const running = useRef(false);

  const cancel = useCallback(() => {
    run.current++;
    current.current.media.current?.pause();
    interrupt.current?.();
    interrupt.current = null;
  }, []);

  useEffect(() => () => { cancel(); recorder.current?.dispose(); }, [cancel]);

  async function playSegment(lesson: Lesson, index: number, token: number, settings: Settings, reference?: Segment) {
    const media = current.current.media.current;
    if (!media || !media.readyState) throw new Error('素材还未加载，请稍后重试。');
    const segment = playableSegment(reference || practiceGroup(lesson.segments, index, settings.groupSize), media.duration);
    if (!segment) throw new Error('这句字幕起点已超出素材时长，请调整时间轴或更换对应素材。');
    const seeking = new AbortController();
    interrupt.current = () => seeking.abort();
    try { await seekMedia(media, segment.start, seeking.signal); }
    catch (error) { if (token !== run.current) throw new Cancelled(); throw error; }
    finally { interrupt.current = null; }
    if (token !== run.current) throw new Cancelled();
    media.playbackRate = settings.speed;
    return new Promise<void>((resolve, reject) => {
      let raf = 0, complete = false;
      const cleanup = () => { cancelAnimationFrame(raf); media.removeEventListener('ended', done); media.removeEventListener('error', failed); interrupt.current = null; };
      const done = () => { if (complete) return; complete = true; media.pause(); cleanup(); resolve(); };
      const failed = () => { if (complete) return; complete = true; cleanup(); reject(new Error('素材播放失败，请检查视频编码或重新导入。')); };
      const tick = () => { if (token !== run.current) { cleanup(); reject(new Cancelled()); return; } if (media.currentTime >= segment.end) done(); else raf = requestAnimationFrame(tick); };
      interrupt.current = () => { cleanup(); complete = true; reject(new Cancelled()); };
      media.addEventListener('ended', done); media.addEventListener('error', failed);
      void media.play().then(() => { if (!complete) raf = requestAnimationFrame(tick); }).catch(error => { if (!complete) { complete = true; cleanup(); reject(new Error(error.name === 'NotAllowedError' ? '浏览器阻止了播放，请点击播放器后重试。' : '无法播放此素材，请使用浏览器支持的 MP4、WebM 或音频文件。')); } });
    });
  }

  async function wait(ms: number, token: number, recording = false) {
    return new Promise<void>(resolve => {
      const started = performance.now();
      const timer = setInterval(() => {
        if (recording) { setElapsed((performance.now() - started) / 1000); setLevel(recorder.current?.level() || 0); }
        if (token !== run.current || performance.now() - started >= ms) finish();
      }, 80);
      const finish = () => { clearInterval(timer); interrupt.current = null; resolve(); };
      interrupt.current = finish;
    });
  }

  async function listen(reference?: Segment, speed?: number) {
    const { lesson, index, settings, notify } = current.current;
    if (!lesson || running.current) return;
    running.current = true;
    const token = ++run.current;
    setPhase('listening');
    try { await playSegment(lesson, index, token, { ...settings, speed: speed ?? settings.speed }, reference); return true; }
    catch (error) { if (!(error instanceof Cancelled)) notify((error as Error).message); }
    finally { running.current = false; setPhase('idle'); }
  }

  async function start(startIndex?: number) {
    const { lesson, index, settings, notify } = current.current;
    if (!lesson || running.current) return;
    running.current = true;
    const token = ++run.current;
    current.current.media.current?.pause();
    const repetitions = settings.repeat ? settings.repeats : 1;
    try {
      let i = startIndex ?? index;
      while (i < lesson.segments.length && token === run.current) {
        current.current.select(i);
        for (let attempt = 1; attempt <= repetitions && token === run.current; attempt++) {
          setRound(attempt); setElapsed(0); setLevel(0); setPhase('preparing');
          const group = practiceGroup(lesson.segments, i, settings.groupSize);
          const segment = playableSegment(group, current.current.media.current?.duration || 0);
          if (!segment) throw new Error('这句字幕起点已超出素材时长，已停止练习。请调整时间轴或更换对应素材。');
          recorder.current = await (current.current.recorderFactory || createRecorder)();
          if (token !== run.current) throw new Cancelled();
          const recordMs = recordingDuration(segment, settings) * 1000;
          setRecordingLimit(recordMs / 1000);
          if (settings.mode !== 'shadow') {
            setPhase('listening'); await playSegment(lesson, i, token, settings);
            if (token !== run.current) throw new Cancelled();
            if (settings.mode === 'manual') {
              setPhase('waiting');
              await new Promise<void>(resolve => {
                const finish = () => { beginRecording.current = null; interrupt.current = null; resolve(); };
                beginRecording.current = finish; interrupt.current = finish;
              });
              if (token !== run.current) throw new Cancelled();
            }
            setPhase('recording'); await recorder.current.start();
            await wait(recordMs, token, true);
          } else {
            setPhase('recording'); await recorder.current.start();
            // Shadowing captures microphone audio while the original sentence plays.
            const playback = playSegment(lesson, i, token, settings);
            const started = performance.now();
            const meter = setInterval(() => { setElapsed((performance.now() - started) / 1000); setLevel(recorder.current?.level() || 0); }, 80);
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try { await Promise.race([playback, new Promise<void>(resolve => { timeout = setTimeout(() => { current.current.media.current?.pause(); interrupt.current?.(); resolve(); }, recordMs); })]); }
            catch (error) { if (!(error instanceof Cancelled)) throw error; }
            finally { clearInterval(meter); clearTimeout(timeout); }
          }
          setPhase('saving');
          const audio = await recorder.current.finish(); recorder.current = null;
          await current.current.captured(audio, lesson, i, { ...group, start: segment.start, end: segment.end }, settings.speed);
          if (token !== run.current) break;
          if (attempt < repetitions) { setPhase('break'); await wait(1800, token); }
        }
        if (!settings.autoNext || token !== run.current) break;
        i += settings.groupSize;
        if (i < lesson.segments.length) { setPhase('break'); await wait(1800, token); }
      }
      if (token === run.current) notify(settings.autoNext ? '本轮练习已完成，录音已保存在练习记录中。' : '本轮练习已完成，可以回听录音，或继续下一组。');
    } catch (error) { if (!(error instanceof Cancelled)) notify((error as Error).message); }
    finally { recorder.current?.dispose(); recorder.current = null; running.current = false; setPhase('idle'); setLevel(0); }
  }
  return { phase, elapsed, level, round, recordingLimit, busy, start, listen, record: () => beginRecording.current?.(), stop: cancel };
}
