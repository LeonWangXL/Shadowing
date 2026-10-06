// Seek completion is asynchronous, particularly for compressed audio/video.
export function seekMedia(media: HTMLMediaElement, position: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timer); media.removeEventListener('seeked', done); media.removeEventListener('error', failed); signal?.removeEventListener('abort', aborted); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('素材定位失败，请检查文件编码。')); };
    const aborted = () => { cleanup(); reject(new DOMException('Seek cancelled', 'AbortError')); };
    if (signal?.aborted) { aborted(); return; }
    media.pause();
    if (!media.seeking && Math.abs(media.currentTime - position) < 0.001) { resolve(); return; }
    media.addEventListener('seeked', done); media.addEventListener('error', failed);
    signal?.addEventListener('abort', aborted, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error('素材定位超时，请稍后重试。')); }, 10000);
    try { media.currentTime = position; }
    catch { failed(); return; }
    // Some browsers complete an already buffered seek synchronously.
    if (!media.seeking && Math.abs(media.currentTime - position) < 0.001) done();
  });
}
