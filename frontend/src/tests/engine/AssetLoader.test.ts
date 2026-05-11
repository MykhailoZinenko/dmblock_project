import { describe, it, assert, assertEqual } from '../harness.js';
import { AssetLoader } from '../../engine/assets/AssetLoader.js';

interface MockTexture {
  key: string;
  url: string;
  type: string;
}

function mockTextureManager(): { load: (key: string, url: string) => Promise<MockTexture>; loaded: Map<string, MockTexture> } {
  const loaded = new Map<string, MockTexture>();
  return {
    load: async (key: string, url: string) => {
      const tex: MockTexture = { key, url, type: 'texture' };
      loaded.set(key, tex);
      return tex;
    },
    loaded,
  };
}

describe('AssetLoader', () => {
  it('add() queues items', () => {
    const loader = new AssetLoader(mockTextureManager() as never);
    loader.add('a', '/a.png');
    loader.add('b', '/b.png');
    assertEqual((loader as any)._queue.length, 2);
  });

  it('add() accepts object form', () => {
    const loader = new AssetLoader(mockTextureManager() as never);
    loader.add({ key: 'test', url: '/test.png', type: 'image' });
    assertEqual((loader as any)._queue[0].key, 'test');
    assertEqual((loader as any)._queue[0].type, 'image');
  });

  it('add() is chainable', () => {
    const loader = new AssetLoader(mockTextureManager() as never);
    const result = loader.add('a', '/a.png').add('b', '/b.png');
    assert(result === loader);
  });

  it('load() processes all queued items', async () => {
    const tm = mockTextureManager();
    const loader = new AssetLoader(tm as never);
    loader.add('a', '/a.png');
    loader.add('b', '/b.png');
    await loader.load();
    assert(tm.loaded.has('a'));
    assert(tm.loaded.has('b'));
  });

  it('load() clears queue after processing', async () => {
    const loader = new AssetLoader(mockTextureManager() as never);
    loader.add('a', '/a.png');
    await loader.load();
    assertEqual((loader as any)._queue.length, 0);
  });

  it('onProgress fires with progress 0-1', async () => {
    const loader = new AssetLoader(mockTextureManager() as never);
    loader.add('a', '/a.png');
    loader.add('b', '/b.png');
    const progressValues: number[] = [];
    loader.onProgress((p: number) => progressValues.push(p));
    await loader.load();
    assertEqual(progressValues.length, 2);
    assert(progressValues[progressValues.length - 1] === 1);
  });

  it('onComplete fires after load', async () => {
    const loader = new AssetLoader(mockTextureManager() as never);
    loader.add('a', '/a.png');
    let completed = false;
    loader.onComplete(() => { completed = true; });
    await loader.load();
    assert(completed);
  });

  it('onProgress is chainable', () => {
    const loader = new AssetLoader(mockTextureManager() as never);
    const result = loader.onProgress(() => {});
    assert(result === loader);
  });

  it('load with empty queue does nothing', async () => {
    const loader = new AssetLoader(mockTextureManager() as never);
    await loader.load();
  });
});
