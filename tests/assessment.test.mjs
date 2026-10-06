import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { configured, validateWav, normalizeAssessment, assess, assessmentMiddleware } from '../server/assessment.mjs';
function wav(seconds = 1) {
  const data = Buffer.alloc(44 + seconds * 32000);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(16000, 24); data.writeUInt32LE(32000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(data.length - 44, 40);
  return data;
}
const fixture = { RecognitionStatus: 'Success', NBest: [{ Display: 'Small steps.', AccuracyScore: 83.4, FluencyScore: 76, CompletenessScore: 100, PronScore: 85, Words: [{ Word: 'small', AccuracyScore: 68, ErrorType: 'Mispronunciation', Phonemes: [{ Phoneme: 's', AccuracyScore: 63 }] }, { Word: 'steps', AccuracyScore: 98, ErrorType: 'None' }] }] };
test('configuration validates region without exposing keys', () => { assert.equal(configured({}), false); assert.equal(configured({ AZURE_SPEECH_KEY: 'test', AZURE_SPEECH_REGION: '../bad' }), false); assert.equal(configured({ AZURE_SPEECH_KEY: 'test', AZURE_SPEECH_REGION: 'eastasia' }), true); });
test('WAV validation enforces the real sample rate, duration and payload size', () => { assert.equal(validateWav(wav()), 1); assert.throws(() => validateWav(wav(31)), /30 秒/); const bad = wav(); bad.writeUInt32LE(48000, 24); assert.throws(() => validateWav(bad), /16kHz/); assert.throws(() => validateWav(wav().subarray(0, 100)), /30 秒/); });
test('normalization preserves missing prosody rather than inventing a score', () => { const result = normalizeAssessment(fixture); assert.equal(result.accuracy, 83); assert.equal(result.prosody, undefined); assert.equal(result.words[0].phonemes[0].accuracy, 63); assert.equal(result.words[0].error, 'Mispronunciation'); });
test('nested SDK score responses also normalize, and absent scores fail', () => { assert.equal(normalizeAssessment({ RecognitionStatus: 'Success', NBest: [{ PronunciationAssessment: { AccuracyScore: 88, ProsodyScore: 76 } }] }).prosody, 76); assert.throws(() => normalizeAssessment({ RecognitionStatus: 'NoMatch' }), /未识别/); assert.throws(() => normalizeAssessment({ RecognitionStatus: 'Success', NBest: [{}] }), /没有返回/); });
test('proxy sends PCM and reference text only to the configured speech endpoint', async () => {
  let seen;
  const result = await assess(wav(), 'Small steps.', { AZURE_SPEECH_KEY: 'fixture-key', AZURE_SPEECH_REGION: 'eastasia' }, async (url, options) => { seen = { url, options }; return new Response(JSON.stringify(fixture), { headers: { 'Content-Type': 'application/json' } }); });
  assert.match(seen.url, /^https:\/\/eastasia\.stt\.speech\.microsoft\.com\//);
  const parameters = JSON.parse(Buffer.from(seen.options.headers['Pronunciation-Assessment'], 'base64').toString());
  assert.equal(parameters.ReferenceText, 'Small steps.'); assert.equal(parameters.EnableMiscue, 'True'); assert.equal(parameters.EnableProsodyAssessment, undefined); assert.equal(result.accuracy, 83);
});
test('upstream authentication failures return an actionable message without credentials', async () => { await assert.rejects(assess(wav(), 'Hello.', { AZURE_SPEECH_KEY: 'do-not-leak', AZURE_SPEECH_REGION: 'eastasia' }, async () => new Response('', { status: 401 })), /鉴权失败/); });
test('API reports unconfigured state and rejects cross-site or invalid requests', async () => {
  const middleware = assessmentMiddleware({});
  const server = http.createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(url + '/api/health'); assert.equal(health.status, 200); const data = await health.json(); assert.equal(data.configured, false); assert.equal(JSON.stringify(data).includes('KEY'), false);
    assert.equal((await fetch(url + '/api/assess', { method: 'POST' })).status, 503);
    assert.equal((await fetch(url + '/api/assess', { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status, 403);
    assert.equal((await fetch(url + '/api/not-real')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
