import { describe, it, expect } from 'vitest';
import { cosineSimilarity, embedTextsWithDedup } from '../semantic.js';

describe('cosineSimilarity', () => {
  it('identical vectors produce similarity 1.0', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0, 5);
  });

  it('orthogonal vectors produce similarity 0.0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5);
  });

  it('opposite vectors produce similarity -1.0', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5);
  });

  it('known vectors produce expected similarity', () => {
    // cos(45 degrees) = sqrt(2)/2 ≈ 0.7071
    const result = cosineSimilarity([1, 0], [1, 1]);
    expect(result).toBeCloseTo(Math.sqrt(2) / 2, 4);
  });

  it('zero-norm vector returns 0', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('both zero-norm vectors returns 0', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it('throws for mismatched vector lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Vector length mismatch');
  });

  it('handles single dimension', () => {
    expect(cosineSimilarity([5], [3])).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity([5], [-3])).toBeCloseTo(-1.0, 5);
  });
});

describe('embedTextsWithDedup', () => {
  it('deduplicates identical texts', async () => {
    let callCount = 0;
    const embedFn = async (text: string) => {
      callCount++;
      return text.split('').map(c => c.charCodeAt(0));
    };

    const texts = ['hello', 'hello', 'world', 'hello'];
    const result = await embedTextsWithDedup(texts, embedFn, 8);

    // Only 2 unique texts
    expect(callCount).toBe(2);
    expect(result.has('hello')).toBe(true);
    expect(result.has('world')).toBe(true);
  });

  it('respects concurrency limit', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const embedFn = async (text: string) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise(resolve => setTimeout(resolve, 10));
      currentConcurrent--;
      return [text.length];
    };

    const texts = Array.from({ length: 10 }, (_, i) => `text${i}`);
    await embedTextsWithDedup(texts, embedFn, 2);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('handles embedding errors gracefully', async () => {
    const embedFn = async (text: string) => {
      if (text === 'bad') throw new Error('Embed failed');
      return [text.length];
    };

    const texts = ['good', 'bad', 'also_good'];
    const result = await embedTextsWithDedup(texts, embedFn, 8);

    expect(result.has('good')).toBe(true);
    expect(result.has('bad')).toBe(false);
    expect(result.has('also_good')).toBe(true);
  });

  it('handles empty input', async () => {
    const embedFn = async () => [1, 2, 3];
    const result = await embedTextsWithDedup([], embedFn, 8);
    expect(result.size).toBe(0);
  });
});
