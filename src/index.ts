// chunk-overlap-optimizer - Analyze chunk boundaries and recommend optimal overlap size

export { analyze, analyzeBoundary, createAnalyzer } from './analyzer.js';
export { recommend } from './recommend.js';
export { AnalyzerError } from './errors.js';

export type {
  SizeUnit,
  SentenceDetectorFn,
  EmbedFn,
  AnalyzerOptions,
  ResolvedOptions,
  BoundaryAnalysis,
  OverlapAnalysis,
  HistogramBucket,
  OverlapComparison,
  OverlapRecommendation,
  AnalyzerErrorCode,
  Analyzer,
} from './types.js';
