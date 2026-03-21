import type { SizeUnit } from './types.js';

/**
 * Extract the last `windowSize` units from a chunk (tail window).
 * If the chunk is shorter than windowSize, the entire chunk is returned.
 */
export function extractTailWindow(
  chunk: string,
  windowSize: number,
  sizeUnit: SizeUnit,
  tokenCounter: (text: string) => number,
): string {
  if (sizeUnit === 'chars') {
    if (chunk.length <= windowSize) return chunk;
    return chunk.slice(-windowSize);
  }

  // Token-based extraction
  const totalTokens = tokenCounter(chunk);
  if (totalTokens <= windowSize) return chunk;

  // Binary search for the start position that gives us ~windowSize tokens
  let lo = 0;
  let hi = chunk.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const slice = chunk.slice(mid);
    if (tokenCounter(slice) > windowSize) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return chunk.slice(lo);
}

/**
 * Extract the first `windowSize` units from a chunk (head window).
 * If the chunk is shorter than windowSize, the entire chunk is returned.
 */
export function extractHeadWindow(
  chunk: string,
  windowSize: number,
  sizeUnit: SizeUnit,
  tokenCounter: (text: string) => number,
): string {
  if (sizeUnit === 'chars') {
    if (chunk.length <= windowSize) return chunk;
    return chunk.slice(0, windowSize);
  }

  // Token-based extraction
  const totalTokens = tokenCounter(chunk);
  if (totalTokens <= windowSize) return chunk;

  // Binary search for the end position that gives us ~windowSize tokens
  let lo = 0;
  let hi = chunk.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    const slice = chunk.slice(0, mid);
    if (tokenCounter(slice) > windowSize) {
      hi = mid - 1;
    } else {
      lo = mid;
    }
  }
  return chunk.slice(0, lo);
}
