import { describe, it, expect } from 'vitest';
import { computeConfidence } from '../confidence.js';

describe('computeConfidence', () => {
  it('returns 1.0 when all requirements are equal', () => {
    expect(computeConfidence([40, 40, 40, 40])).toBe(1.0);
  });

  it('returns < 0.5 for wildly varying requirements', () => {
    // With mean=0 and stddev>1, cv = stddev/(0+1) > 1, confidence = 1/(1+cv) < 0.5
    const confidence = computeConfidence([0, 0, 0, 0, 10, 0, 0, 0, 0, 0]);
    expect(confidence).toBeLessThan(0.5);
  });

  it('returns moderate confidence for moderate variance', () => {
    const confidence = computeConfidence([30, 35, 40, 45, 50]);
    expect(confidence).toBeGreaterThan(0.5);
    expect(confidence).toBeLessThan(1.0);
  });

  it('returns 1.0 for single requirement', () => {
    expect(computeConfidence([42])).toBe(1.0);
  });

  it('returns 1.0 for empty array', () => {
    expect(computeConfidence([])).toBe(1.0);
  });

  it('returns 1.0 for all zeros', () => {
    expect(computeConfidence([0, 0, 0, 0])).toBe(1.0);
  });

  it('returns value between 0 and 1', () => {
    const cases = [
      [10, 20, 30, 40, 50],
      [0, 100],
      [0, 0, 50, 100, 150],
    ];
    for (const values of cases) {
      const confidence = computeConfidence(values);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });

  it('higher variance produces lower confidence', () => {
    const lowVariance = computeConfidence([48, 49, 50, 51, 52]);
    const highVariance = computeConfidence([0, 25, 50, 75, 100]);
    expect(lowVariance).toBeGreaterThan(highVariance);
  });
});
