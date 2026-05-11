import type { TextureManager } from '../textures/TextureManager.js';
import type { Texture } from '../textures/Texture.js';

export type AssetType = 'image' | 'json' | 'binary';

export interface AssetDescriptor {
  key: string;
  url: string;
  type?: AssetType;
}

export type ProgressCallback = (progress: number, key: string) => void;
export type CompleteCallback = (results: Map<string, AssetResult>) => void;

export type AssetResult = Texture | unknown | ArrayBuffer;

interface QueueItem {
  key: string;
  url: string;
  type: AssetType;
}

export class AssetLoader {
  private _textureManager: TextureManager;
  private _queue: QueueItem[];
  private _onProgressCbs: ProgressCallback[];
  private _onCompleteCbs: CompleteCallback[];
  private _concurrency: number;

  constructor(textureManager: TextureManager) {
    this._textureManager = textureManager;
    this._queue = [];
    this._onProgressCbs = [];
    this._onCompleteCbs = [];
    this._concurrency = 6;
  }

  add(keyOrObj: string | AssetDescriptor, url?: string): this {
    if (typeof keyOrObj === 'object') {
      this._queue.push({ key: keyOrObj.key, url: keyOrObj.url, type: keyOrObj.type || 'image' });
    } else {
      this._queue.push({ key: keyOrObj, url: url!, type: 'image' });
    }
    return this;
  }

  onProgress(fn: ProgressCallback): this {
    this._onProgressCbs.push(fn);
    return this;
  }

  onComplete(fn: CompleteCallback): this {
    this._onCompleteCbs.push(fn);
    return this;
  }

  async load(): Promise<Map<string, AssetResult> | undefined> {
    const items: QueueItem[] = this._queue.splice(0);
    const total: number = items.length;
    if (total === 0) return;

    let loaded: number = 0;
    const results: Map<string, AssetResult> = new Map();

    const execute = async (item: QueueItem): Promise<void> => {
      let result: AssetResult;
      switch (item.type) {
        case 'image':
          result = await this._textureManager.load(item.key, item.url);
          break;
        case 'json':
          result = await fetch(item.url).then((r: Response) => r.json());
          break;
        case 'binary':
          result = await fetch(item.url).then((r: Response) => r.arrayBuffer());
          break;
        default:
          result = await this._textureManager.load(item.key, item.url);
      }
      results.set(item.key, result);
      loaded++;
      const progress: number = loaded / total;
      for (const cb of this._onProgressCbs) cb(progress, item.key);
    };

    // Process with concurrency limit
    const pending: QueueItem[] = items.slice();
    const active: Promise<void>[] = [];

    while (pending.length > 0 || active.length > 0) {
      while (active.length < this._concurrency && pending.length > 0) {
        const item: QueueItem = pending.shift()!;
        const promise: Promise<void> = execute(item).then(() => {
          active.splice(active.indexOf(promise), 1);
        });
        active.push(promise);
      }
      if (active.length > 0) await Promise.race(active);
    }

    for (const cb of this._onCompleteCbs) cb(results);
    return results;
  }
}
