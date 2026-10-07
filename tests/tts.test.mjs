import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ttsMiddleware, validateSpeech } from '../server/tts.mjs';

test('speech validates text and restricts voices', () => {
  assert.throws(() => validateSpeech({ text: 'hello', voice: 'arbitrary' }));
  assert.throws(() => validateSpeech({ text: 'a'.repeat(2001), voice: 'en-US-AriaNeural' }));
  assert.equal(validateSpeech({ text: 'hello', voice: 'en-US-AriaNeural' }).text, 'hello');
});
test('TTS returns audio, rejects cross-site requests and malformed payloads without affecting other routes', async () => {
  let calls = 0;
  const middleware = ttsMiddleware({}, async body => { calls++; assert.equal(body.text, 'Hello.'); return Buffer.from('audio'); });
  const server = http.createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Hello.', voice: 'en-US-AriaNeural' }) };
  try {
    const response = await fetch(url + '/api/tts', options); assert.equal(response.status, 200); assert.equal(await response.text(), 'audio');
    assert.equal((await fetch(url + '/api/tts', { ...options, headers: { ...options.headers, Origin: 'https://unrelated.example' } })).status, 403);
    assert.equal((await fetch(url + '/api/tts', { ...options, body: '{}' })).status, 400);
    assert.equal((await fetch(url + '/other')).status, 404); assert.equal(calls, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
