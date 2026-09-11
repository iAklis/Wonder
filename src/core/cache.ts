export interface CacheEntry { originalText: string; translatedText: string; detectedLanguage: string; key: string }
const DB_NAME = 'wonder';
function result<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve,reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error); });
}
export class TranslationCache {
  private database?: Promise<IDBDatabase>;
  constructor(private factory: IDBFactory = indexedDB) {}
  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      const req = this.factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('translations', {keyPath:'key'});
      this.database = result(req).then(db => { db.onversionchange = () => { db.close(); this.database = undefined; }; return db; }).catch(e => { this.database = undefined; throw e; });
    }
    return this.database;
  }
  async get(service: string, source: string, target: string, original: string): Promise<CacheEntry | undefined> {
    try {
      const db = await this.open();
      return await result(db.transaction('translations').objectStore('translations').get(JSON.stringify([service,source,target,original])));
    } catch { return undefined; } // Cache availability must not prevent translation.
  }
  async set(service: string, source: string, target: string, original: string, translated: string, detected: string): Promise<boolean> {
    try {
      const db = await this.open(); const tx = db.transaction('translations','readwrite');
      const done = complete(tx);
      tx.objectStore('translations').put({key:JSON.stringify([service,source,target,original]), originalText:original, translatedText:translated, detectedLanguage:detected});
      await done; return true;
    } catch { return false; }
  }
  async clear(): Promise<void> {
    const db = await this.open(); const tx = db.transaction('translations','readwrite');
    const done = complete(tx); tx.objectStore('translations').clear(); await done;
  }
  async size(): Promise<string> {
    const db = await this.open(); const req = db.transaction('translations').objectStore('translations').openCursor();
    let bytes = 0;
    await new Promise<void>((resolve,reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { const cursor = req.result; if (!cursor) return resolve(); bytes += new TextEncoder().encode(JSON.stringify(cursor.value)).byteLength; cursor.continue(); };
    });
    if (bytes < 1024) return `${bytes} B`;
    const unit = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),3);
    return `${(bytes/1024**unit).toFixed(1)} ${['B','KB','MB','GB'][unit]}`;
  }
  async close(): Promise<void> { if (this.database) (await this.database).close(); this.database = undefined; }
}
