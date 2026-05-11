import { describe, it, assert, assertEqual } from '../harness.js';
import { AssetLoader } from '../../src/engine/assets/AssetLoader.js';

function mockTextureManager() {
  const loaded = new Map();
  return {
    load: async (key, url) => {
      const tex = { key, url, type: 'texture' };
      loaded.set(key, tex);
      return tex;
    },
    loaded,
  };
}

describe('AssetLoader', () => {
  it('add() queues items', () => {
    const loader = new AssetLoader(mockTextureManager());
    loader.add('a', '/a.png');
    loader.add('b', '/b.png');
    assertEqual(loader._queue.length, 2);
  });

  it('add() accepts object form', () => {
    const loader = new AssetLoader(mockTextureManager());
    loader.add({ key: 'test', url: '/test.png', type: 'image' });
    assertEqual(loader._queue[0].key, 'test');
    assertEqual(loader._queue[0].type, 'image');
  });

  it('add() is chainable', () => {
    const loader = new AssetLoader(mockTextureManager());
    const result = loader.add('a', '/a.png').add('b', '/b.png');
    assert(result === loader);
  });

  it('load() processes all queued items', async () => {
    const tm = mockTextureManager();
    const loader = new AssetLoader(tm);
    loader.add('a', '/a.png');
    loader.add('b', '/b.png');
    await loader.load();
    assert(tm.loaded.has('a'));
    assert(tm.loaded.has('b'));
  });

  it('load() clears queue after processing', async () => {
    const loader = new AssetLoader(mockTextureManager());
    loader.add('a', '/a.png');
    await loader.load();
    assertEqual(loader._queue.length, 0);
  });

  it('onProgress fires with progress 0-1', async () => {
    const loader = new AssetLoader(mockTextureManager());
    loader.add('a', '/a.png');
    loader.add('b', '/b.png');
    const progressValues = [];
    loader.onProgress((p) => progressValues.push(p));
    await loader.load();
    assertEqual(progressValues.length, 2);
    assert(progressValues[progressValues.length - 1] === 1);
  });

  it('onComplete fires after load', async () => {
    const loader = new AssetLoader(mockTextureManager());
    loader.add('a', '/a.png');
    let completed = false;
    loader.onComplete(() => { completed = true; });
    await loader.load();
    assert(completed);
  });

  it('onProgress is chainable', () => {
    const loader = new AssetLoader(mockTextureManager());
    const result = loader.onProgress(() => {});
    assert(result === loader);
  });

  it('load with empty queue does nothing', async () => {
    const loader = new AssetLoader(mockTextureManager());
    await loader.load();
  });
});
