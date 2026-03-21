/**
 * Compute the minimum overlap for a boundary.
 * Equal to tailFragmentSize when mid-sentence, 0 for clean boundaries.
 */
export function computeMinOverlap(
  tailFragmentSize: number,
  isMidSentence: boolean,
): number {
  return isMidSentence ? tailFragmentSize : 0;
}

/**
 * Compute the adjusted overlap, factoring in semantic continuity.
 *
 * When no semantic data is available, adjustedOverlap equals minOverlap.
 * When semanticContinuity exceeds the threshold, applies the boost factor.
 * The result is capped at maxOverlap.
 */
export function computeAdjustedOverlap(
  minOverlap: number,
  maxOverlap: number,
  semanticContinuity?: number,
  adjustForSemantics?: boolean,
  semanticBoostThreshold?: number,
  semanticBoostFactor?: number,
): number {
  let adjusted = minOverlap;

  if (
    adjustForSemantics &&
    semanticContinuity !== undefined &&
    semanticBoostThreshold !== undefined &&
    semanticBoostFactor !== undefined &&
    semanticContinuity > semanticBoostThreshold
  ) {
    adjusted = Math.ceil(minOverlap * semanticBoostFactor);
  }

  return Math.min(adjusted, maxOverlap);
}
