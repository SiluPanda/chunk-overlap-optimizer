/**
 * Compute the value at a given percentile from a list of overlap requirements.
 *
 * Sorts the values ascending and picks the value at the percentile position.
 * Caps the result at maxOverlap.
 */
export function computePercentile(
  overlapRequirements: number[],
  percentile: number,
  maxOverlap: number,
): number {
  if (overlapRequirements.length === 0) return 0;

  const sorted = [...overlapRequirements].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  const clamped = Math.max(0, Math.min(index, sorted.length - 1));
  const value = sorted[clamped];

  return Math.min(value, maxOverlap);
}
