export class AssetLoader {
  constructor(textureManager) {
    this._textureManager = textureManager;
    this._queue = [];
    this._onProgressCbs = [];
    this._onCompleteCbs = [];
    this._concurrency = 6;
  }

  add(keyOrObj, url) {
    if (typeof keyOrObj === 'object') {
      this._queue.push({ key: keyOrObj.key, url: keyOrObj.url, type: keyOrObj.type || 'image' });
    } else {
      this._queue.push({ key: keyOrObj, url, type: 'image' });
    }
    return this;
  }

  onProgress(fn) {
    this._onProgressCbs.push(fn);
    return this;
  }

  onComplete(fn) {
    this._onCompleteCbs.push(fn);
    return this;
  }

  async load() {
    const items = this._queue.splice(0);
    const total = items.length;
    if (total === 0) return;

    let loaded = 0;
    const results = new Map();

    const execute = async (item) => {
      let result;
      switch (item.type) {
        case 'image':
          result = await this._textureManager.load(item.key, item.url);
          break;
        case 'json':
          result = await fetch(item.url).then(r => r.json());
          break;
        case 'binary':
          result = await fetch(item.url).then(r => r.arrayBuffer());
          break;
        default:
          result = await this._textureManager.load(item.key, item.url);
      }
      results.set(item.key, result);
      loaded++;
      const progress = loaded / total;
      for (const cb of this._onProgressCbs) cb(progress, item.key);
    };

    // Process with concurrency limit
    const pending = items.slice();
    const active = [];

    while (pending.length > 0 || active.length > 0) {
      while (active.length < this._concurrency && pending.length > 0) {
        const item = pending.shift();
        const promise = execute(item).then(() => {
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
