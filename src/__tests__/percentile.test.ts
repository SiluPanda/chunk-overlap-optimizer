import { describe, it, expect } from 'vitest';
import { computePercentile } from '../percentile.js';

describe('computePercentile', () => {
  it('50th percentile returns the median', () => {
    const values = [10, 20, 30, 40, 50];
    expect(computePercentile(values, 50, 200)).toBe(30);
  });

  it('100th percentile returns the maximum', () => {
    const values = [10, 20, 30, 40, 50];
    // ceil(100/100 * 5) - 1 = 4 => values[4] = 50
    expect(computePercentile(values, 100, 200)).toBe(50);
  });

  it('90th percentile on a known distribution', () => {
    const values = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    // ceil(90/100 * 10) - 1 = ceil(9) - 1 = 8 => sorted[8] = 40
    expect(computePercentile(values, 90, 200)).toBe(40);
  });

  it('handles single element', () => {
    expect(computePercentile([42], 50, 200)).toBe(42);
    expect(computePercentile([42], 90, 200)).toBe(42);
    expect(computePercentile([42], 100, 200)).toBe(42);
  });

  it('handles all equal values', () => {
    const values = [25, 25, 25, 25, 25];
    expect(computePercentile(values, 50, 200)).toBe(25);
    expect(computePercentile(values, 90, 200)).toBe(25);
  });

  it('caps at maxOverlap', () => {
    const values = [100, 200, 300];
    expect(computePercentile(values, 100, 150)).toBe(150);
  });

  it('handles empty array', () => {
    expect(computePercentile([], 90, 200)).toBe(0);
  });

  it('handles unsorted input (sorts internally)', () => {
    const values = [50, 10, 30, 20, 40];
    expect(computePercentile(values, 50, 200)).toBe(30);
  });

  it('1st percentile returns minimum', () => {
    const values = [10, 20, 30, 40, 50];
    expect(computePercentile(values, 1, 200)).toBe(10);
  });
});
