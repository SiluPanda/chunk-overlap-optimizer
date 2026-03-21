import type { OverlapComparison } from './types.js';

/**
 * Compare the current overlap against the recommended value.
 *
 * Status:
 * - 'adequate': currentOverlap >= recommended within 5% tolerance
 * - 'insufficient': currentOverlap is meaningfully below recommended
 * - 'excessive': currentOverlap is meaningfully above recommended
 */
export function compareOverlap(
  currentOverlap: number,
  recommended: number,
  sortedRequirements: number[],
): OverlapComparison {
  const delta = currentOverlap - recommended;
  const tolerance = recommended * 0.05;

  let status: 'adequate' | 'insufficient' | 'excessive';
  if (currentOverlap >= recommended - tolerance && currentOverlap <= recommended + tolerance) {
    status = 'adequate';
  } else if (currentOverlap < recommended - tolerance) {
    status = 'insufficient';
  } else {
    status = 'excessive';
  }

  // Compute what percentile of boundaries the current overlap covers
  let coveredCount = 0;
  for (const req of sortedRequirements) {
    if (req <= currentOverlap) {
      coveredCount++;
    } else {
      break; // sorted, so we can stop early
    }
  }
  const currentPercentileCoverage = sortedRequirements.length > 0
    ? Math.round((coveredCount / sortedRequirements.length) * 100)
    : 100;

  return {
    status,
    current: currentOverlap,
    recommended,
    delta,
    currentPercentileCoverage,
  };
}
