import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const voices = ['en-US-AriaNeural', 'en-US-GuyNeural', 'en-GB-SoniaNeural', 'zh-CN-XiaoxiaoNeural'];
export function validateSpeech(body) {
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000 || !voices.includes(body.voice)) throw new Error('语音请求格式不正确。');
  return { text: body.text, voice: body.voice };
}
export function synthesize(body, signal, env = process.env) {
  const local = fileURLToPath(new URL(process.platform === 'win32' ? '../.venv-tts/Scripts/python.exe' : '../.venv-tts/bin/python', import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(env.TTS_PYTHON || (existsSync(local) ? local : 'python'), [fileURLToPath(new URL('./tts.py', import.meta.url))], { windowsHide: true, signal });
    const chunks = [];
    const timer = setTimeout(() => child.kill(), 60000);
    child.stdout.on('data', chunk => chunks.push(chunk));
    // Do not expose upstream diagnostics or submitted article text.
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new Error('无法启动语音服务，请安装 server/requirements-tts.txt 或检查 TTS_PYTHON。')); });
    child.on('close', code => { clearTimeout(timer); const audio = Buffer.concat(chunks); if (code === 0 && audio.length) resolve(audio); else reject(new Error('语音生成失败，请检查 edge-tts 依赖、网络或微软服务后重试。')); });
    child.stdin.end(JSON.stringify(body));
  });
}
export function ttsMiddleware(env = process.env, generate = synthesize) {
  let inflight = 0;
  return async (req, res, next) => {
    if (new URL(req.url || '/', 'http://localhost').pathname !== '/api/tts') return next();
    const json = (status, error) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error })); };
    if (req.method !== 'POST') return json(405, '请使用 POST。');
    try { if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(403, '不接受跨站语音请求。'); } catch { return json(403, '请求来源不正确。'); }
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, '请求格式不正确。');
    if (inflight >= 2) return json(429, '语音服务忙，请稍后重试。');
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', abort);
    inflight++;
    try {
      const chunks = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 16000) return json(413, '单次语音请求过长，请分段生成。'); chunks.push(chunk); }
      let body;
      try { body = validateSpeech(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { return json(400, '缺少有效文本或语音。'); }
      const audio = await generate(body, controller.signal, env);
      if (controller.signal.aborted) return;
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }); res.end(audio);
    } catch { if (!controller.signal.aborted) json(502, '语音生成失败，请检查 Python、edge-tts 依赖和网络。文章已保留，可重试。'); }
    finally { inflight--; res.off('close', abort); }
  };
}
