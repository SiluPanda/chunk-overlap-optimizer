import { describe, it, expect } from 'vitest';
import { computeMinOverlap, computeAdjustedOverlap } from '../overlap.js';

describe('computeMinOverlap', () => {
  it('returns tailFragmentSize for mid-sentence splits', () => {
    expect(computeMinOverlap(40, true)).toBe(40);
    expect(computeMinOverlap(0, true)).toBe(0);
    expect(computeMinOverlap(100, true)).toBe(100);
  });

  it('returns 0 for clean boundaries', () => {
    expect(computeMinOverlap(0, false)).toBe(0);
    expect(computeMinOverlap(40, false)).toBe(0);
  });
});

describe('computeAdjustedOverlap', () => {
  it('equals minOverlap without embeddings', () => {
    expect(computeAdjustedOverlap(40, 200)).toBe(40);
    expect(computeAdjustedOverlap(0, 200)).toBe(0);
  });

  it('equals minOverlap when adjustForSemantics is false', () => {
    expect(computeAdjustedOverlap(40, 200, 0.95, false, 0.8, 1.3)).toBe(40);
  });

  it('boosts when semantic continuity exceeds threshold', () => {
    const result = computeAdjustedOverlap(40, 200, 0.90, true, 0.80, 1.3);
    expect(result).toBe(Math.ceil(40 * 1.3)); // 52
  });

  it('does not boost when semantic continuity is below threshold', () => {
    const result = computeAdjustedOverlap(40, 200, 0.70, true, 0.80, 1.3);
    expect(result).toBe(40);
  });

  it('caps at maxOverlap', () => {
    const result = computeAdjustedOverlap(180, 200, 0.95, true, 0.80, 1.3);
    expect(result).toBe(200); // 180 * 1.3 = 234, capped at 200
  });

  it('does not boost zero minOverlap', () => {
    const result = computeAdjustedOverlap(0, 200, 0.95, true, 0.80, 1.3);
    expect(result).toBe(0); // 0 * 1.3 = 0
  });

  it('handles missing semantic parameters gracefully', () => {
    expect(computeAdjustedOverlap(40, 200, undefined, true, 0.8, 1.3)).toBe(40);
    expect(computeAdjustedOverlap(40, 200, 0.9, true, undefined, 1.3)).toBe(40);
    expect(computeAdjustedOverlap(40, 200, 0.9, true, 0.8, undefined)).toBe(40);
  });

  it('caps even without semantic boost', () => {
    expect(computeAdjustedOverlap(250, 200)).toBe(200);
  });
});
