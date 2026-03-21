import { describe, it, expect } from 'vitest';
import { compareOverlap } from '../comparison.js';

describe('compareOverlap', () => {
  it('returns adequate when currentOverlap >= recommended within 5%', () => {
    const result = compareOverlap(42, 40, [0, 10, 20, 30, 40, 50]);
    expect(result.status).toBe('adequate');
  });

  it('returns adequate when currentOverlap equals recommended', () => {
    const result = compareOverlap(40, 40, [0, 10, 20, 30, 40, 50]);
    expect(result.status).toBe('adequate');
  });

  it('returns insufficient when currentOverlap below recommended', () => {
    const result = compareOverlap(20, 40, [0, 10, 20, 30, 40, 50]);
    expect(result.status).toBe('insufficient');
    expect(result.delta).toBe(-20);
  });

  it('returns excessive when currentOverlap above recommended by > 5%', () => {
    const result = compareOverlap(80, 40, [0, 10, 20, 30, 40, 50]);
    expect(result.status).toBe('excessive');
    expect(result.delta).toBe(40);
  });

  it('computes currentPercentileCoverage correctly', () => {
    // 4 out of 6 values (0, 10, 20, 30) are <= 30
    const result = compareOverlap(30, 40, [0, 10, 20, 30, 40, 50]);
    expect(result.currentPercentileCoverage).toBe(67); // 4/6 = 0.667 => 67%
  });

  it('handles edge case: currentOverlap = 0, recommended = 0', () => {
    const result = compareOverlap(0, 0, [0, 0, 0]);
    expect(result.status).toBe('adequate');
    expect(result.delta).toBe(0);
    expect(result.currentPercentileCoverage).toBe(100);
  });

  it('returns correct fields', () => {
    const result = compareOverlap(25, 40, [0, 10, 20, 30, 40, 50]);
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('current', 25);
    expect(result).toHaveProperty('recommended', 40);
    expect(result).toHaveProperty('delta', -15);
    expect(result).toHaveProperty('currentPercentileCoverage');
  });

  it('adequate at boundary of 5% tolerance', () => {
    // recommended = 100, 5% = 5. So 95-105 is adequate.
    expect(compareOverlap(95, 100, [0, 50, 100]).status).toBe('adequate');
    expect(compareOverlap(105, 100, [0, 50, 100]).status).toBe('adequate');
  });

  it('insufficient just below 5% tolerance', () => {
    // recommended = 100, tolerance = 5. 94 < 95 => insufficient
    expect(compareOverlap(94, 100, [0, 50, 100]).status).toBe('insufficient');
  });

  it('excessive just above 5% tolerance', () => {
    // recommended = 100, tolerance = 5. 106 > 105 => excessive
    expect(compareOverlap(106, 100, [0, 50, 100]).status).toBe('excessive');
  });
});
