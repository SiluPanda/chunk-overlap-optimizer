import { describe, it, expect } from 'vitest';
import { AnalyzerError } from '../errors.js';

describe('AnalyzerError', () => {
  it('extends Error', () => {
    const err = new AnalyzerError('INVALID_CHUNKS', 'bad chunks');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AnalyzerError);
  });

  it('has correct name', () => {
    const err = new AnalyzerError('INVALID_CHUNKS', 'bad chunks');
    expect(err.name).toBe('AnalyzerError');
  });

  it('has correct code', () => {
    const err = new AnalyzerError('INSUFFICIENT_CHUNKS', 'need more');
    expect(err.code).toBe('INSUFFICIENT_CHUNKS');
  });

  it('has correct message', () => {
    const err = new AnalyzerError('INVALID_CHUNKS', 'chunks must be strings');
    expect(err.message).toBe('chunks must be strings');
  });

  it('stores details when provided', () => {
    const err = new AnalyzerError('INVALID_CHUNKS', 'bad', { index: 5 });
    expect(err.details).toEqual({ index: 5 });
  });

  it('details is undefined when not provided', () => {
    const err = new AnalyzerError('INVALID_CHUNKS', 'bad');
    expect(err.details).toBeUndefined();
  });

  it('supports all error codes', () => {
    const codes = [
      'INSUFFICIENT_CHUNKS',
      'INVALID_PERCENTILE',
      'INVALID_WINDOW_SIZE',
      'INVALID_MAX_OVERLAP',
      'EMBED_FN_ERROR',
      'INVALID_CHUNKS',
      'INVALID_SENTENCE_DETECTOR',
    ] as const;

    for (const code of codes) {
      const err = new AnalyzerError(code, `error: ${code}`);
      expect(err.code).toBe(code);
    }
  });
});
