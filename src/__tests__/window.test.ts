import { describe, it, expect } from 'vitest';
import { extractTailWindow, extractHeadWindow } from '../window.js';
import { defaultTokenCounter } from '../token-counter.js';

describe('extractTailWindow', () => {
  describe('with chars unit', () => {
    it('returns entire chunk when shorter than windowSize', () => {
      expect(extractTailWindow('hello', 10, 'chars', defaultTokenCounter)).toBe('hello');
    });

    it('returns entire chunk when equal to windowSize', () => {
      expect(extractTailWindow('hello', 5, 'chars', defaultTokenCounter)).toBe('hello');
    });

    it('returns last windowSize chars when chunk is longer', () => {
      expect(extractTailWindow('hello world', 5, 'chars', defaultTokenCounter)).toBe('world');
    });

    it('handles empty string', () => {
      expect(extractTailWindow('', 10, 'chars', defaultTokenCounter)).toBe('');
    });
  });

  describe('with tokens unit', () => {
    it('returns entire chunk when shorter than windowSize tokens', () => {
      // "hello" = 5 chars = ~2 tokens
      expect(extractTailWindow('hello', 10, 'tokens', defaultTokenCounter)).toBe('hello');
    });

    it('returns a substring for long text', () => {
      const text = 'a'.repeat(100); // 25 tokens
      const result = extractTailWindow(text, 5, 'tokens', defaultTokenCounter);
      expect(defaultTokenCounter(result)).toBeLessThanOrEqual(5);
      // The result should be a suffix of the original
      expect(text.endsWith(result)).toBe(true);
    });

    it('uses custom token counter', () => {
      const wordCounter = (t: string) => t.split(/\s+/).filter(Boolean).length;
      const text = 'one two three four five six seven';
      const result = extractTailWindow(text, 3, 'tokens', wordCounter);
      expect(wordCounter(result)).toBeLessThanOrEqual(3);
    });
  });
});

describe('extractHeadWindow', () => {
  describe('with chars unit', () => {
    it('returns entire chunk when shorter than windowSize', () => {
      expect(extractHeadWindow('hello', 10, 'chars', defaultTokenCounter)).toBe('hello');
    });

    it('returns entire chunk when equal to windowSize', () => {
      expect(extractHeadWindow('hello', 5, 'chars', defaultTokenCounter)).toBe('hello');
    });

    it('returns first windowSize chars when chunk is longer', () => {
      expect(extractHeadWindow('hello world', 5, 'chars', defaultTokenCounter)).toBe('hello');
    });

    it('handles empty string', () => {
      expect(extractHeadWindow('', 10, 'chars', defaultTokenCounter)).toBe('');
    });
  });

  describe('with tokens unit', () => {
    it('returns entire chunk when shorter than windowSize tokens', () => {
      expect(extractHeadWindow('hello', 10, 'tokens', defaultTokenCounter)).toBe('hello');
    });

    it('returns a prefix for long text', () => {
      const text = 'a'.repeat(100); // 25 tokens
      const result = extractHeadWindow(text, 5, 'tokens', defaultTokenCounter);
      expect(defaultTokenCounter(result)).toBeLessThanOrEqual(5);
      expect(text.startsWith(result)).toBe(true);
    });

    it('uses custom token counter', () => {
      const wordCounter = (t: string) => t.split(/\s+/).filter(Boolean).length;
      const text = 'one two three four five six seven';
      const result = extractHeadWindow(text, 3, 'tokens', wordCounter);
      expect(wordCounter(result)).toBeLessThanOrEqual(3);
    });
  });

  it('extracted window is a substring of the original', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const head = extractHeadWindow(text, 3, 'tokens', defaultTokenCounter);
    expect(text.includes(head)).toBe(true);
    expect(text.startsWith(head)).toBe(true);

    const tail = extractTailWindow(text, 3, 'tokens', defaultTokenCounter);
    expect(text.includes(tail)).toBe(true);
    expect(text.endsWith(tail)).toBe(true);
  });
});
