import type { HistogramBucket } from './types.js';

/**
 * Bucket definitions for the overlap histogram.
 */
const BUCKET_DEFS: Array<{ min: number; max: number; label: string }> = [
  { min: 0, max: 1, label: '0 (clean)' },
  { min: 1, max: 11, label: '1-10' },
  { min: 11, max: 26, label: '11-25' },
  { min: 26, max: 51, label: '26-50' },
  { min: 51, max: 101, label: '51-100' },
  { min: 101, max: 151, label: '101-150' },
  { min: 151, max: Infinity, label: '151+' },
];

/**
 * Build an overlap histogram from an array of overlap requirements.
 *
 * Each value is placed into the appropriate bucket. Bucket counts sum to
 * the total number of values. Fractions sum to approximately 1.0.
 */
export function buildHistogram(overlapRequirements: number[]): HistogramBucket[] {
  const total = overlapRequirements.length;

  const buckets: HistogramBucket[] = BUCKET_DEFS.map(def => ({
    min: def.min,
    max: def.max,
    count: 0,
    fraction: 0,
    label: def.label,
  }));

  for (const value of overlapRequirements) {
    for (const bucket of buckets) {
      if (value >= bucket.min && value < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  // Compute fractions
  for (const bucket of buckets) {
    bucket.fraction = total > 0 ? bucket.count / total : 0;
  }

  return buckets;
}
