import type { AnalyzerOptions, ResolvedOptions } from './types.js';
import { defaultTokenCounter } from './token-counter.js';

/**
 * Resolve analyzer options with defaults applied.
 */
export function resolveOptions(options?: AnalyzerOptions): ResolvedOptions {
  const opts = options ?? {};
  return {
    sizeUnit: opts.sizeUnit ?? 'tokens',
    tokenCounter: opts.tokenCounter ?? defaultTokenCounter,
    windowSize: opts.windowSize ?? 128,
    targetPercentile: opts.targetPercentile ?? 90,
    maxOverlap: opts.maxOverlap ?? 200,
    problemBoundaryCount: opts.problemBoundaryCount ?? 5,
    abbreviations: opts.abbreviations ?? [],
    adjustForSemantics: opts.adjustForSemantics ?? (opts.embedFn !== undefined),
    semanticBoostThreshold: opts.semanticBoostThreshold ?? 0.80,
    semanticBoostFactor: opts.semanticBoostFactor ?? 1.3,
    concurrency: opts.concurrency ?? 8,
    embedFn: opts.embedFn,
    sentenceDetector: opts.sentenceDetector,
    currentOverlap: opts.currentOverlap,
  };
}

/**
 * Merge overrides into a resolved options object.
 */
export function mergeOptions(
  base: ResolvedOptions,
  overrides?: Partial<AnalyzerOptions>,
): ResolvedOptions {
  if (!overrides) return base;
  return resolveOptions({ ...base, ...overrides });
}
