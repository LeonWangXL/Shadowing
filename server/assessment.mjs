import { Buffer } from 'node:buffer';
import { ttsMiddleware } from './tts.mjs';

export function configured(env = process.env) {
  return Boolean(env.AZURE_SPEECH_KEY && /^[a-z0-9-]{2,40}$/.test(env.AZURE_SPEECH_REGION || ''));
}

export function validateWav(buffer) {
  if (buffer.length < 46 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE' || buffer.toString('ascii', 12, 16) !== 'fmt ' || buffer.readUInt32LE(16) !== 16 || buffer.readUInt16LE(20) !== 1 || buffer.readUInt16LE(22) !== 1 || buffer.readUInt32LE(24) !== 16000 || buffer.readUInt16LE(34) !== 16 || buffer.toString('ascii', 36, 40) !== 'data') throw new Error('需要 16kHz 单声道 PCM WAV 录音。');
  const bytes = buffer.readUInt32LE(40);
  const duration = bytes / 32000;
  if (bytes !== buffer.length - 44 || bytes % 2 || duration < 0.3 || duration > 30) throw new Error('评测录音必须介于 0.3 到 30 秒。');
  return duration;
}

const score = value => typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value))) : undefined;
export function normalizeAssessment(body) {
  if (body.RecognitionStatus !== 'Success' || !body.NBest?.length) throw new Error(body.RecognitionStatus === 'NoMatch' ? '未识别到清晰英语，请靠近麦克风重新朗读。' : '语音服务未返回有效评测，请重新录音。');
  const best = body.NBest[0];
  const values = best.PronunciationAssessment || best;
  if (score(values.AccuracyScore) === undefined) throw new Error('语音服务没有返回发音评分，请检查评测配置。');
  return {
    provider: 'Azure Speech', assessedAt: Date.now(), recognized: best.Display || body.DisplayText || best.Lexical || '',
    accuracy: score(values.AccuracyScore), fluency: score(values.FluencyScore), completeness: score(values.CompletenessScore), prosody: score(values.ProsodyScore), overall: score(values.PronScore),
    words: (best.Words || []).map(word => ({
      word: word.Word, accuracy: score((word.PronunciationAssessment || word).AccuracyScore), error: (word.PronunciationAssessment || word).ErrorType || 'None',
      phonemes: (word.Phonemes || []).map(phoneme => ({ text: phoneme.Phoneme, accuracy: score((phoneme.PronunciationAssessment || phoneme).AccuracyScore) }))
    }))
  };
}

export async function assess(audio, text, env = process.env, fetcher = fetch) {
  validateWav(audio);
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw new Error('参考文本为空或过长。');
  const parameters = { ReferenceText: text.trim(), GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: 'True', PhonemeAlphabet: 'IPA' };
  if (env.AZURE_ENABLE_PROSODY === 'true') parameters.EnableProsodyAssessment = 'True';
  const response = await fetcher(`https://${env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`, {
    method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', 'Pronunciation-Assessment': Buffer.from(JSON.stringify(parameters)).toString('base64') },
    body: audio, signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('语音服务鉴权失败，请检查服务端密钥与区域。');
    if (response.status === 429) throw new Error('语音服务请求过多或额度不足，请稍后重试。');
    throw new Error('语音评测服务暂时不可用，请稍后重试。');
  }
  return normalizeAssessment(await response.json());
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function assessmentMiddleware(env = process.env) {
  const tts = ttsMiddleware(env);
  // Bound simultaneous paid-service calls for the personal-use first release.
  let inflight = 0;
  return async (req, res, next) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname === '/api/tts') return tts(req, res, next);
    if (!pathname.startsWith('/api/')) return next();
    if (pathname === '/api/health' && req.method === 'GET') return json(res, 200, { configured: configured(env), provider: 'Azure Speech', prosody: env.AZURE_ENABLE_PROSODY === 'true', language: 'en-US' });
    if (pathname !== '/api/assess' || req.method !== 'POST') return json(res, 404, { error: '接口不存在。' });
    const origin = req.headers.origin;
    if (origin) {
      try { if (new URL(origin).host !== req.headers.host) return json(res, 403, { error: '不接受跨站评测请求。' }); }
      catch { return json(res, 403, { error: '请求来源不正确。' }); }
    }
    if (!configured(env)) return json(res, 503, { error: '尚未配置语音评测。录音对比仍可使用，请参阅项目 README 配置 Azure Speech。' });
    if (inflight >= 2) return json(res, 429, { error: '有其他录音正在评测，请稍后重试。' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: '请求格式不正确。' });
    inflight++;
    try {
      let length = 0; const chunks = [];
      for await (const chunk of req) { length += chunk.length; if (length > 1350000) { json(res, 413, { error: '录音过大，请控制在 30 秒以内。' }); return; } chunks.push(chunk); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { error: '请求内容无法解析。' }); }
      if (typeof body.audio !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.audio) || body.audio.length % 4 !== 0 || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) return json(res, 400, { error: '缺少有效录音或参考文本。' });
      const audio = Buffer.from(body.audio, 'base64');
      try { validateWav(audio); } catch (error) { return json(res, 400, { error: error.message }); }
      return json(res, 200, await assess(audio, body.text, env));
    } catch (error) { json(res, 502, { error: error.name === 'TimeoutError' ? '语音评测超时，录音已保留，可以重试。' : error.message || '评测失败，请稍后重试。' }); }
    finally { inflight--; }
  };
}
