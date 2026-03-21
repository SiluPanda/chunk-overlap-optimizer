import type {
  AnalyzerOptions,
  OverlapRecommendation,
  ResolvedOptions,
} from './types.js';
import { analyze } from './analyzer.js';
import { buildHistogram } from './histogram.js';
import { computePercentile } from './percentile.js';
import { computeConfidence } from './confidence.js';
import { compareOverlap } from './comparison.js';
import { resolveOptions } from './defaults.js';

/**
 * Recommend an optimal overlap value for a set of chunks.
 *
 * Analyzes all boundaries, builds a histogram, computes the recommended
 * overlap at the target percentile, and returns a full recommendation.
 */
export async function recommend(
  chunks: string[],
  options?: AnalyzerOptions | ResolvedOptions,
): Promise<OverlapRecommendation> {
  const resolved = 'sizeUnit' in (options ?? {}) && 'tokenCounter' in (options ?? {})
    && typeof (options as ResolvedOptions).tokenCounter === 'function'
    && (options as ResolvedOptions).windowSize !== undefined
    ? options as ResolvedOptions
    : resolveOptions(options as AnalyzerOptions | undefined);

  const start = Date.now();

  // Step 1: Analyze all boundaries
  const analysis = await analyze(chunks, resolved);

  // Step 2: Compute overlap requirements per boundary
  const hasEmbeddings = resolved.embedFn !== undefined;
  const overlapRequirements = analysis.boundaries.map(b =>
    hasEmbeddings ? b.adjustedOverlap : b.minOverlap,
  );

  // Step 3: Build histogram
  const histogram = buildHistogram(overlapRequirements);

  // Step 4: Compute recommended overlap at target percentile
  const recommended = computePercentile(
    overlapRequirements,
    resolved.targetPercentile,
    resolved.maxOverlap,
  );

  // Step 5: Compute confidence
  const confidence = computeConfidence(overlapRequirements);

  // Step 6: Select problem boundaries (lowest quality scores)
  const sortedByQuality = [...analysis.boundaries]
    .sort((a, b) => a.qualityScore - b.qualityScore);
  const problemBoundaries = sortedByQuality.slice(0, resolved.problemBoundaryCount);

  // Step 7: Current overlap comparison (if provided)
  const currentOverlapComparison = resolved.currentOverlap !== undefined
    ? compareOverlap(
        resolved.currentOverlap,
        recommended,
        [...overlapRequirements].sort((a, b) => a - b),
      )
    : undefined;

  const durationMs = Date.now() - start;

  return {
    recommended,
    unit: resolved.sizeUnit,
    confidence,
    targetPercentile: resolved.targetPercentile,
    averageQualityScore: analysis.averageQualityScore,
    boundaries: analysis.boundaries,
    histogram,
    problemBoundaries,
    currentOverlapComparison,
    chunkCount: chunks.length,
    boundaryCount: analysis.boundaryCount,
    timestamp: new Date().toISOString(),
    durationMs,
  };
}
