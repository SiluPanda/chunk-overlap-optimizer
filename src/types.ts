/** Unit of measurement for overlap values. */
export type SizeUnit = 'tokens' | 'chars';

/**
 * A function that identifies sentence boundary positions in a text string.
 * Returns an array of integer positions, each the index of the first character
 * of a new sentence (i.e., the position immediately following a sentence boundary).
 * Positions are sorted ascending. An empty array means no sentence boundaries detected.
 */
export type SentenceDetectorFn = (text: string) => number[];

/**
 * A function that computes an embedding vector for a text string.
 * Returns a Promise resolving to a floating-point array (the embedding vector).
 */
export type EmbedFn = (text: string) => Promise<number[]>;

/** Options for the analyzer functions and createAnalyzer factory. */
export interface AnalyzerOptions {
  /**
   * Unit for overlap measurements and recommendations.
   * Default: 'tokens'.
   */
  sizeUnit?: SizeUnit;

  /**
   * Token counting function. Receives a string, returns its token count.
   * Only used when sizeUnit is 'tokens'.
   * Default: approximate counter (Math.ceil(text.length / 4)).
   */
  tokenCounter?: (text: string) => number;

  /**
   * The size of the text window (in tokens or chars, matching sizeUnit)
   * extracted from each side of a boundary for analysis.
   * Default: 128.
   */
  windowSize?: number;

  /**
   * Percentile of the overlap requirement distribution to use as the
   * recommended overlap. 90 means "cover 90% of boundaries".
   * Range: 1 -- 99.
   * Default: 90.
   */
  targetPercentile?: number;

  /**
   * Maximum overlap value the recommendation will ever return.
   * Default: 200 (tokens or chars, matching sizeUnit).
   */
  maxOverlap?: number;

  /**
   * Number of problem boundaries to include in the OverlapRecommendation.
   * Default: 5.
   */
  problemBoundaryCount?: number;

  /**
   * Additional abbreviations to suppress during sentence boundary detection.
   * Case-insensitive. Merged with the built-in abbreviation list.
   * Default: [].
   */
  abbreviations?: string[];

  /**
   * Custom sentence boundary detection function.
   * When provided, replaces the built-in rule-based detector entirely.
   * Default: undefined (use built-in detector).
   */
  sentenceDetector?: SentenceDetectorFn;

  /**
   * Embedding function for optional semantic continuity analysis.
   * Default: undefined (no semantic analysis).
   */
  embedFn?: EmbedFn;

  /**
   * Whether to use the semantic continuity score to adjust the per-boundary
   * overlap requirement. Only applies when embedFn is provided.
   * Default: true (when embedFn is provided).
   */
  adjustForSemantics?: boolean;

  /**
   * The cosine similarity threshold above which a boundary's overlap
   * requirement is boosted by semanticBoostFactor.
   * Default: 0.80.
   */
  semanticBoostThreshold?: number;

  /**
   * The multiplication factor applied to minOverlap when semantic continuity
   * exceeds semanticBoostThreshold.
   * Default: 1.3.
   */
  semanticBoostFactor?: number;

  /**
   * Maximum number of concurrent embedding requests.
   * Default: 8.
   */
  concurrency?: number;

  /**
   * The current overlap value used in the chunk corpus being analyzed.
   * When provided, enables currentOverlapComparison in the result.
   * Default: undefined.
   */
  currentOverlap?: number;
}

/** Resolved options with all defaults applied. */
export type ResolvedOptions = Required<Omit<AnalyzerOptions, 'embedFn' | 'sentenceDetector' | 'currentOverlap'>> & {
  embedFn?: EmbedFn;
  sentenceDetector?: SentenceDetectorFn;
  currentOverlap?: number;
};

/** Analysis of a single inter-chunk boundary. */
export interface BoundaryAnalysis {
  /** Zero-based index of this boundary in the corpus. */
  index?: number;

  /** Quality score for this boundary, in [0.0, 1.0]. */
  qualityScore: number;

  /** True if chunk N ends mid-sentence. */
  isMidSentence: boolean;

  /** True if chunk N+1 starts mid-sentence. */
  headContinuation: boolean;

  /** True if the boundary falls in the middle of a paragraph. */
  isMidParagraph: boolean;

  /** The last windowSize tokens (or chars) of chunk N. */
  tailWindow: string;

  /** The first windowSize tokens (or chars) of chunk N+1. */
  headWindow: string;

  /** The text from the last sentence boundary in the tail to the end of chunk N. */
  tailFragment: string;

  /** Length of the tail fragment in the configured sizeUnit. */
  tailFragmentSize: number;

  /** The text from the start of chunk N+1 to the first sentence boundary in the head. */
  headFragment: string;

  /** Length of the head fragment in the configured sizeUnit. */
  headFragmentSize: number;

  /** Minimum overlap needed to include the complete interrupted sentence. */
  minOverlap: number;

  /** Overlap requirement adjusted for semantic continuity. */
  adjustedOverlap: number;

  /** Cosine similarity between tail and head embeddings. Present only when embedFn was provided. */
  semanticContinuity?: number;

  /** Detected sentence boundary positions within the tail window. */
  tailSentenceBoundaries: number[];

  /** Detected sentence boundary positions within the head window. */
  headSentenceBoundaries: number[];
}

/** Full per-boundary analysis of a chunk array. */
export interface OverlapAnalysis {
  /** Array of per-boundary analysis objects. */
  boundaries: BoundaryAnalysis[];

  /** Total number of boundaries analyzed. */
  boundaryCount: number;

  /** Number of boundaries with isMidSentence = true. */
  midSentenceCount: number;

  /** Fraction of boundaries that are mid-sentence splits. */
  midSentenceRate: number;

  /** Mean quality score across all boundaries. */
  averageQualityScore: number;

  /** Median quality score across all boundaries. */
  medianQualityScore: number;

  /** The options used for this analysis. */
  options: ResolvedOptions;

  /** ISO 8601 timestamp. */
  timestamp: string;

  /** Wall-clock time in milliseconds. */
  durationMs: number;
}

/** One bucket in the overlap requirement histogram. */
export interface HistogramBucket {
  /** Lower bound of this bucket (inclusive). */
  min: number;

  /** Upper bound of this bucket (exclusive). Infinity for the last bucket. */
  max: number;

  /** Number of boundaries in this bucket. */
  count: number;

  /** Fraction of all boundaries in this bucket. */
  fraction: number;

  /** Human-readable label for this bucket. */
  label: string;
}

/** Comparison of the current overlap against the recommendation. */
export interface OverlapComparison {
  /** 'adequate', 'insufficient', or 'excessive'. */
  status: 'adequate' | 'insufficient' | 'excessive';

  /** The current overlap value provided in options. */
  current: number;

  /** The recommended overlap. */
  recommended: number;

  /** The difference (current - recommended). */
  delta: number;

  /** The percentile of boundaries covered by the current overlap. */
  currentPercentileCoverage: number;
}

/** The top-level recommendation returned by recommend(). */
export interface OverlapRecommendation {
  /** The recommended overlap value. */
  recommended: number;

  /** The unit of the recommended value. */
  unit: SizeUnit;

  /** Confidence score for the recommendation, in [0, 1]. */
  confidence: number;

  /** The percentile used to compute the recommendation. */
  targetPercentile: number;

  /** Mean quality score across all boundaries. */
  averageQualityScore: number;

  /** Full per-boundary analysis, sorted by index ascending. */
  boundaries: BoundaryAnalysis[];

  /** Overlap requirement histogram. */
  histogram: HistogramBucket[];

  /** The N lowest-quality boundaries (sorted by qualityScore ascending). */
  problemBoundaries: BoundaryAnalysis[];

  /** Comparison of currentOverlap against the recommendation. */
  currentOverlapComparison?: OverlapComparison;

  /** Total number of chunks analyzed. */
  chunkCount: number;

  /** Total number of boundaries analyzed. */
  boundaryCount: number;

  /** ISO 8601 timestamp. */
  timestamp: string;

  /** Wall-clock time in milliseconds. */
  durationMs: number;
}

/** Error codes for AnalyzerError. */
export type AnalyzerErrorCode =
  | 'INSUFFICIENT_CHUNKS'
  | 'INVALID_PERCENTILE'
  | 'INVALID_WINDOW_SIZE'
  | 'INVALID_MAX_OVERLAP'
  | 'EMBED_FN_ERROR'
  | 'INVALID_CHUNKS'
  | 'INVALID_SENTENCE_DETECTOR';

/** Analyzer interface returned by createAnalyzer. */
export interface Analyzer {
  recommend(chunks: string[], overrides?: Partial<AnalyzerOptions>): Promise<OverlapRecommendation>;
  analyze(chunks: string[], overrides?: Partial<AnalyzerOptions>): Promise<OverlapAnalysis>;
  analyzeBoundary(chunkEnd: string, nextChunkStart: string, overrides?: Partial<AnalyzerOptions>): Promise<BoundaryAnalysis>;
}
