export function benchmark(name, fn, iterations = 100_000) {
  return { name, fn, iterations, type: 'cpu' };
}

export function gpuBenchmark(name, setupFn, options = {}) {
  return { name, setupFn, type: 'gpu', duration: options.duration || 5 };
}

export function stressBenchmark(name, setupFn, options = {}) {
  return { name, setupFn, type: 'stress', frames: options.frames || 200 };
}

const registry = [];

export function register(bench) {
  registry.push(bench);
}

export function registerAll(benches) {
  for (const b of benches) registry.push(b);
}

function runCpuBench(bench) {
  const { fn, iterations } = bench;

  for (let i = 0; i < Math.min(10_000, iterations); i++) fn();

  const samples = [];
  const runs = 30;

  for (let r = 0; r < runs; r++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    samples.push((performance.now() - start) / iterations);
  }

  samples.sort((a, b) => a - b);
  return computeStats(bench.name, samples, iterations);
}

async function runGpuBench(bench) {
  const { setupFn, duration } = bench;
  const { engine, tick, cleanup } = await setupFn();

  for (let i = 0; i < 60; i++) {
    tick();
    await new Promise(r => requestAnimationFrame(r));
  }

  const frameTimes = [];
  const startTime = performance.now();

  while (performance.now() - startTime < duration * 1000) {
    const frameStart = performance.now();
    tick();
    await new Promise(r => requestAnimationFrame(r));
    frameTimes.push(performance.now() - frameStart);
  }

  if (cleanup) cleanup();
  engine.destroy();

  frameTimes.sort((a, b) => a - b);
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const median = frameTimes[Math.floor(frameTimes.length / 2)];
  const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
  const p99 = frameTimes[Math.floor(frameTimes.length * 0.99)];

  return {
    name: bench.name,
    type: 'gpu',
    frames: frameTimes.length,
    avgMs: avg.toFixed(3),
    medianMs: median.toFixed(3),
    p95Ms: p95.toFixed(3),
    p99Ms: p99.toFixed(3),
    minMs: frameTimes[0].toFixed(3),
    maxMs: frameTimes[frameTimes.length - 1].toFixed(3),
    fps: (1000 / avg).toFixed(1),
  };
}

async function runStressBench(bench) {
  const { setupFn, frames } = bench;
  const { engine, tick, tickCpuOnly, cleanup, spriteCount } = await setupFn();
  const device = engine.renderer._device;

  // Warmup with sync
  for (let i = 0; i < 10; i++) tick();
  await device.queue.onSubmittedWorkDone();

  // --- Mode 1: CPU encode only (no submit) ---
  let cpuEncodeAvg = null;
  if (tickCpuOnly) {
    const times = [];
    for (let i = 0; i < frames; i++) {
      const s = performance.now();
      tickCpuOnly();
      times.push(performance.now() - s);
    }
    times.sort((a, b) => a - b);
    cpuEncodeAvg = times.reduce((a, b) => a + b, 0) / times.length;
  }

  // --- Mode 2: CPU + submit (no sync, measures submission throughput) ---
  const submitTimes = [];
  for (let i = 0; i < frames; i++) {
    const s = performance.now();
    tick();
    submitTimes.push(performance.now() - s);
  }
  await device.queue.onSubmittedWorkDone();
  submitTimes.sort((a, b) => a - b);
  const submitAvg = submitTimes.reduce((a, b) => a + b, 0) / submitTimes.length;

  // --- Mode 3: Sustained GPU (sync every 16 frames) ---
  const sustainedTimes = [];
  for (let i = 0; i < frames; i++) {
    const s = performance.now();
    tick();
    if ((i & 15) === 0) await device.queue.onSubmittedWorkDone();
    sustainedTimes.push(performance.now() - s);
  }
  await device.queue.onSubmittedWorkDone();
  sustainedTimes.sort((a, b) => a - b);
  const sustainedAvg = sustainedTimes.reduce((a, b) => a + b, 0) / sustainedTimes.length;
  const sustainedP95 = sustainedTimes[Math.floor(sustainedTimes.length * 0.95)];
  const sustainedP99 = sustainedTimes[Math.floor(sustainedTimes.length * 0.99)];

  if (cleanup) cleanup();
  engine.destroy();

  return {
    name: bench.name,
    type: 'stress',
    frames,
    spriteCount: spriteCount || '?',
    cpuEncodeFps: cpuEncodeAvg ? (1000 / cpuEncodeAvg).toFixed(0) : 'n/a',
    cpuSubmitFps: (1000 / submitAvg).toFixed(0),
    sustainedFps: (1000 / sustainedAvg).toFixed(0),
    sustainedAvgMs: sustainedAvg.toFixed(3),
    sustainedP95Ms: sustainedP95.toFixed(3),
    sustainedP99Ms: sustainedP99.toFixed(3),
    sustainedMaxMs: sustainedTimes[sustainedTimes.length - 1].toFixed(3),
  };
}

function computeStats(name, samples, iterations) {
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const median = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const p99 = samples[Math.floor(samples.length * 0.99)];

  return {
    name,
    type: 'cpu',
    iterations,
    avgMs: avg.toFixed(6),
    medianMs: median.toFixed(6),
    p95Ms: p95.toFixed(6),
    p99Ms: p99.toFixed(6),
    minMs: samples[0].toFixed(6),
    maxMs: samples[samples.length - 1].toFixed(6),
    opsPerSec: Math.round(1000 / avg).toLocaleString(),
  };
}

export async function runAll(outputEl) {
  const results = [];
  let currentSection = '';

  const header = document.createElement('div');
  header.style.cssText = 'display: grid; grid-template-columns: 280px repeat(6, 1fr); gap: 8px; padding: 6px 8px; font-size: 12px; color: #64748b; border-bottom: 2px solid #1e293b; text-transform: uppercase; letter-spacing: 0.05em;';
  header.innerHTML = '<span>Benchmark</span><span>Throughput</span><span>Avg</span><span>Median</span><span>P95</span><span>P99</span><span>Info</span>';
  outputEl.appendChild(header);

  for (const bench of registry) {
    const sectionMatch = bench.name.match(/^\[(.+?)\]/);
    const section = sectionMatch ? sectionMatch[1] : 'Other';

    if (section !== currentSection) {
      currentSection = section;
      const h = document.createElement('h2');
      h.textContent = section;
      h.style.cssText = 'color: #94a3b8; font-size: 14px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.08em;';
      outputEl.appendChild(h);

      if (bench.type === 'stress') {
        const subHeader = document.createElement('div');
        subHeader.style.cssText = 'display: grid; grid-template-columns: 240px repeat(7, 1fr); gap: 8px; padding: 4px 8px; font-size: 11px; color: #475569; border-bottom: 1px solid #1e293b; text-transform: uppercase;';
        subHeader.innerHTML = '<span>Test</span><span>CPU Encode</span><span>CPU+Submit</span><span>Sustained GPU</span><span>Avg</span><span>P95</span><span>P99</span><span>Objects</span>';
        outputEl.appendChild(subHeader);
      }
    }

    const status = document.createElement('div');
    status.textContent = `Running: ${bench.name}...`;
    status.style.color = '#64748b';
    outputEl.appendChild(status);
    await new Promise(r => setTimeout(r, 0));

    let result;
    if (bench.type === 'gpu') result = await runGpuBench(bench);
    else if (bench.type === 'stress') result = await runStressBench(bench);
    else result = runCpuBench(bench);
    results.push(result);
    status.remove();
    outputEl.appendChild(renderResult(result));
  }

  outputEl.appendChild(renderSummary(results));
  return results;
}

function renderResult(r) {
  const row = document.createElement('div');
  row.style.cssText = 'display: grid; grid-template-columns: 280px repeat(6, 1fr); gap: 8px; padding: 6px 8px; font-size: 13px; border-bottom: 1px solid #1e293b;';

  const name = r.name.replace(/^\[.+?\]\s*/, '');
  if (r.type === 'stress') {
    const sustained = parseFloat(r.sustainedFps);
    const color = sustained >= 60 ? '#4ade80' : sustained >= 30 ? '#facc15' : '#f87171';
    row.style.gridTemplateColumns = '240px repeat(7, 1fr)';
    row.innerHTML = `
      <span style="color:#e0ddd4">${name}</span>
      <span style="color:#94a3b8">${r.cpuEncodeFps} fps</span>
      <span style="color:#94a3b8">${r.cpuSubmitFps} fps</span>
      <span style="color:${color};font-weight:bold">${r.sustainedFps} fps</span>
      <span>${r.sustainedAvgMs} ms</span>
      <span>${r.sustainedP95Ms} ms</span>
      <span>${r.sustainedP99Ms} ms</span>
      <span style="color:#64748b">${r.spriteCount}</span>`;
  } else if (r.type === 'gpu') {
    const fpsColor = parseFloat(r.fps) >= 59 ? '#4ade80' : parseFloat(r.fps) >= 30 ? '#facc15' : '#f87171';
    const p99Color = parseFloat(r.p99Ms) > 16.67 ? '#f87171' : '#94a3b8';
    row.innerHTML = `
      <span style="color:#e0ddd4">${name}</span>
      <span style="color:${fpsColor}">${r.fps} fps</span>
      <span>${r.avgMs} ms</span>
      <span>${r.medianMs} ms</span>
      <span style="color:${p99Color}">${r.p95Ms} ms</span>
      <span style="color:${p99Color}">${r.p99Ms} ms</span>
      <span style="color:#64748b">${r.frames}f / ${r.maxMs}ms worst</span>`;
  } else {
    row.innerHTML = `
      <span style="color:#e0ddd4">${name}</span>
      <span style="color:#4ade80">${r.opsPerSec} ops/s</span>
      <span>${r.avgMs} ms</span>
      <span>${r.medianMs} ms</span>
      <span>${r.p95Ms} ms</span>
      <span>${r.p99Ms} ms</span>
      <span style="color:#64748b">${r.iterations.toLocaleString()} × 30 runs</span>`;
  }
  return row;
}

function renderSummary(results) {
  const div = document.createElement('div');
  div.style.cssText = 'margin-top: 24px; padding: 12px 16px; background: #111122; border-radius: 4px; border: 1px solid #1e293b;';

  const gpu = results.filter(r => r.type === 'gpu');
  const cpu = results.filter(r => r.type === 'cpu');

  let html = `<h3 style="color:#c4b5fd; margin-bottom: 8px;">Summary</h3>`;
  html += `<div style="color:#94a3b8; font-size: 13px;">CPU: ${cpu.length} benchmarks | GPU: ${gpu.length} benchmarks</div>`;

  if (gpu.length > 0) {
    const worstP99 = Math.max(...gpu.map(r => parseFloat(r.p99Ms)));
    const worstMax = Math.max(...gpu.map(r => parseFloat(r.maxMs)));
    const p99Color = worstP99 > 16.67 ? '#f87171' : '#4ade80';
    html += `<div style="color:${p99Color}; font-size: 13px; margin-top: 4px;">Worst p99: ${worstP99.toFixed(2)}ms | Worst frame: ${worstMax.toFixed(2)}ms</div>`;
  }

  div.innerHTML = html;
  return div;
}

export { registry };
