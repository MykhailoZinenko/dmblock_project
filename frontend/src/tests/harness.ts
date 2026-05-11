/**
 * Arcana Engine — Test Harness
 *
 * A minimal, dependency-free test harness for use as a standalone ES module.
 * Supports synchronous and async test cases.
 *
 * Public API:
 *   describe(name, fn)              — register a test suite
 *   it(name, fn)                    — register a test case (call inside describe)
 *   assert(condition, msg)          — throw if condition is falsy
 *   assertEqual(actual, expected, msg)              — strict equality check
 *   assertApprox(actual, expected, epsilon, msg)    — floating-point proximity check
 *   assertThrows(fn, msg)           — throw if fn does NOT throw
 *   run(outputEl)                   — execute all suites and render results to DOM
 */

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

interface Suite {
  name: string;
  cases: TestCase[];
}

interface TestCaseResult {
  name: string;
  passed: boolean;
  error: Error | null;
}

interface SuiteResult {
  name: string;
  cases: TestCaseResult[];
}

interface TestError {
  suite: string;
  test: string;
  error: Error;
}

export interface RunResults {
  passed: number;
  failed: number;
  errors: TestError[];
}

// ---------------------------------------------------------------------------
// Internal registry
// ---------------------------------------------------------------------------

const suites: Suite[] = [];

/** The suite currently being defined, set while describe() runs its callback. */
let activeSuite: Suite | null = null;

// ---------------------------------------------------------------------------
// Suite / case registration
// ---------------------------------------------------------------------------

/**
 * Register a named test suite. The callback is called immediately to collect
 * `it()` registrations — no async behaviour at registration time.
 */
export function describe(name: string, fn: () => void): void {
  const suite: Suite = { name, cases: [] };
  suites.push(suite);

  const previous = activeSuite;
  activeSuite = suite;
  try {
    fn();
  } finally {
    activeSuite = previous;
  }
}

/**
 * Register a named test case inside the current `describe` block.
 * The function may be async.
 */
export function it(name: string, fn: () => void | Promise<void>): void {
  if (!activeSuite) {
    throw new Error(`it("${name}") called outside of a describe() block`);
  }
  activeSuite.cases.push({ name, fn });
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that `condition` is truthy.
 */
export function assert(condition: unknown, msg?: string): void {
  if (!condition) {
    throw new AssertionError(msg ?? 'Assertion failed');
  }
}

/**
 * Assert strict equality (`===`) between `actual` and `expected`.
 */
export function assertEqual(actual: unknown, expected: unknown, msg?: string): void {
  if (actual !== expected) {
    const detail = `expected ${fmt(expected)}, got ${fmt(actual)}`;
    throw new AssertionError(msg ? `${msg} — ${detail}` : detail);
  }
}

/**
 * Assert that `actual` is within `epsilon` of `expected`.
 */
export function assertApprox(actual: number, expected: number, epsilon: number = 0.0001, msg?: string): void {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    const detail = `|${fmt(actual)} - ${fmt(expected)}| = ${diff} > epsilon ${epsilon}`;
    throw new AssertionError(msg ? `${msg} — ${detail}` : detail);
  }
}

/**
 * Assert that calling `fn` throws any error.
 * Fails if `fn` completes without throwing.
 */
export function assertThrows(fn: () => void, msg?: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new AssertionError(msg ?? 'Expected function to throw, but it did not');
  }
}

// ---------------------------------------------------------------------------
// Custom error type
// ---------------------------------------------------------------------------

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

// ---------------------------------------------------------------------------
// Formatting helper
// ---------------------------------------------------------------------------

/**
 * Return a concise string representation of a value for use in failure messages.
 */
function fmt(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { /* circular */ }
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run all registered suites, render results into `outputEl`.
 *
 * Supports async test functions — the returned Promise resolves when all tests
 * have finished.
 */
export async function run(outputEl?: HTMLElement): Promise<RunResults> {
  const results: RunResults = { passed: 0, failed: 0, errors: [] };

  // Collect suite-level result objects so we can render them incrementally.
  const suiteResults: SuiteResult[] = [];

  for (const suite of suites) {
    const sr: SuiteResult = { name: suite.name, cases: [] };
    suiteResults.push(sr);

    for (const tc of suite.cases) {
      let passed = false;
      let error: Error | null = null;

      try {
        const ret = tc.fn();
        // Support async test functions.
        if (ret instanceof Promise) await ret;
        passed = true;
        results.passed++;
      } catch (err) {
        passed = false;
        error = err as Error;
        results.failed++;
        results.errors.push({ suite: suite.name, test: tc.name, error: err as Error });
      }

      sr.cases.push({ name: tc.name, passed, error });
    }
  }

  if (outputEl) {
    render(outputEl, results, suiteResults);
  }
  return results;
}

// ---------------------------------------------------------------------------
// DOM rendering
// ---------------------------------------------------------------------------

/**
 * Render the collected results into the provided element.
 */
function render(outputEl: HTMLElement, results: RunResults, suiteResults: SuiteResult[]): void {
  const allPass = results.failed === 0;
  const total = results.passed + results.failed;

  outputEl.innerHTML = '';

  // ---- Summary banner ----
  const banner = document.createElement('div');
  banner.className = 'summary';
  banner.style.cssText = [
    'padding: 12px 16px',
    'margin-bottom: 24px',
    'border-radius: 4px',
    'font-size: 15px',
    'font-weight: bold',
    `background: ${allPass ? '#0d2b12' : '#2b0d0d'}`,
    `color: ${allPass ? '#4ade80' : '#f87171'}`,
    `border: 1px solid ${allPass ? '#166534' : '#991b1b'}`,
  ].join('; ');

  banner.textContent = allPass
    ? `All ${total} test${total !== 1 ? 's' : ''} passed`
    : `${results.failed} of ${total} test${total !== 1 ? 's' : ''} failed`;

  outputEl.appendChild(banner);

  // ---- Suite sections ----
  for (const sr of suiteResults) {
    const section = document.createElement('section');
    section.style.cssText = 'margin-bottom: 20px';

    const heading = document.createElement('h2');
    heading.style.cssText = [
      'font-size: 13px',
      'font-weight: 600',
      'text-transform: uppercase',
      'letter-spacing: 0.08em',
      'color: #94a3b8',
      'margin-bottom: 8px',
      'padding-bottom: 4px',
      'border-bottom: 1px solid #1e293b',
    ].join('; ');
    heading.textContent = sr.name;
    section.appendChild(heading);

    const list = document.createElement('ul');
    list.style.cssText = 'list-style: none; padding: 0; margin: 0';

    for (const tc of sr.cases) {
      const item = document.createElement('li');
      item.style.cssText = [
        'display: flex',
        'flex-direction: column',
        'gap: 4px',
        'padding: 6px 8px',
        'border-radius: 3px',
        'margin-bottom: 4px',
        `background: ${tc.passed ? 'transparent' : '#1a0808'}`,
      ].join('; ');

      const label = document.createElement('span');
      label.style.cssText = `color: ${tc.passed ? '#4ade80' : '#f87171'}; font-size: 13px`;
      label.textContent = `${tc.passed ? '✓' : '✗'} ${tc.name}`;
      item.appendChild(label);

      if (!tc.passed && tc.error) {
        const detail = document.createElement('span');
        detail.style.cssText = [
          'color: #fca5a5',
          'font-size: 12px',
          'padding-left: 18px',
          'white-space: pre-wrap',
          'word-break: break-word',
        ].join('; ');
        detail.textContent = tc.error.message ?? String(tc.error);
        item.appendChild(detail);
      }

      list.appendChild(item);
    }

    section.appendChild(list);
    outputEl.appendChild(section);
  }
}
