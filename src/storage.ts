import type { Attempt, Lesson, ReviewItem } from './types';

let connection: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('echo-shadowing', 1);
    request.onupgradeneeded = () => {
      for (const name of ['lessons', 'attempts', 'reviews']) request.result.createObjectStore(name, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(request.error); };
  });
  return connection;
}

export async function list<T>(store: 'lessons' | 'attempts' | 'reviews'): Promise<T[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function save(store: 'lessons' | 'attempts' | 'reviews', value: Lesson | Attempt | ReviewItem): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function remove(store: 'attempts' | 'reviews', id: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function storageMessage(): string { return '浏览器未能保存数据（可能空间不足或禁用了存储）。本次仍可练习，请下载录音以免丢失。'; }

// Commit the media, subtitles and all associated practice data together.
export async function purgeLesson(id: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['lessons', 'attempts', 'reviews'], 'readwrite');
    const lookup = tx.objectStore('lessons').get(id);
    lookup.onsuccess = () => {
      if (!lookup.result?.deletedAt || lookup.result.demo) {
        reject(new Error('素材已恢复或不在回收站，请刷新后重试。'));
        tx.abort(); return;
      }
      tx.objectStore('lessons').delete(id);
      for (const name of ['attempts', 'reviews']) {
        const request = tx.objectStore(name).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (cursor.value.lessonId === id) cursor.delete();
          cursor.continue();
        };
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
