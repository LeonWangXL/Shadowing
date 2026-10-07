import { appUrl } from './appUrl.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ArrowCounterClockwise, ArrowSquareOut, BookmarkSimple, Check, CheckCircle, DownloadSimple, Eye, EyeSlash, GearSix, Headphones, Microphone, Pause, Play, Repeat, SlidersHorizontal, SpeakerHigh, UploadSimple, Waveform, X, Trash } from '@phosphor-icons/react';
import type { Assessment, Attempt, Lesson, ReviewItem, Segment, Settings } from './types';
import type { CapturedAudio } from './audio';
import { formatTime, parseSubtitles, validateSegments, serializeSrt } from './subtitles';
import * as storage from './storage';
import { usePractice } from './usePractice';
import { Transcript } from './Transcript';
import { practiceGroup, segmentAtPosition } from './practiceGroup';
import { WaveformCompare } from './WaveformCompare';
import { ArticleImport } from './ArticleImport';

const DEFAULTS: Settings = { speed: 1, repeat: true, repeats: 3, autoNext: false, mode: 'listen', hideText: false, recordingSeconds: 0, groupSize: 1 };
const demoId = 'echo-small-steps';
function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('echo-settings') || '{}');
    return { speed: [0.6, 0.8, 1, 1.2].includes(saved.speed) ? saved.speed : 1, repeat: typeof saved.repeat === 'boolean' ? saved.repeat : true, repeats: [1, 2, 3, 5].includes(saved.repeats) ? saved.repeats : 3, autoNext: !!saved.autoNext, mode: saved.mode === 'manual' ? 'manual' : saved.mode === 'shadow' ? 'shadow' : 'listen', hideText: !!saved.hideText, recordingSeconds: [0, 30, 60, 120, 300].includes(saved.recordingSeconds) ? saved.recordingSeconds : 0, groupSize: Number.isSafeInteger(saved.groupSize) && saved.groupSize > 0 ? saved.groupSize : 1 };
  } catch { return DEFAULTS; }
}
function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState('');
  useEffect(() => { if (!blob) { setUrl(''); return; } const value = URL.createObjectURL(blob); setUrl(value); return () => URL.revokeObjectURL(value); }, [blob]);
  return url;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function ResourceDownload({ blob, name, children }: { blob: Blob; name: string; children: ReactNode }) {
  const url = useBlobUrl(blob);
  return <a className="text-button" href={url || undefined} download={name}><DownloadSimple size={16} />{children}</a>;
}
function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} disabled={disabled} onClick={onChange}><span /></button>;
}
function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = ref.current; dialog?.showModal();
    return () => { dialog?.close(); previouslyFocused?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-heading"><div><p className="eyebrow">ECHO / YOUR PRACTICE</p><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={23} /></button></div>{children}
  </dialog>;
}

function ImportModal({ onClose, onImport, lessons, onSelect, trash, onArchive, onRestore, onPurge }: { onClose: () => void; onImport: (lesson: Lesson) => Promise<void>; lessons: Lesson[]; onSelect: (id: string) => void; trash: Lesson[]; onArchive: (lesson: Lesson) => Promise<void>; onRestore: (lesson: Lesson) => Promise<void>; onPurge: (lesson: Lesson) => Promise<void> }) {
  const [media, setMedia] = useState<File | null>(null), [subtitle, setSubtitle] = useState<File | null>(null);
  const [text, setText] = useState(''), [title, setTitle] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [deletion, setDeletion] = useState<{ lesson: Lesson; permanent: boolean } | null>(null);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  async function confirmDeletion() {
    if (!deletion || saving) return;
    setSaving(true); setError('');
    try { await (deletion.permanent ? onPurge(deletion.lesson) : onArchive(deletion.lesson)); setDeletion(null); }
    catch { setError('删除失败，素材已保留，请重试。'); }
    finally { setSaving(false); }
  }
  async function submit() {
    setError('');
    if (!media) { setError('请先选择视频或音频文件。'); return; }
    const kind = media.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(media.name) ? 'video' : 'audio';
    if (!/\.(mp4|webm|mov|m4v|mp3|wav|m4a|ogg|aac|flac)$/i.test(media.name)) { setError('请选择常见的视频或音频文件（例如 MP4、WebM、MP3、WAV）。'); return; }
    setSaving(true);
    try {
      const raw = subtitle ? await subtitle.text() : text;
      const segments = parseSubtitles(raw);
      // Read metadata before persisting so cues cannot silently fall outside the media.
      const url = URL.createObjectURL(media);
      const element = document.createElement(kind);
      const duration = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('读取素材超时，请检查文件后重试。')), 10000);
        element.onloadedmetadata = () => { clearTimeout(timer); resolve(element.duration); };
        element.onerror = () => { clearTimeout(timer); reject(new Error('浏览器无法解码此素材，请转换为 MP4（H.264/AAC）、MP3 或 WAV。')); };
        element.src = url; element.preload = 'metadata';
      }).finally(() => { element.removeAttribute('src'); element.load(); URL.revokeObjectURL(url); });
      // Preserve every cue even if metadata is incomplete or subtitle tails exceed the media.
      // Playback clamps to the actual media boundary; original exports stay unchanged.
      await onImport({ id: crypto.randomUUID(), title: title.trim() || media.name.replace(/\.[^.]+$/, ''), kind, media, fileName: media.name, subtitleFile: subtitle || new Blob([raw], { type: 'text/plain;charset=utf-8' }), subtitleFileName: subtitle?.name || 'pasted-subtitles.' + (raw.trim().startsWith('WEBVTT') ? 'vtt' : 'srt'), segments, createdAt: Date.now() });
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  return <Modal title="把喜欢的内容，变成练习" description="导入视频、音频及字幕，或把文章生成朗读音频和字幕。素材保存在当前浏览器，不设导入文件大小上限；保存受浏览器可用空间影响。" onClose={saving || generatingArticle ? () => {} : onClose} wide>
    <fieldset disabled={saving || generatingArticle} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <div className="import-files">
      <label className="file-field"><UploadSimple size={30} /><strong>{media ? media.name : '选择视频或音频'}</strong><span>MP4、WebM、MP3、WAV 等 · 文件大小不限</span><input aria-label="视频或音频文件" type="file" accept="video/*,audio/*,.mp4,.webm,.mp3,.wav,.m4a" disabled={saving} onChange={event => { setMedia(event.target.files?.[0] || null); setError(''); }} /></label>
      <label className="file-field"><SlidersHorizontal size={30} /><strong>{subtitle ? subtitle.name : '选择字幕文件'}</strong><span>SRT / VTT · 不限制字幕条数和总时长</span><input aria-label="字幕文件" type="file" accept=".srt,.vtt" disabled={saving} onChange={event => { setSubtitle(event.target.files?.[0] || null); setError(''); }} /></label>
    </div>
    <label className="field">素材名称<input value={title} maxLength={100} placeholder="例如：一次关于习惯的访谈" onChange={event => setTitle(event.target.value)} disabled={saving} /></label>
    <details className="paste-subtitle"><summary>没有字幕文件？粘贴 SRT / VTT 内容</summary><p>每句需要起止时间。纯文本暂不支持自动对齐。</p><textarea aria-label="粘贴字幕内容" rows={6} value={text} onChange={event => { setText(event.target.value); setSubtitle(null); }} placeholder={'1\n00:00:01,000 --> 00:00:04,000\nSmall steps make a big difference.\n小小的进步也能带来巨大的改变。'} /><a href={appUrl('demo.srt')} download>下载示例字幕</a></details>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="modal-actions"><span>支持逐句修改时间轴；暂不支持抓取视频网址。</span><button className="button primary" onClick={submit} disabled={saving}>{saving ? '正在导入…' : '导入并开始练习'}<ArrowRight size={18} /></button></div>
    </fieldset>
    {!saving && <ArticleImport onImport={onImport} onBusy={setGeneratingArticle} />}
    <fieldset disabled={generatingArticle} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    {deletion && <section className="delete-confirm" role="alert" aria-label="删除素材确认"><h3>{deletion.permanent ? '永久删除' : '移入回收站'}：{deletion.lesson.title}</h3><p>{deletion.permanent ? '原音视频、原字幕、字幕修改、相关录音及评测和复习标记将全部删除，无法恢复。可先恢复素材并下载备份。' : '素材及相关录音、评测和复习标记将从练习列表移除，之后可以在回收站恢复。'}</p><div><button className="button" disabled={saving} onClick={() => setDeletion(null)}>取消</button><button className="button danger-button" disabled={saving} onClick={() => void confirmDeletion()}>{saving ? '正在处理…' : deletion.permanent ? '确认永久删除' : '确认移入回收站'}</button></div></section>}
    <div className="library"><h3>我的素材 <span>{lessons.length}</span></h3>{lessons.map(lesson => <div className="library-resource" key={lesson.id}><button className="library-select" onClick={() => { onSelect(lesson.id); onClose(); }} disabled={saving}><div><strong>{lesson.title}</strong><span>{lesson.demo ? '内置合成音频' : lesson.kind === 'video' ? '本地视频' : '本地音频'} · {lesson.segments.length} 句</span></div><ArrowRight size={18} /></button><div className="resource-downloads">{!lesson.demo && <button className="text-button delete-resource" disabled={saving} onClick={() => { setDeletion({ lesson, permanent: false }); setError(''); }}><Trash size={16} />删除素材</button>}{lesson.media ? <ResourceDownload blob={lesson.media} name={lesson.fileName || `${lesson.title}.${lesson.kind === 'video' ? 'mp4' : 'wav'}`}>下载原{lesson.kind === 'video' ? '视频' : '音频'}</ResourceDownload> : lesson.sourceUrl && <a className="text-button" href={lesson.sourceUrl} download={lesson.fileName || 'demo.wav'}><DownloadSimple size={16} />下载原音频</a>}{lesson.articleFile && <ResourceDownload blob={lesson.articleFile} name={lesson.articleFileName || 'article.txt'}>下载原文章</ResourceDownload>}{lesson.subtitleFile && <ResourceDownload blob={lesson.subtitleFile} name={lesson.subtitleFileName || 'subtitles.srt'}>下载原字幕</ResourceDownload>}<button className="text-button" disabled={saving} onClick={() => download(new Blob([serializeSrt(lesson.segments)], { type: 'text/plain;charset=utf-8' }), `${lesson.title.replace(/[\\/:*?"<>|]/g, '_')}.srt`)}><DownloadSimple size={16} />导出当前字幕</button></div>{!lesson.subtitleFile && !lesson.demo && <p className="small muted">此前导入的原字幕未保留，可导出当前字幕。</p>}</div>)}</div>    {trash.length > 0 && <div className="library trash-library"><h3>回收站 <span>{trash.length}</span></h3><p className="small muted">回收站保留原文件和练习数据，仍占用存储空间。永久删除后才会释放应用占用的数据。</p>{trash.map(item => <div className="library-resource" key={item.id}><strong>{item.title}</strong><div className="resource-downloads"><button className="text-button" disabled={saving} onClick={async () => { setSaving(true); setError(''); try { await onRestore(item); setDeletion(null); } catch { setError('恢复失败，请重试。'); } finally { setSaving(false); } }}><ArrowCounterClockwise size={16} />恢复素材</button><button className="text-button delete-resource" disabled={saving} onClick={() => { setDeletion({ lesson: item, permanent: true }); setError(''); }}><Trash size={16} />永久删除</button></div></div>)}</div>}
    </fieldset>
  </Modal>;
}

function SegmentEditor({ segment, onSave, onClose }: { segment: Segment; onSave: (segment: Segment) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(segment), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  return <Modal title="调整这一句" description="以秒为单位设置时间。修改后保留录音，已保存的评测仍对应当时的文本。" onClose={onClose}>
    <div className="time-fields"><label className="field">开始时间（秒）<input type="number" min={0} step="0.01" value={draft.start} onChange={event => setDraft({ ...draft, start: Number(event.target.value) })} /></label><label className="field">结束时间（秒）<input type="number" min={0} step="0.01" value={draft.end} onChange={event => setDraft({ ...draft, end: Number(event.target.value) })} /></label></div>
    <label className="field">英文句子<textarea rows={3} value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} /></label>
    <label className="field">中文翻译（可选）<textarea rows={2} value={draft.translation || ''} onChange={event => setDraft({ ...draft, translation: event.target.value })} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="button primary" disabled={saving} onClick={async () => { setSaving(true); try { await onSave(draft); onClose(); } catch (err) { setError((err as Error).message); } finally { setSaving(false); } }}>{saving ? '保存中…' : '保存修改'}</button></div>
  </Modal>;
}

function RecordingRow({ attempt, selected, onSelect, onDelete, onReplay }: { attempt: Attempt; selected: boolean; onSelect: () => void; onDelete: () => void; onReplay: (element: HTMLAudioElement) => void }) {
  const url = useBlobUrl(attempt.blob);
  return <div className={`recording-row ${selected ? 'selected' : ''}`}>
    <button className="recording-select" onClick={onSelect} aria-label={`查看 ${new Date(attempt.createdAt).toLocaleTimeString('zh-CN')} 的录音反馈`}><span className="record-icon"><Microphone size={19} /></span><span><strong>{new Date(attempt.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong><small>{attempt.referenceStart !== undefined && attempt.referenceEnd !== undefined ? `原声 ${formatTime(attempt.referenceStart)}–${formatTime(attempt.referenceEnd)} · ` : '历史录音 · '}{attempt.duration.toFixed(1)} 秒 · {attempt.assessment ? `发音 ${attempt.assessment.accuracy ?? '—'}` : '未评测'}</small></span></button>
    <audio controls src={url || undefined} preload="metadata" aria-label="我的录音" onPlay={event => onReplay(event.currentTarget)} />
    <a className="icon-button" href={url} download={`echo-${attempt.id}.wav`} aria-label="下载录音"><DownloadSimple size={19} /></a>
    <button className="icon-button" aria-label="移除录音" onClick={onDelete}><X size={17} /></button>
  </div>;
}

function Feedback({ attempt, assessing, configured, onAssess, onSettings, onReplay, busy }: { attempt?: Attempt; assessing: boolean; configured: boolean; onAssess: () => void; onSettings: () => void; onReplay: () => void; busy: boolean }) {
  const result = attempt?.assessment;
  const errors: Record<string, string> = { Mispronunciation: '发音需留意', Omission: '可能漏读', Insertion: '可能多读', UnexpectedBreak: '停顿需留意', MissingBreak: '停顿需留意', None: '' };
  const weak = result?.words.filter(word => word.error !== 'None' || (word.accuracy !== undefined && word.accuracy < 75)).sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100));
  return <section className={`feedback ${result ? 'has-result' : ''}`} aria-label="跟读反馈">
    <div className="feedback-heading"><span className="feedback-icon"><Waveform size={27} /></span><div><h3>跟读反馈</h3>{!attempt ? <button className="text-button feedback-config-link" onClick={onSettings}>{configured ? '语音评测已就绪' : '录音后回听对比 · 开启语音评测'}</button> : <p>{result ? '基于英语参考文本的朗读评测' : '先回听，再发现需要改进的地方'}</p>}</div><span className={`badge ${result ? 'success' : ''}`}>{assessing ? '评测中' : result ? '已评测' : '尚未评测'}</span></div>
    
    {attempt && <>
      {!result && <div className="local-feedback"><div><span>录音时长</span><strong>{attempt.duration.toFixed(1)}<small> 秒</small></strong></div><p>{attempt.rms < 0.006 ? '录音音量较低，建议靠近麦克风重录。' : attempt.peak > 0.99 ? '录音可能有削波，建议降低麦克风音量。' : '录音已保存。先听是否漏词，再比较停顿和重音。'}<small>音量与时长不能代表发音水平。</small></p></div>}
      {result && <>
        <div className="scores">{[['准确度', result.accuracy], ['流利度', result.fluency], ['完整度', result.completeness], ['韵律', result.prosody]].map(([label, value]) => <div key={label}><strong>{value ?? '—'}</strong><span>{label}</span></div>)}</div>
        {result.prosody === undefined && <p className="muted small">此结果未包含韵律评分。</p>}
        <h4>逐词看看</h4><div className="word-results">{result.words.map((word, i) => <span key={i} className={word.error === 'Omission' || (word.accuracy !== undefined && word.accuracy < 75) ? 'weak' : ''} title={`${word.word}：${word.accuracy ?? '无评分'}${errors[word.error] ? ` · ${errors[word.error]}` : ''}`}><strong>{word.word}</strong><small>{word.error === 'Omission' ? '漏读' : word.accuracy ?? '—'}</small></span>)}</div>
        <div className="coaching"><h4>下一遍，先关注这里</h4>{weak?.length ? weak.slice(0, 2).map((word, i) => <p key={i}><strong>{word.word}</strong> · {word.error === 'Omission' ? '回听原声中的这个词，再完整读出句子。' : word.error === 'Insertion' ? '核对是否多读了词，按参考句子重新朗读。' : '放慢速度回听这个词，再放回整句中练习。'}{word.phonemes.some(p => p.accuracy !== undefined && p.accuracy < 75) && <small>音素需留意：{word.phonemes.filter(p => p.accuracy !== undefined && p.accuracy < 75).map(p => `/${p.text}/`).join('、')}</small>}</p>) : <p>逐词反馈没有突出低分项。下一遍可隐藏字幕，关注整句节奏。</p>}<button className="text-button" onClick={onReplay} disabled={busy}><Headphones size={17} />再听原声</button></div>
        <p className="small muted">自动评测可能受噪声和识别结果影响；分数不等于与视频说话者的相似度。</p>
      </>}
      {attempt.assessmentError && <p className="form-error" role="alert">{attempt.assessmentError}</p>}
      <button className="button assess-button" onClick={onAssess} disabled={assessing || busy || attempt.duration > 30 || attempt.text.length > 2000 || attempt.rms < 0.006}><Waveform size={19} />{assessing ? '正在分析录音…' : result ? '重新评测此录音' : configured ? '评测此录音' : '开启语音评测'}</button>
      <p className="small muted">{attempt.text.length > 2000 ? '参考文本超过 2,000 字符，可保存和回听；当前云端评测需缩短参考文本后另录。' : attempt.duration > 30 ? '此录音超过 30 秒，可回听和下载；当前云端评测只支持 30 秒以内，请按短句另录后评测。' : '仅点击评测后，才会发送此录音与参考文本到 Azure Speech。'}</p>
    </>}
  </section>;
}

export function App() {
  const [lessons, setLessons] = useState<Lesson[]>([]), [lessonId, setLessonId] = useState(demoId), [index, setIndex] = useState(2);
  const [attempts, setAttempts] = useState<Attempt[]>([]), [reviews, setReviews] = useState<ReviewItem[]>([]), [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [settings, setSettings] = useState<Settings>(readSettings), [page, setPage] = useState<'practice' | 'review'>('practice');
  const [customRange, setCustomRange] = useState(() => ![1, 2, 3, 5, 10].includes(readSettings().groupSize));
  const [modal, setModal] = useState<'import' | 'settings' | 'edit' | null>(null), [advanced, setAdvanced] = useState(false);
  const [toast, setToast] = useState(''), [ready, setReady] = useState(false), [initError, setInitError] = useState('');
  const [service, setService] = useState({ configured: false, prosody: false, reachable: false }), [assessingId, setAssessingId] = useState('');
  const [position, setPosition] = useState(0), [duration, setDuration] = useState(0), [playing, setPlaying] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [trash, setTrash] = useState<Lesson[]>([]);
  const media = useRef<HTMLMediaElement | null>(null), playerContainer = useRef<HTMLDivElement>(null), replayAudios = useRef<HTMLAudioElement[]>([]);
  const lesson = lessons.find(item => item.id === lessonId), segment = lesson?.segments[index];
  const blobUrl = useBlobUrl(lesson?.media), src = blobUrl || lesson?.sourceUrl || '';
  const unit = useMemo(() => lesson ? practiceGroup(lesson.segments, index, settings.groupSize) : undefined, [lesson, index, settings.groupSize]);
  const matchingAttempts = attempts.filter(item => item.lessonId === lessonId && item.segmentId === unit?.id).sort((a, b) => b.createdAt - a.createdAt);
  const selectedAttempt = matchingAttempts.find(item => item.id === selectedAttemptId) || matchingAttempts[0];
  const outOfRange = useMemo(() => duration > 0 && Number.isFinite(duration) && lesson ? lesson.segments.filter(item => item.end > duration).length : 0, [lesson, duration]);
  const marked = reviews.some(item => item.lessonId === lessonId && item.segmentId === segment?.id);
  const notify = (message: string) => setToast(message);

  const practice = usePractice({ media, lesson, index, settings, select: setIndex, notify, captured: async (audio: CapturedAudio, original: Lesson, i: number, group: ReturnType<typeof practiceGroup>, speed: number) => {
    const attempt: Attempt = { id: crypto.randomUUID(), lessonId: original.id, segmentId: group.id, segmentIds: group.segmentIds, referenceStart: group.start, referenceEnd: group.end, referenceSpeed: speed, text: group.text, createdAt: Date.now(), ...audio };
    setAttempts(previous => [attempt, ...previous]); setSelectedAttemptId(attempt.id);
    try { await storage.save('attempts', attempt); } catch { notify(storage.storageMessage()); }
  } });

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const response = await fetch(appUrl('demo.json')); if (!response.ok) throw new Error('内置示例素材加载失败，请刷新页面重试。');
        const demo: Lesson = { id: demoId, title: 'Small steps · 小步前进', kind: 'audio', segments: validateSegments(await response.json()), sourceUrl: appUrl('demo.wav'), demo: true, createdAt: 0 };
        let storedLessons: Lesson[] = [], storedAttempts: Attempt[] = [], storedReviews: ReviewItem[] = [];
        try { [storedLessons, storedAttempts, storedReviews] = await Promise.all([storage.list<Lesson>('lessons'), storage.list<Attempt>('attempts'), storage.list<ReviewItem>('reviews')]); }
        catch { if (!cancelled) notify(storage.storageMessage()); }
        if (cancelled) return;
        setTrash(storedLessons.filter(item => item.deletedAt));
        const activeLessons = storedLessons.filter(item => !item.deletedAt);
        const all = [activeLessons.find(item => item.id === demoId) || demo, ...activeLessons.filter(item => item.id !== demoId).sort((a, b) => b.createdAt - a.createdAt)];
        const activeIds = new Set(all.map(item => item.id));
        setLessons(all); setAttempts(storedAttempts.filter(item => activeIds.has(item.lessonId))); setReviews(storedReviews.filter(item => activeIds.has(item.lessonId)));
        try {
          const last = JSON.parse(localStorage.getItem('echo-position') || 'null');
          const found = all.find(item => item.id === last?.lessonId);
          if (found) { setLessonId(found.id); setIndex(Math.min(found.segments.length - 1, Math.max(0, Number(last.index) || 0))); }
        } catch { /* Resume the example when local preferences cannot be read. */ }
        setReady(true);
      } catch (error) { if (!cancelled) setInitError((error as Error).message); }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const list = document.querySelector<HTMLElement>('.transcript');
    const row = list?.querySelector<HTMLElement>('.transcript-row.selected');
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
  }, [index, lessonId, ready]);

  async function refreshService() {
    try { const response = await fetch(appUrl('api/health')); if (!response.ok) throw new Error(); const data = await response.json(); setService({ configured: !!data.configured, prosody: !!data.prosody, reachable: true }); }
    catch { setService({ configured: false, prosody: false, reachable: false }); }
  }
  useEffect(() => { void refreshService(); }, []);
  useEffect(() => { try { localStorage.setItem('echo-settings', JSON.stringify(settings)); } catch { /* Recordings use IndexedDB instead. */ } }, [settings]);
  useEffect(() => { if (ready) { try { localStorage.setItem('echo-position', JSON.stringify({ lessonId, index })); } catch { /* Session remains usable without localStorage. */ } } }, [lessonId, index, ready]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 7000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (media.current) media.current.playbackRate = settings.speed; }, [settings.speed, src]);

  function pauseRecordings(except?: HTMLAudioElement) { document.querySelectorAll<HTMLAudioElement>('.recording-row audio').forEach(element => { if (element !== except) element.pause(); }); replayAudios.current.forEach(element => { element.pause(); URL.revokeObjectURL(element.src); }); replayAudios.current = []; }
  function selectSentence(i: number) {
    if (practice.busy) return;
    media.current?.pause(); pauseRecordings(); setIndex(i); setSelectedAttemptId('');
    if (media.current && lesson) { const seek = Math.min(lesson.segments[i].start, Number.isFinite(media.current.duration) ? media.current.duration : lesson.segments[i].start); media.current.currentTime = seek; setPosition(seek); }
  }
  function selectLesson(id: string) { if (practice.busy) { notify('请先结束当前练习再切换素材。'); return; } media.current?.pause(); pauseRecordings(); if (id === lessonId && media.current && lesson) { media.current.currentTime = lesson.segments[0].start; setPosition(lesson.segments[0].start); } setLessonId(id); setIndex(0); setSelectedAttemptId(''); setPage('practice'); }
  function changeSetting<K extends keyof Settings>(key: K, value: Settings[K]) { setSettings(previous => ({ ...previous, [key]: value })); }
  async function toggleReview() {
    if (!segment) return;
    const id = `${lessonId}:${segment.id}`;
    try {
      if (marked) { await storage.remove('reviews', id); setReviews(previous => previous.filter(item => item.id !== id)); notify('已移出待复习。'); }
      else { const item = { id, lessonId, segmentId: segment.id, createdAt: Date.now() }; await storage.save('reviews', item); setReviews(previous => [...previous, item]); notify('已加入待复习。'); }
    } catch { notify(storage.storageMessage()); }
  }
  async function assessAttempt() {
    if (!service.configured) { setModal('settings'); return; }
    if (!selectedAttempt || assessingId) return;
    if (selectedAttempt.rms < 0.006) { notify('录音音量过低，请先重新录音。'); return; }
    const attempt = selectedAttempt;
    setAssessingId(attempt.id);
    try {
      const bytes = new Uint8Array(await attempt.blob.arrayBuffer()); let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const response = await fetch(appUrl('api/assess'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: attempt.text, audio: btoa(binary) }), signal: AbortSignal.timeout(35000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || '评测失败，请重试。');
      const updated = { ...attempt, assessment: body as Assessment, assessmentError: undefined };
      setAttempts(previous => previous.map(item => item.id === attempt.id ? updated : item));
      try { await storage.save('attempts', updated); } catch { notify(storage.storageMessage()); }
    } catch (error) {
      const message = (error as Error).name === 'TimeoutError' ? '请求超时，录音已保留，可以稍后重试。' : (error as Error).message;
      setAttempts(previous => previous.map(item => item.id === attempt.id ? { ...item, assessmentError: message } : item)); notify(message);
    } finally { setAssessingId(''); }
  }
  async function importLesson(newLesson: Lesson) { await storage.save('lessons', newLesson); setLessons(previous => [...previous, newLesson]); selectLesson(newLesson.id); setModal(null); notify('导入成功。选择一句，开始练习。'); }
  async function archiveLesson(target: Lesson) {
    if (target.demo || practice.busy || assessingId) throw new Error('当前不能删除素材。');
    const archived = { ...target, deletedAt: Date.now() };
    await storage.save('lessons', archived);
    media.current?.pause(); pauseRecordings();
    setLessons(previous => previous.filter(item => item.id !== target.id));
    setTrash(previous => [archived, ...previous]);
    setAttempts(previous => previous.filter(item => item.lessonId !== target.id));
    setReviews(previous => previous.filter(item => item.lessonId !== target.id));
    if (lessonId === target.id) { setLessonId(demoId); setIndex(0); setSelectedAttemptId(''); setPage('practice'); }
    notify('素材已移入回收站，可以恢复。');
  }
  async function restoreLesson(target: Lesson) {
    const { deletedAt, ...restored } = target;
    const [savedAttempts, savedReviews] = await Promise.all([storage.list<Attempt>('attempts'), storage.list<ReviewItem>('reviews')]);
    await storage.save('lessons', restored);
    setLessons(previous => [...previous, restored]); setTrash(previous => previous.filter(item => item.id !== target.id));
    setAttempts(previous => [...previous.filter(item => item.lessonId !== target.id), ...savedAttempts.filter(item => item.lessonId === target.id)]);
    setReviews(previous => [...previous.filter(item => item.lessonId !== target.id), ...savedReviews.filter(item => item.lessonId === target.id)]);
    notify('素材及练习数据已恢复。');
  }
  async function purgeLesson(target: Lesson) {
    if (!target.deletedAt || target.demo) throw new Error('请先移入回收站。');
    await storage.purgeLesson(target.id);
    setTrash(previous => previous.filter(item => item.id !== target.id));
    notify('素材及相关练习数据已永久删除。');
  }
  async function editSegment(updated: Segment) {
    if (!lesson || !segment) return;
    const segments = lesson.segments.map(item => item.id === segment.id ? updated : item); validateSegments(segments);
    const updatedLesson = { ...lesson, segments }; await storage.save('lessons', updatedLesson); setLessons(previous => previous.map(item => item.id === lesson.id ? updatedLesson : item));
    if (media.current) { const seek = Math.min(updated.start, duration || updated.start); media.current.currentTime = seek; setPosition(seek); } notify('字幕与时间轴已更新。');
  }
  async function removeRecording() {
    const id = deleteId; setDeleteId('');
    try { await storage.remove('attempts', id); setAttempts(previous => previous.filter(item => item.id !== id)); notify('录音已移除。'); }
    catch { notify('移除失败，请重试。'); }
  }
  async function compare() {
    if (!selectedAttempt || practice.busy) return;
    pauseRecordings(); const completed = await practice.listen(unit && { ...unit, start: selectedAttempt.referenceStart ?? unit.start, end: selectedAttempt.referenceEnd ?? unit.end }, selectedAttempt.referenceSpeed);
    // A stopped comparison must not unexpectedly play the user's take.
    if (completed && media.current?.currentTime && unit && media.current.currentTime >= Math.min(selectedAttempt.referenceEnd ?? unit.end, media.current.duration) - 0.1) {
      const audio = new Audio(URL.createObjectURL(selectedAttempt.blob)); replayAudios.current.push(audio);
      const cleanup = () => { URL.revokeObjectURL(audio.src); replayAudios.current = replayAudios.current.filter(item => item !== audio); };
      audio.onended = cleanup; audio.onerror = cleanup;
      try { await audio.play(); } catch { cleanup(); notify('录音播放被浏览器阻止，请点击练习记录中的播放按钮。'); }
    }
  }
  function onTimeUpdate() {
    const element = media.current; if (!element) return;
    setPosition(element.currentTime);
    if (!practice.busy && !element.paused && lesson) { const found = lesson.segments.findIndex(s => element.currentTime >= s.start && element.currentTime < s.end); if (found >= 0 && unit && found > unit.lastIndex && element.currentTime >= unit.end) { setIndex(unit.lastIndex + 1); setSelectedAttemptId(''); } }
  }
  function seekPosition(time: number) {
    if (practice.busy || !media.current || !lesson) return;
    media.current.currentTime = time; setPosition(time); pauseRecordings();
    // An explicit scrub selects its cue, including the next cue in a gap.
    setIndex(segmentAtPosition(lesson.segments, time)); setSelectedAttemptId('');
  }
  async function togglePlayer() {
    const element = media.current; if (!element || practice.busy) return;
    if (!element.paused) element.pause(); else { pauseRecordings(); try { await element.play(); } catch { notify('播放失败，请检查素材是否为浏览器支持的格式。'); } }
  }
  const phaseLabels = { idle: '开始跟读', waiting: '开始录音', preparing: '准备麦克风…', listening: '停止播放', recording: '结束录音', saving: '正在保存…', break: '准备下一遍' };
  const videoCaption = settings.groupSize > 1 && lesson ? lesson.segments.slice(index, (unit?.lastIndex ?? index) + 1).find(item => position >= item.start && position < item.end)?.text || '' : segment?.text;
  const progressStep = practice.phase === 'listening' ? 0 : practice.phase === 'recording' || practice.phase === 'preparing' ? 1 : selectedAttempt ? 2 : 0;

  return <>
    <header className="site-header"><a className="brand" href={appUrl('')} aria-label="返回 Shadowing 首页" onClick={event => { if (practice.busy) event.preventDefault(); }}><span className="brand-name">Focus Studio</span><span className="brand-copy"><strong>Echo / 影子跟读</strong><small>用真实的英语素材，练出自然的表达</small></span></a><nav aria-label="主导航"><button className={page === 'practice' ? 'active' : ''} onClick={() => { if (!practice.busy) setPage('practice'); }} disabled={practice.busy}>练习</button><button className={page === 'review' ? 'active' : ''} onClick={() => { if (!practice.busy) { media.current?.pause(); pauseRecordings(); setPage('review'); } }} disabled={practice.busy}>复习{reviews.length > 0 && <span className="nav-count">{reviews.length}</span>}</button></nav><div className="header-actions"><button className="icon-button settings-button" aria-label="练习与评测设置" onClick={() => setModal('settings')} disabled={practice.busy}><GearSix size={21} /></button><button className="button import-button" onClick={() => setModal('import')} disabled={practice.busy}><UploadSimple size={20} />导入素材</button></div></header>
    {!ready ? <main className="loading"><Waveform size={38} /><h1>{initError ? '示例加载失败' : '准备你的练习空间'}</h1><p>{initError || '正在加载素材与本地练习记录…'}</p>{initError && <button className="button" onClick={() => location.reload()}>重新加载</button>}</main> : page === 'review' ? <main className="review-page"><p className="eyebrow">A LITTLE BETTER, EVERY DAY</p><h1>再练一遍，听见进步。</h1><p className="review-intro">把需要打磨的句子留下，每次只解决一个问题。</p><div className="review-toolbar"><h2>待复习 <span>{reviews.length}</span></h2><button className="text-button" onClick={() => download(new Blob([JSON.stringify(attempts.map(({ blob, ...item }) => item), null, 2)], { type: 'application/json' }), 'echo-practice-history.json')} disabled={!attempts.length}><DownloadSimple size={18} />导出练习记录</button></div>{!reviews.length ? <div className="review-empty"><BookmarkSimple size={46} weight="light" /><h3>留下一句，下一次再练。</h3><p>在练习页点击句子旁的书签，即可加入待复习。</p><button className="button primary" onClick={() => setPage('practice')}>回到练习<ArrowRight size={18} /></button></div> : <div className="review-list">{reviews.map(item => { const source = lessons.find(l => l.id === item.lessonId), sentence = source?.segments.find(s => s.id === item.segmentId); if (!source || !sentence) return null; const takes = attempts.filter(a => a.lessonId === source.id && a.segmentId === sentence.id); return <div key={item.id}><span className="review-item-icon"><BookmarkSimple size={24} weight="fill" /></span><button className="review-content" onClick={() => { selectLesson(source.id); setIndex(source.segments.indexOf(sentence)); }}><small>{source.title} · {takes.length} 次录音</small><strong>{sentence.text}</strong><span>{sentence.translation}</span></button><button className="icon-button" aria-label={`移除复习：${sentence.text}`} onClick={async () => { try { await storage.remove('reviews', item.id); setReviews(previous => previous.filter(r => r.id !== item.id)); } catch { notify(storage.storageMessage()); } }}><CheckCircle size={24} /></button><button className="button" onClick={() => { selectLesson(source.id); setIndex(source.segments.indexOf(sentence)); }}>去练习<ArrowRight size={18} /></button></div>; })}</div>}<p className="local-note">素材、录音与记录保存在当前浏览器。导出的记录不包含音频，可在练习页单独下载录音。</p></main> : lesson && segment && <main className="practice-page">
      <div className="workspace">
        <section className="practice-main" aria-label="练习工作区">
          <div className="player" ref={playerContainer}>
            {lesson.kind === 'video' ? <video key={lesson.id} ref={element => { media.current = element; }} src={src || undefined} playsInline preload="metadata" onLoadedMetadata={() => { if (media.current) { setDuration(media.current.duration); media.current.currentTime = Math.min(segment.start, Number.isFinite(media.current.duration) ? media.current.duration : segment.start); media.current.playbackRate = settings.speed; } }} onTimeUpdate={onTimeUpdate} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => notify('素材播放失败，请检查文件编码并重新导入。')} onClick={() => void togglePlayer()} /> : <><img src={lesson.demo ? appUrl('assets/speaker-poster.png') : appUrl('assets/speaker-poster.png')} alt={lesson.demo ? '示例合成音频封面：室内讲述者' : '音频练习封面'} /><audio key={lesson.id} ref={element => { media.current = element; }} src={src || undefined} preload="metadata" onLoadedMetadata={() => { if (media.current) { setDuration(media.current.duration); media.current.currentTime = Math.min(segment.start, Number.isFinite(media.current.duration) ? media.current.duration : segment.start); media.current.playbackRate = settings.speed; } }} onTimeUpdate={onTimeUpdate} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => notify('素材播放失败，请检查文件编码。')} /></>}
            <span className="source-tag"><Headphones size={13} />{lesson.demo ? '示例 · 合成音频 / 静态封面' : lesson.kind === 'audio' ? '音频练习 · 静态封面' : lesson.title}</span>
            {!settings.hideText && <p className="video-subtitle">{videoCaption}</p>}
            <div className="player-controls"><button className="player-button" aria-label={playing ? '暂停素材' : '播放素材'} onClick={() => void togglePlayer()} disabled={practice.busy}>{playing ? <Pause size={23} weight="fill" /> : <Play size={23} weight="fill" />}</button><span className="player-time">{formatTime(position)} / {formatTime(duration)}</span><input className="scrubber" type="range" aria-label="播放进度" min={0} max={duration || 1} step={0.01} value={Math.min(position, duration || 1)} disabled={practice.busy} onChange={event => { seekPosition(Number(event.target.value)); }} /><button className="player-button" aria-label={settings.hideText ? '显示字幕' : '隐藏字幕'} onClick={() => changeSetting('hideText', !settings.hideText)}>{settings.hideText ? <EyeSlash size={20} /> : <Eye size={20} />}</button><span className="player-speed">{settings.speed.toFixed(1)}x</span><button className="player-button" aria-label="全屏播放" onClick={async () => { try { if (!document.fullscreenElement) await playerContainer.current?.requestFullscreen(); else await document.exitFullscreen(); } catch { notify('当前浏览器不支持全屏，可调整浏览器窗口观看。'); } }}><ArrowSquareOut size={21} /></button></div>
          </div>
          {outOfRange > 0 && <p className="subtitle-warning" role="status">已保留全部字幕，其中 {outOfRange} 条超出素材时长（{formatTime(duration)}）。跨越结尾的句子只播放已有原声；完全超出的句子需调整时间轴或更换素材后跟读。</p>}
          <div className="sentence-meta"><span>{settings.groupSize > 1 ? '当前句组' : '当前句子'}&nbsp; {index + 1}{settings.groupSize > 1 ? `–${(unit?.lastIndex ?? index) + 1}` : ''} / {lesson.segments.length}</span><div><button className={`icon-button ${marked ? 'bookmarked' : ''}`} aria-label={marked ? '移出待复习' : settings.groupSize > 1 ? '加入首句待复习' : '加入待复习'} onClick={() => void toggleReview()}><BookmarkSimple size={21} weight={marked ? 'fill' : 'regular'} /></button><button className="icon-button" aria-label={settings.groupSize > 1 ? '修改首句字幕和时间轴' : '修改字幕和时间轴'} onClick={() => { media.current?.pause(); setModal('edit'); }} disabled={practice.busy}><SlidersHorizontal size={20} /></button></div></div>
          <div className={`sentence-focus ${settings.groupSize > 1 ? 'group-focus' : ''} ${settings.hideText ? 'hidden-sentence' : ''}`}><h1>{settings.hideText ? '听清楚，再说出来。' : unit?.text}</h1><p>{settings.hideText ? '字幕已隐藏，点击播放器中的眼睛图标可显示。' : unit?.translation || '先听声音，再模仿整句的表达。'}</p></div>
          <div className="group-control"><label>练习范围<select aria-label="练习范围" value={customRange ? 'custom' : settings.groupSize} disabled={practice.busy} onChange={event => { setCustomRange(event.target.value === 'custom'); if (event.target.value !== 'custom') changeSetting('groupSize', Number(event.target.value)); }}>{[1, 2, 3, 5, 10].map(size => <option key={size} value={size}>{size === 1 ? '单句练习' : `${size} 句一起练`}</option>)}<option value="custom">自定义</option></select></label>{customRange && <label>连续句数<input type="number" min={1} step={1} aria-label="自定义练习句数" value={settings.groupSize} disabled={practice.busy} onChange={event => { const size = Number(event.target.value); if (Number.isSafeInteger(size) && size > 0) changeSetting('groupSize', size); }} style={{width:80}} /></label>}<span>{settings.groupSize > 1 ? `从当前句开始连续 ${unit?.segmentIds.length} 句，保留句间停顿；整组播放、录音和重复。` : '选择多句，可练习连贯表达。'}</span></div>
          <div className="main-actions"><button className={`button primary record-button ${practice.phase === 'recording' ? 'is-recording' : ''}`} disabled={practice.phase === 'saving'} onClick={() => { if (practice.phase === 'waiting') practice.record(); else if (practice.busy) practice.stop(); else { pauseRecordings(); void practice.start(); } }}>{practice.phase === 'recording' ? <Pause size={25} weight="fill" /> : <Microphone size={25} weight="fill" />}<span>{phaseLabels[practice.phase]}{practice.phase === 'recording' && <small>{formatTime(practice.elapsed)} / {formatTime(practice.recordingLimit)}</small>}</span></button><button className="button original-button" disabled={practice.busy} onClick={() => { pauseRecordings(); void practice.listen(); }}><Play size={21} weight="fill" />播放原声</button><label className="compact-control">播放语速<select aria-label="播放语速" value={settings.speed} disabled={practice.busy} onChange={event => changeSetting('speed', Number(event.target.value))}>{[0.6, 0.8, 1, 1.2].map(speed => <option key={speed} value={speed}>{speed.toFixed(1)}x</option>)}</select></label><div className="compact-control"><span>循环播放</span><Toggle label="循环播放" checked={settings.repeat} onChange={() => changeSetting('repeat', !settings.repeat)} disabled={practice.busy} /></div></div>
          {practice.phase === 'waiting' && <p className="small muted">原声已结束，准备好后点击“开始录音”。<button className="text-button" onClick={practice.stop}>取消本轮练习</button></p>}{practice.busy && <div className="practice-status" role="status"><span>{practice.phase === 'waiting' ? '等待你开始录音' : practice.phase === 'recording' ? settings.groupSize > 1 ? '正在录音，请跟读当前句组' : '正在录音，请跟读当前句子' : practice.phase === 'preparing' ? '请允许麦克风访问' : practice.phase === 'listening' ? settings.groupSize > 1 ? '正在播放当前句组原声' : '正在播放当前句原声' : practice.phase === 'break' ? '短暂休息，即将继续' : '正在保存本次录音'} · 第 {practice.round} / {settings.repeat ? settings.repeats : 1} 遍</span>{practice.phase === 'recording' && <progress aria-label="麦克风音量" max={1} value={practice.level} />}</div>}
          <div className="practice-toolbar"><div><button className="icon-button" aria-label={settings.groupSize > 1 ? '上一组' : '上一句'} disabled={index === 0 || practice.busy} onClick={() => selectSentence(Math.max(0, index - settings.groupSize))}><ArrowLeft size={20} /></button><button className="icon-button" aria-label={settings.groupSize > 1 ? '下一组' : '下一句'} disabled={(unit?.lastIndex ?? index) === lesson.segments.length - 1 || practice.busy} onClick={() => selectSentence(Math.min(lesson.segments.length - 1, index + settings.groupSize))}><ArrowRight size={20} /></button><span>{settings.mode === 'manual' ? '先听后手动录音' : settings.mode === 'listen' ? '先听后读' : '同步跟读'} · {settings.repeat ? `${settings.repeats} 遍` : '1 遍'}</span></div><button className="text-button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><SlidersHorizontal size={17} />练习设置</button></div>
          {advanced && <div className="advanced-settings"><label className="field">练习模式<select aria-label="练习模式" value={settings.mode} disabled={practice.busy} onChange={event => changeSetting('mode', event.target.value as Settings['mode'])}><option value="listen">先听后读：听完再录音</option><option value="manual">先听后手动录音：准备好后点击开始</option><option value="shadow">同步跟读：边听边录音</option></select></label><label className="field">重复次数<select aria-label="重复次数" value={settings.repeats} disabled={practice.busy || !settings.repeat} onChange={event => changeSetting('repeats', Number(event.target.value))}>{[1, 2, 3, 5].map(count => <option key={count} value={count}>{count} 遍</option>)}</select></label><label className="field">每次录音时长<select aria-label="每次录音时长" value={settings.recordingSeconds} disabled={practice.busy || settings.mode === 'shadow'} onChange={event => changeSetting('recordingSeconds', Number(event.target.value))}><option value={0}>自动：按原声时长</option><option value={30}>至少 30 秒</option><option value={60}>至少 1 分钟</option><option value={120}>至少 2 分钟</option><option value={300}>5 分钟</option></select></label><div className="auto-next"><span>{settings.groupSize > 1 ? '自动进入下一组' : '自动进入下一句'}</span><Toggle label="自动进入下一句" checked={settings.autoNext} disabled={practice.busy} onChange={() => changeSetting('autoNext', !settings.autoNext)} /></div><p>录音最长 5 分钟，可提前结束并保存。长素材可开启自动下一句，连续练完整份素材；同步跟读的录音随原声结束，时长设置用于先听后读。建议戴耳机。</p></div>}
          {matchingAttempts.length > 0 && <section className="recordings"><div className="section-heading"><h2>{settings.groupSize > 1 ? '本组练习记录' : '本句练习记录'} <span>{matchingAttempts.length}</span></h2><button className="text-button" onClick={() => void compare()} disabled={practice.busy}><SpeakerHigh size={18} />原声 → 我的录音</button></div>{selectedAttempt?.referenceStart !== undefined && (selectedAttempt.referenceStart !== unit?.start || selectedAttempt.referenceEnd !== Math.min(unit?.end ?? 0, duration || Infinity)) && <p className="small muted">这条录音对应保存时的原声范围，当前字幕时间轴已不同。声波对比使用录制时的范围。</p>}{selectedAttempt?.text !== unit?.text && <p className="small muted">选中录音对应修改前的文本：{selectedAttempt?.text}</p>}{selectedAttempt && unit && <WaveformCompare key={selectedAttempt.id} attempt={selectedAttempt} reference={unit} source={src} disabled={practice.busy} onStart={() => { media.current?.pause(); pauseRecordings(); }} />}{matchingAttempts.map(item => <RecordingRow key={item.id} attempt={item} selected={item.id === selectedAttempt?.id} onSelect={() => setSelectedAttemptId(item.id)} onDelete={() => setDeleteId(item.id)} onReplay={element => { media.current?.pause(); practice.stop(); pauseRecordings(element); }} />)}</section>}
        </section>
        <aside className="transcript-side" aria-label="逐句字幕"><div className="transcript-heading"><h2>逐句跟读</h2><span>共 {lesson.segments.length} 句</span></div><Transcript key={lesson.id} segments={lesson.segments} active={index} groupEnd={unit?.lastIndex ?? index} hidden={settings.hideText} busy={practice.busy} bookmarks={new Set(reviews.filter(r => r.lessonId === lessonId).map(r => r.segmentId))} select={selectSentence} /><Feedback attempt={selectedAttempt} configured={service.configured} assessing={!!assessingId} onAssess={() => void assessAttempt()} onSettings={() => setModal('settings')} onReplay={() => void practice.listen()} busy={practice.busy} /></aside>
      </div>
      <section className="workflow" aria-label="练习步骤">{[{ icon: Play, title: '1. 听原声', description: '先听清发音和语调' }, { icon: Microphone, title: '2. 跟读', description: '模仿并大声跟读' }, { icon: Waveform, title: '3. 对比', description: '对比自己的录音与原声' }, { icon: ArrowCounterClockwise, title: '4. 重练', description: '根据反馈再次练习' }].map(({ icon: Icon, title, description }, i) => <div className={`workflow-step ${progressStep === i ? 'current' : ''}`} key={title}><span className="step-icon"><Icon size={28} weight={i < 2 ? 'fill' : 'regular'} /></span><strong>{title}</strong><p>{description}</p></div>)}</section>
      <footer className="page-footer"><span>{lesson.title}</span><span>每一次开口，都是一点进步。</span><span>录音与素材保存在当前浏览器</span></footer>
    </main>}
    {toast && <div className="toast" role="status"><Check size={19} /><span>{toast}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setToast('')}><X size={17} /></button></div>}
    {modal === 'import' && <ImportModal trash={trash} onArchive={archiveLesson} onRestore={restoreLesson} onPurge={purgeLesson} lessons={lessons} onClose={() => setModal(null)} onImport={importLesson} onSelect={selectLesson} />}
    {modal === 'edit' && segment && <SegmentEditor segment={segment} onClose={() => setModal(null)} onSave={editSegment} />}
    {deleteId && <Modal title="移除这次录音？" description="移除后无法从本应用恢复，可以先下载保留。" onClose={() => setDeleteId('')}><div className="modal-actions"><button className="button" onClick={() => setDeleteId('')}>保留录音</button><button className="button primary" onClick={() => void removeRecording()}>移除录音</button></div></Modal>}
    {modal === 'settings' && <Modal title="让反馈更具体" description="录音对比随时可用；发音评分需要连接语音评测服务。" onClose={() => setModal(null)}><div className="service-state"><span className="feedback-icon"><Waveform size={30} /></span><div><h3>{service.configured ? 'Azure Speech 已连接' : '尚未配置语音评测'}</h3><p>{service.configured ? `美式英语 · ${service.prosody ? '已请求韵律评分' : '准确度、流利度、完整度'}` : service.reachable ? '先使用本地录音对比，也可以配置后开启逐词反馈。' : '没有连接到评测后端，本地练习仍可使用。'}</p></div></div><ol className="setup-steps"><li>在 Azure 中创建 Speech 资源。</li><li>在项目根目录将 <code>.env.example</code> 复制为 <code>.env</code>，填写 <code>AZURE_SPEECH_KEY</code> 和 <code>AZURE_SPEECH_REGION</code>。</li><li>重启应用，回来检查连接状态。</li></ol><p className="privacy-note">录音默认留在此设备。点击“评测此录音”才会把该录音和当时的英文文本发送给 Azure Speech，可能产生服务费用。评分用于练习参考，不能替代人工判断。</p><div className="modal-actions"><a className="text-button" href="https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short" target="_blank" rel="noreferrer">服务说明<ArrowSquareOut size={16} /></a><button className="button" onClick={() => void refreshService()}>检查连接状态<Repeat size={17} /></button></div></Modal>}
  </>;
}
