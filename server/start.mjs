import http from 'node:http';
import { loadEnvFile } from 'node:process';
import { stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { assessmentMiddleware } from './assessment.mjs';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const root = resolve('dist/client');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.srt': 'text/plain; charset=utf-8' };
const api = assessmentMiddleware();
const server = http.createServer((req, res) => api(req, res, async () => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const content = await readFile(file);
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]), end = Math.min(Number(range[2] || content.length - 1), content.length - 1);
      if (start > end || start >= content.length) { res.writeHead(416, { 'Content-Range': `bytes */${content.length}` }); res.end(); return; }
      res.writeHead(206, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${content.length}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' });
      res.end(req.method === 'HEAD' ? undefined : content.subarray(start, end + 1));
    } else {
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': content.length, 'Accept-Ranges': 'bytes' }); res.end(req.method === 'HEAD' ? undefined : content);
    }
  } catch { res.writeHead(404); res.end('Not found'); }
}));
const port = Number(process.env.PORT || 4173);
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Echo ready at http://localhost:${port}`));
