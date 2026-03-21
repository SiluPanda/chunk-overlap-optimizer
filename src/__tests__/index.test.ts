import { describe, it, expect } from 'vitest';
import {
  analyze,
  analyzeBoundary,
  recommend,
  createAnalyzer,
  AnalyzerError,
} from '../index.js';

describe('public API exports', () => {
  it('exports analyze function', () => {
    expect(typeof analyze).toBe('function');
  });

  it('exports analyzeBoundary function', () => {
    expect(typeof analyzeBoundary).toBe('function');
  });

  it('exports recommend function', () => {
    expect(typeof recommend).toBe('function');
  });

  it('exports createAnalyzer function', () => {
    expect(typeof createAnalyzer).toBe('function');
  });

  it('exports AnalyzerError class', () => {
    const err = new AnalyzerError('INVALID_CHUNKS', 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('INVALID_CHUNKS');
  });

  it('end-to-end: analyze two chunks', async () => {
    const result = await analyze([
      'First sentence here.',
      'Second sentence here.',
    ]);
    expect(result.boundaryCount).toBe(1);
    expect(result.boundaries.length).toBe(1);
  });

  it('end-to-end: recommend for small corpus', async () => {
    const result = await recommend([
      'The quick brown fox jumps over the lazy dog.',
      'A second sentence follows the first one.',
      'The third chunk contains additional text.',
    ]);
    expect(typeof result.recommended).toBe('number');
    expect(result.chunkCount).toBe(3);
    expect(result.boundaryCount).toBe(2);
    expect(result.histogram.length).toBe(7);
  });

  it('end-to-end: createAnalyzer and use', async () => {
    const analyzer = createAnalyzer({ windowSize: 64 });
    const result = await analyzer.recommend([
      'Chunk one ends cleanly.',
      'Chunk two also ends cleanly.',
    ]);
    expect(result.recommended).toBeDefined();
  });
});
