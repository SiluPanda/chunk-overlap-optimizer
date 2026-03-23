import type {
  AnalyzerOptions,
  BoundaryAnalysis,
  OverlapAnalysis,
  ResolvedOptions,
  Analyzer,
} from './types.js';
import { AnalyzerError } from './errors.js';
import { resolveOptions, mergeOptions } from './defaults.js';
import { analyzeBoundaryCore } from './boundary.js';
import { computeAdjustedOverlap } from './overlap.js';
import { cosineSimilarity, embedTextsWithDedup } from './semantic.js';

/**
 * Validate input for analyze/recommend functions.
 */
function validateInput(chunks: string[], options: ResolvedOptions): void {
  if (!Array.isArray(chunks)) {
    throw new AnalyzerError('INVALID_CHUNKS', 'chunks must be an array of strings');
  }
  for (let i = 0; i < chunks.length; i++) {
    if (typeof chunks[i] !== 'string') {
      throw new AnalyzerError('INVALID_CHUNKS', `chunks[${i}] must be a string`, { index: i });
    }
  }
  if (chunks.length < 2) {
    throw new AnalyzerError('INSUFFICIENT_CHUNKS', 'At least 2 chunks are required for analysis', {
      chunkCount: chunks.length,
    });
  }
  if (options.targetPercentile < 1 || options.targetPercentile > 100) {
    throw new AnalyzerError('INVALID_PERCENTILE', 'targetPercentile must be between 1 and 100', {
      targetPercentile: options.targetPercentile,
    });
  }
  if (options.windowSize <= 0) {
    throw new AnalyzerError('INVALID_WINDOW_SIZE', 'windowSize must be greater than 0', {
      windowSize: options.windowSize,
    });
  }
  if (options.maxOverlap <= 0) {
    throw new AnalyzerError('INVALID_MAX_OVERLAP', 'maxOverlap must be greater than 0', {
      maxOverlap: options.maxOverlap,
    });
  }
}

/**
 * Compute median of an array of numbers.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Analyze all boundaries in a chunk array.
 *
 * For each pair of consecutive chunks, runs boundary analysis and
 * optionally computes semantic continuity via embeddings.
 */
export async function analyze(
  chunks: string[],
  options?: AnalyzerOptions,
): Promise<OverlapAnalysis> {
  const resolved = resolveOptions(options);
  validateInput(chunks, resolved);

  const start = Date.now();

  // Step 1: Analyze all boundaries
  const boundaries: BoundaryAnalysis[] = [];
  for (let i = 0; i < chunks.length - 1; i++) {
    const boundary = analyzeBoundaryCore(chunks[i], chunks[i + 1], resolved, i);
    boundaries.push(boundary);
  }

  // Step 2: If embedFn provided, compute semantic continuity
  if (resolved.embedFn) {
    const textsToEmbed: string[] = [];
    for (const b of boundaries) {
      textsToEmbed.push(b.tailWindow, b.headWindow);
    }

    const embeddings = await embedTextsWithDedup(
      textsToEmbed,
      resolved.embedFn,
      resolved.concurrency,
    );

    for (const b of boundaries) {
      const tailEmbed = embeddings.get(b.tailWindow);
      const headEmbed = embeddings.get(b.headWindow);

      if (tailEmbed && headEmbed) {
        b.semanticContinuity = cosineSimilarity(tailEmbed, headEmbed);
        b.adjustedOverlap = computeAdjustedOverlap(
          b.minOverlap,
          resolved.maxOverlap,
          b.semanticContinuity,
          resolved.adjustForSemantics,
          resolved.semanticBoostThreshold,
          resolved.semanticBoostFactor,
        );
      }
      // If embedding failed for this boundary, semanticContinuity stays undefined
      // and adjustedOverlap stays equal to minOverlap (already set in analyzeBoundaryCore)
    }
  }

  // Step 3: Aggregate metrics
  const qualityScores = boundaries.map(b => b.qualityScore);
  const midSentenceCount = boundaries.filter(b => b.isMidSentence).length;
  const boundaryCount = boundaries.length;

  const averageQualityScore = qualityScores.length > 0
    ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    : 0;
  const medianQualityScore = median(qualityScores);

  const durationMs = Date.now() - start;

  return {
    boundaries,
    boundaryCount,
    midSentenceCount,
    midSentenceRate: boundaryCount > 0 ? midSentenceCount / boundaryCount : 0,
    averageQualityScore,
    medianQualityScore,
    options: resolved,
    timestamp: new Date().toISOString(),
    durationMs,
  };
}

/**
 * Analyze a single boundary between two text segments.
 */
export async function analyzeBoundary(
  chunkEnd: string,
  nextChunkStart: string,
  options?: AnalyzerOptions,
): Promise<BoundaryAnalysis> {
  const resolved = resolveOptions(options);
  const boundary = analyzeBoundaryCore(chunkEnd, nextChunkStart, resolved);

  // If embedFn provided, compute semantic continuity for this single boundary
  if (resolved.embedFn) {
    try {
      const [tailEmbed, headEmbed] = await Promise.all([
        resolved.embedFn(boundary.tailWindow),
        resolved.embedFn(boundary.headWindow),
      ]);
      boundary.semanticContinuity = cosineSimilarity(tailEmbed, headEmbed);
      boundary.adjustedOverlap = computeAdjustedOverlap(
        boundary.minOverlap,
        resolved.maxOverlap,
        boundary.semanticContinuity,
        resolved.adjustForSemantics,
        resolved.semanticBoostThreshold,
        resolved.semanticBoostFactor,
      );
    } catch {
      // Graceful degradation: leave semanticContinuity undefined
    }
  }

  return boundary;
}

/**
 * Create a configured analyzer instance with preset options.
 */
export function createAnalyzer(config: AnalyzerOptions): Analyzer {
  const baseOptions = resolveOptions(config);

  // Validate configuration at construction time
  if (baseOptions.targetPercentile < 1 || baseOptions.targetPercentile > 99) {
    throw new AnalyzerError('INVALID_PERCENTILE', 'targetPercentile must be between 1 and 99');
  }
  if (baseOptions.windowSize <= 0) {
    throw new AnalyzerError('INVALID_WINDOW_SIZE', 'windowSize must be greater than 0');
  }
  if (baseOptions.maxOverlap <= 0) {
    throw new AnalyzerError('INVALID_MAX_OVERLAP', 'maxOverlap must be greater than 0');
  }

  return {
    async recommend(chunks: string[], overrides?: Partial<AnalyzerOptions>) {
      const { recommend: doRecommend } = await import('./recommend.js');
      const merged = mergeOptions(baseOptions, overrides);
      return doRecommend(chunks, merged);
    },

    async analyze(chunks: string[], overrides?: Partial<AnalyzerOptions>) {
      const merged = mergeOptions(baseOptions, overrides);
      return analyzeWithResolved(chunks, merged);
    },

    async analyzeBoundary(chunkEnd: string, nextChunkStart: string, overrides?: Partial<AnalyzerOptions>) {
      const merged = mergeOptions(baseOptions, overrides);
      return analyzeBoundaryWithResolved(chunkEnd, nextChunkStart, merged);
    },
  };
}

/** Internal: analyze with already-resolved options. */
async function analyzeWithResolved(
  chunks: string[],
  resolved: ResolvedOptions,
): Promise<OverlapAnalysis> {
  validateInput(chunks, resolved);
  const start = Date.now();

  const boundaries: BoundaryAnalysis[] = [];
  for (let i = 0; i < chunks.length - 1; i++) {
    const boundary = analyzeBoundaryCore(chunks[i], chunks[i + 1], resolved, i);
    boundaries.push(boundary);
  }

  if (resolved.embedFn) {
    const textsToEmbed: string[] = [];
    for (const b of boundaries) {
      textsToEmbed.push(b.tailWindow, b.headWindow);
    }
    const embeddings = await embedTextsWithDedup(
      textsToEmbed, resolved.embedFn, resolved.concurrency,
    );
    for (const b of boundaries) {
      const tailEmbed = embeddings.get(b.tailWindow);
      const headEmbed = embeddings.get(b.headWindow);
      if (tailEmbed && headEmbed) {
        b.semanticContinuity = cosineSimilarity(tailEmbed, headEmbed);
        b.adjustedOverlap = computeAdjustedOverlap(
          b.minOverlap, resolved.maxOverlap,
          b.semanticContinuity, resolved.adjustForSemantics,
          resolved.semanticBoostThreshold, resolved.semanticBoostFactor,
        );
      }
    }
  }

  const qualityScores = boundaries.map(b => b.qualityScore);
  const midSentenceCount = boundaries.filter(b => b.isMidSentence).length;
  const durationMs = Date.now() - start;

  return {
    boundaries,
    boundaryCount: boundaries.length,
    midSentenceCount,
    midSentenceRate: boundaries.length > 0 ? midSentenceCount / boundaries.length : 0,
    averageQualityScore: qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0,
    medianQualityScore: median(qualityScores),
    options: resolved,
    timestamp: new Date().toISOString(),
    durationMs,
  };
}

/** Internal: analyzeBoundary with already-resolved options. */
async function analyzeBoundaryWithResolved(
  chunkEnd: string,
  nextChunkStart: string,
  resolved: ResolvedOptions,
): Promise<BoundaryAnalysis> {
  const boundary = analyzeBoundaryCore(chunkEnd, nextChunkStart, resolved);

  if (resolved.embedFn) {
    try {
      const [tailEmbed, headEmbed] = await Promise.all([
        resolved.embedFn(boundary.tailWindow),
        resolved.embedFn(boundary.headWindow),
      ]);
      boundary.semanticContinuity = cosineSimilarity(tailEmbed, headEmbed);
      boundary.adjustedOverlap = computeAdjustedOverlap(
        boundary.minOverlap, resolved.maxOverlap,
        boundary.semanticContinuity, resolved.adjustForSemantics,
        resolved.semanticBoostThreshold, resolved.semanticBoostFactor,
      );
    } catch {
      // Graceful degradation
    }
  }

  return boundary;
}
