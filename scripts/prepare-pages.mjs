import { mkdir, copyFile, writeFile } from 'node:fs/promises';
await mkdir('dist/client/practice', { recursive: true });
await copyFile('dist/client/index.html', 'dist/client/practice/index.html');
await writeFile('dist/client/.nojekyll', '');
