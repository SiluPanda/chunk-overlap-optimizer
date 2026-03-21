import { describe, it, expect } from 'vitest';
import { buildHistogram } from '../histogram.js';

describe('buildHistogram', () => {
  it('builds correct histogram for known values', () => {
    const values = [0, 0, 5, 15, 30, 60, 120, 0, 3, 45];
    const histogram = buildHistogram(values);

    expect(histogram.length).toBe(7);
    // Check bucket labels
    expect(histogram[0].label).toBe('0 (clean)');
    expect(histogram[1].label).toBe('1-10');
    expect(histogram[2].label).toBe('11-25');
    expect(histogram[3].label).toBe('26-50');
    expect(histogram[4].label).toBe('51-100');
    expect(histogram[5].label).toBe('101-150');
    expect(histogram[6].label).toBe('151+');
  });

  it('counts sum to total', () => {
    const values = [0, 5, 15, 30, 60, 120, 200];
    const histogram = buildHistogram(values);
    const totalCount = histogram.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(values.length);
  });

  it('0-bucket contains only boundaries with overlap=0', () => {
    const values = [0, 0, 0, 5, 10];
    const histogram = buildHistogram(values);
    expect(histogram[0].count).toBe(3);
  });

  it('fractions sum to approximately 1.0', () => {
    const values = [0, 5, 15, 30, 60, 120, 200];
    const histogram = buildHistogram(values);
    const totalFraction = histogram.reduce((sum, b) => sum + b.fraction, 0);
    expect(totalFraction).toBeCloseTo(1.0, 5);
  });

  it('handles empty input array', () => {
    const histogram = buildHistogram([]);
    expect(histogram.length).toBe(7);
    for (const bucket of histogram) {
      expect(bucket.count).toBe(0);
      expect(bucket.fraction).toBe(0);
    }
  });

  it('handles all values in a single bucket', () => {
    const values = [0, 0, 0, 0, 0];
    const histogram = buildHistogram(values);
    expect(histogram[0].count).toBe(5);
    expect(histogram[0].fraction).toBe(1);
    for (let i = 1; i < histogram.length; i++) {
      expect(histogram[i].count).toBe(0);
    }
  });

  it('handles values spanning all buckets', () => {
    const values = [0, 5, 20, 40, 75, 125, 200];
    const histogram = buildHistogram(values);
    for (const bucket of histogram) {
      expect(bucket.count).toBeGreaterThanOrEqual(1);
    }
  });

  it('last bucket has max: Infinity', () => {
    const histogram = buildHistogram([]);
    expect(histogram[histogram.length - 1].max).toBe(Infinity);
  });

  it('bucket boundaries are correct', () => {
    const histogram = buildHistogram([]);
    expect(histogram[0].min).toBe(0);
    expect(histogram[0].max).toBe(1);
    expect(histogram[1].min).toBe(1);
    expect(histogram[1].max).toBe(11);
    expect(histogram[2].min).toBe(11);
    expect(histogram[2].max).toBe(26);
    expect(histogram[3].min).toBe(26);
    expect(histogram[3].max).toBe(51);
    expect(histogram[4].min).toBe(51);
    expect(histogram[4].max).toBe(101);
    expect(histogram[5].min).toBe(101);
    expect(histogram[5].max).toBe(151);
    expect(histogram[6].min).toBe(151);
  });
});
