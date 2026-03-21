import { describe, it, expect } from 'vitest';
import { resolveOptions, mergeOptions } from '../defaults.js';

describe('resolveOptions', () => {
  it('applies all defaults when no options provided', () => {
    const opts = resolveOptions();
    expect(opts.sizeUnit).toBe('tokens');
    expect(typeof opts.tokenCounter).toBe('function');
    expect(opts.windowSize).toBe(128);
    expect(opts.targetPercentile).toBe(90);
    expect(opts.maxOverlap).toBe(200);
    expect(opts.problemBoundaryCount).toBe(5);
    expect(opts.abbreviations).toEqual([]);
    expect(opts.adjustForSemantics).toBe(false); // no embedFn
    expect(opts.semanticBoostThreshold).toBe(0.80);
    expect(opts.semanticBoostFactor).toBe(1.3);
    expect(opts.concurrency).toBe(8);
    expect(opts.embedFn).toBeUndefined();
    expect(opts.sentenceDetector).toBeUndefined();
    expect(opts.currentOverlap).toBeUndefined();
  });

  it('adjustForSemantics defaults to true when embedFn provided', () => {
    const opts = resolveOptions({ embedFn: async () => [1, 2, 3] });
    expect(opts.adjustForSemantics).toBe(true);
  });

  it('respects explicit option values', () => {
    const opts = resolveOptions({
      sizeUnit: 'chars',
      windowSize: 64,
      targetPercentile: 75,
      maxOverlap: 100,
      problemBoundaryCount: 3,
    });
    expect(opts.sizeUnit).toBe('chars');
    expect(opts.windowSize).toBe(64);
    expect(opts.targetPercentile).toBe(75);
    expect(opts.maxOverlap).toBe(100);
    expect(opts.problemBoundaryCount).toBe(3);
  });
});

describe('mergeOptions', () => {
  it('returns base when no overrides', () => {
    const base = resolveOptions();
    const merged = mergeOptions(base);
    expect(merged.windowSize).toBe(128);
  });

  it('overrides specific fields', () => {
    const base = resolveOptions();
    const merged = mergeOptions(base, { windowSize: 32 });
    expect(merged.windowSize).toBe(32);
    expect(merged.sizeUnit).toBe('tokens'); // unchanged
  });
});
