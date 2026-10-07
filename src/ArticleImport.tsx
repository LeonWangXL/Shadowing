import { useEffect, useRef, useState } from 'react';
import { articleLesson } from './article';
import type { Lesson } from './types';

export function ArticleImport({ onImport, onBusy }: { onImport: (lesson: Lesson) => Promise<void>; onBusy: (value: boolean) => void }) {
  const [text, setText] = useState(''), [title, setTitle] = useState(''), [voice, setVoice] = useState('en-US-AriaNeural');
  const [error, setError] = useState(''), [progress, setProgress] = useState('');
  const [fileName, setFileName] = useState('');
  const originalFile = useRef<File | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function generate() {
    if (controller.current) return;
    const task = new AbortController(); controller.current = task; onBusy(true); setError(''); setProgress('准备生成…');
    try {
      const lesson = await articleLesson(text, title, voice, task.signal, setProgress);
      if (fileName) lesson.articleFileName = fileName;
      if (originalFile.current) lesson.articleFile = originalFile.current;
      task.signal.throwIfAborted();
      setProgress('正在保存素材…');
      await onImport(lesson);
    } catch (err) { if (!task.signal.aborted) setError((err as Error).message); }
    finally { controller.current = null; onBusy(false); setProgress(''); }
  }
  return <details className="paste-subtitle"><summary>文章转语音 + 自动生成 SRT</summary>
    <p>粘贴文章或导入 UTF-8 TXT。按句生成微软语音，时间轴取自实际音频时长，句间保留 0.25 秒停顿。生成完成后可离线播放、跟读和下载。</p>
    <label className="field">文章文件<input type="file" accept=".txt,text/plain" disabled={!!progress} onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { originalFile.current = file; setText(await file.text()); setFileName(file.name); setTitle(file.name.replace(/\.txt$/i, '')); setError(''); } catch { setError('无法读取文章文件，请重试。'); } }} /></label>
    <label className="field">文章名称<input value={title} disabled={!!progress} onChange={event => setTitle(event.target.value)} /></label>
    <label className="field">朗读声音<select value={voice} disabled={!!progress} onChange={event => setVoice(event.target.value)}><option value="en-US-AriaNeural">英语（美国）Aria</option><option value="en-US-GuyNeural">英语（美国）Guy</option><option value="en-GB-SoniaNeural">英语（英国）Sonia</option><option value="zh-CN-XiaoxiaoNeural">中文 Xiaoxiao（发音评测仅支持英语）</option></select></label>
    <label className="field">文章内容<textarea aria-label="文章内容" rows={8} value={text} disabled={!!progress} onChange={event => setText(event.target.value)} placeholder="Small steps make a big difference. Start with one sentence today." /></label>
    <p className="privacy-note">点击生成会通过第三方开源 edge-tts 向微软在线语音服务发送文章。无需 Azure 密钥，需要本地 Python 后端和网络；服务变化可能导致生成失败。不会生成发音评分。</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><span role="status">{progress || '文章不设总字数上限，长文章生成和保存需要更多时间及浏览器空间。'}</span>{progress ? <button className="button" disabled={progress === '正在保存素材…'} onClick={() => controller.current?.abort()}>取消生成</button> : <button className="button primary" disabled={!text.trim()} onClick={() => void generate()}>生成并导入练习</button>}</div>
  </details>;
}
