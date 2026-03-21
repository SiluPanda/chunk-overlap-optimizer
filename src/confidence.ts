/**
 * Compute the confidence score from a set of overlap requirements.
 *
 * Uses the coefficient of variation (CV) to measure consistency.
 * cv = stddev(requirements) / (mean(requirements) + 1)
 * confidence = 1 / (1 + cv)
 *
 * Confidence = 1.0 when all requirements are equal (zero variance).
 * Confidence < 0.5 when requirements are highly variable.
 */
export function computeConfidence(overlapRequirements: number[]): number {
  if (overlapRequirements.length <= 1) return 1.0;

  const n = overlapRequirements.length;
  const mean = overlapRequirements.reduce((a, b) => a + b, 0) / n;

  const variance = overlapRequirements.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  const cv = stddev / (mean + 1);
  return 1 / (1 + cv);
}
