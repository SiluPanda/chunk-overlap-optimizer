# chunk-overlap-optimizer

Analyze text chunk boundaries, score boundary quality, and recommend optimal overlap size for RAG chunking pipelines.

[![npm version](https://img.shields.io/npm/v/chunk-overlap-optimizer.svg)](https://www.npmjs.com/package/chunk-overlap-optimizer)
[![license](https://img.shields.io/npm/l/chunk-overlap-optimizer.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/node/v/chunk-overlap-optimizer.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

Every RAG pipeline requires a chunk overlap setting, but most teams copy a default (50, 100, or 200 tokens) from a framework or blog post. The correct overlap depends on actual sentence lengths at actual chunk boundaries -- not a heuristic. `chunk-overlap-optimizer` measures every boundary in a chunk corpus, detects mid-sentence splits, computes per-boundary overlap requirements, and returns a data-driven recommendation with a confidence score, distribution histogram, and problem boundary report. Zero runtime dependencies. Semantic analysis via caller-supplied embeddings is opt-in.

## Installation

```bash
npm install chunk-overlap-optimizer
```

## Quick Start

```typescript
import { recommend } from 'chunk-overlap-optimizer';

const chunks = [
  'The authentication token is stored securely. Each request must include',
  'the token in the Authorization header. Tokens expire after 24 hours.',
  'To refresh a token, call the /auth/refresh endpoint with the current token.',
];

const result = await recommend(chunks, {
  currentOverlap: 50,
  targetPercentile: 90,
});

console.log(result.recommended);        // recommended overlap in tokens
console.log(result.confidence);          // 0-1, how consistent the boundaries are
console.log(result.averageQualityScore); // 0-1, corpus-level boundary quality
console.log(result.histogram);           // overlap requirement distribution
console.log(result.currentOverlapComparison?.status); // 'adequate' | 'insufficient' | 'excessive'
```

## Features

- **Boundary quality scoring** -- continuous 0.0-1.0 quality score for every inter-chunk boundary, based on sentence alignment, paragraph alignment, head/tail fragment analysis, and mid-word detection.
- **Overlap recommendation** -- a single token (or character) overlap value computed at a configurable percentile (default: 90th) of the boundary overlap requirement distribution.
- **Confidence score** -- measures consistency across boundaries. High confidence (> 0.8) means the recommendation covers the corpus well; low confidence (< 0.5) means high variability.
- **Overlap histogram** -- bucketed distribution of per-boundary overlap requirements for visual inspection.
- **Problem boundary report** -- the N worst boundaries sorted by quality score, with text excerpts for manual review.
- **Current overlap comparison** -- compares your existing overlap against the recommendation and reports whether it is adequate, insufficient, or excessive, with percentile coverage.
- **Sentence boundary detection** -- built-in rule-based scanner with abbreviation suppression (titles, geographic, Latin/academic, months, single letters), decimal number handling, ellipsis handling, URL suppression, and file extension suppression.
- **Semantic continuity analysis** -- optional embedding-based cosine similarity between chunk edges, with configurable boost factor for semantically cohesive boundaries.
- **Factory pattern** -- `createAnalyzer()` creates a configured instance for repeated use across multiple document corpora, with per-call overrides.
- **Zero runtime dependencies** -- all analysis logic is self-contained. Embedding support is opt-in via a caller-supplied function.

## API Reference

### `recommend(chunks, options?)`

Analyzes all boundaries in a chunk corpus and returns a full overlap recommendation.

**Signature:**

```typescript
function recommend(
  chunks: string[],
  options?: AnalyzerOptions,
): Promise<OverlapRecommendation>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `chunks` | `string[]` | Array of chunk text strings. Minimum 2 chunks required. |
| `options` | `AnalyzerOptions` | Optional configuration. See [Configuration](#configuration). |

**Returns:** `Promise<OverlapRecommendation>`

| Field | Type | Description |
|-------|------|-------------|
| `recommended` | `number` | The recommended overlap value in the configured unit. |
| `unit` | `SizeUnit` | `'tokens'` or `'chars'`. |
| `confidence` | `number` | Confidence score in [0, 1]. |
| `targetPercentile` | `number` | The percentile used to compute the recommendation. |
| `averageQualityScore` | `number` | Mean quality score across all boundaries. |
| `boundaries` | `BoundaryAnalysis[]` | Full per-boundary analysis, sorted by index. |
| `histogram` | `HistogramBucket[]` | Overlap requirement distribution in 7 buckets. |
| `problemBoundaries` | `BoundaryAnalysis[]` | The N lowest-quality boundaries. |
| `currentOverlapComparison` | `OverlapComparison \| undefined` | Present when `currentOverlap` is provided. |
| `chunkCount` | `number` | Total number of chunks analyzed. |
| `boundaryCount` | `number` | Total number of boundaries (chunkCount - 1). |
| `timestamp` | `string` | ISO 8601 timestamp. |
| `durationMs` | `number` | Wall-clock analysis time in milliseconds. |

**Example:**

```typescript
import { recommend } from 'chunk-overlap-optimizer';

const result = await recommend(chunks, {
  targetPercentile: 95,
  maxOverlap: 150,
  currentOverlap: 64,
});

console.log(`Recommended overlap: ${result.recommended} ${result.unit}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Boundaries analyzed: ${result.boundaryCount}`);

if (result.currentOverlapComparison) {
  const cmp = result.currentOverlapComparison;
  console.log(`Current overlap status: ${cmp.status}`);
  console.log(`Percentile coverage: ${cmp.currentPercentileCoverage}%`);
}
```

---

### `analyze(chunks, options?)`

Returns per-boundary analysis without computing the top-level recommendation. Useful when you need the raw boundary data for custom aggregation.

**Signature:**

```typescript
function analyze(
  chunks: string[],
  options?: AnalyzerOptions,
): Promise<OverlapAnalysis>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `chunks` | `string[]` | Array of chunk text strings. Minimum 2 chunks required. |
| `options` | `AnalyzerOptions` | Optional configuration. See [Configuration](#configuration). |

**Returns:** `Promise<OverlapAnalysis>`

| Field | Type | Description |
|-------|------|-------------|
| `boundaries` | `BoundaryAnalysis[]` | Array of per-boundary analysis objects. |
| `boundaryCount` | `number` | Total number of boundaries analyzed. |
| `midSentenceCount` | `number` | Number of mid-sentence boundaries. |
| `midSentenceRate` | `number` | Fraction of boundaries that are mid-sentence splits. |
| `averageQualityScore` | `number` | Mean quality score. |
| `medianQualityScore` | `number` | Median quality score. |
| `options` | `ResolvedOptions` | The resolved options used for this analysis. |
| `timestamp` | `string` | ISO 8601 timestamp. |
| `durationMs` | `number` | Wall-clock analysis time in milliseconds. |

**Example:**

```typescript
import { analyze } from 'chunk-overlap-optimizer';

const analysis = await analyze(chunks);

console.log(`Mid-sentence rate: ${(analysis.midSentenceRate * 100).toFixed(1)}%`);
console.log(`Average quality: ${analysis.averageQualityScore.toFixed(2)}`);

for (const b of analysis.boundaries) {
  if (b.qualityScore < 0.5) {
    console.log(`Boundary ${b.index}: quality=${b.qualityScore.toFixed(2)}, overlap=${b.minOverlap}`);
    console.log(`  Tail: "...${b.tailFragment}"`);
    console.log(`  Head: "${b.headFragment}..."`);
  }
}
```

---

### `analyzeBoundary(chunkEnd, nextChunkStart, options?)`

Analyzes a single boundary between two text segments. Useful for targeted inspection of specific boundaries without analyzing an entire corpus.

**Signature:**

```typescript
function analyzeBoundary(
  chunkEnd: string,
  nextChunkStart: string,
  options?: AnalyzerOptions,
): Promise<BoundaryAnalysis>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `chunkEnd` | `string` | The text of the chunk ending at this boundary. |
| `nextChunkStart` | `string` | The text of the chunk starting after this boundary. |
| `options` | `AnalyzerOptions` | Optional configuration. See [Configuration](#configuration). |

**Returns:** `Promise<BoundaryAnalysis>`

| Field | Type | Description |
|-------|------|-------------|
| `index` | `number \| undefined` | Boundary index (undefined for single boundary analysis). |
| `qualityScore` | `number` | Quality score in [0.0, 1.0]. |
| `isMidSentence` | `boolean` | True if the boundary falls mid-sentence. |
| `headContinuation` | `boolean` | True if the next chunk starts mid-sentence. |
| `isMidParagraph` | `boolean` | True if the boundary falls mid-paragraph. |
| `tailWindow` | `string` | Last `windowSize` units of the ending chunk. |
| `headWindow` | `string` | First `windowSize` units of the starting chunk. |
| `tailFragment` | `string` | Interrupted sentence fragment at the tail. |
| `tailFragmentSize` | `number` | Size of tail fragment in the configured unit. |
| `headFragment` | `string` | Continuation fragment at the head. |
| `headFragmentSize` | `number` | Size of head fragment in the configured unit. |
| `minOverlap` | `number` | Minimum overlap to capture the interrupted sentence. |
| `adjustedOverlap` | `number` | Overlap adjusted for semantic continuity (if embedFn provided). |
| `semanticContinuity` | `number \| undefined` | Cosine similarity between tail/head embeddings. |
| `tailSentenceBoundaries` | `number[]` | Detected sentence positions in the tail window. |
| `headSentenceBoundaries` | `number[]` | Detected sentence positions in the head window. |

**Example:**

```typescript
import { analyzeBoundary } from 'chunk-overlap-optimizer';

const boundary = await analyzeBoundary(
  'The system verifies the token before',
  'allowing access to protected resources. Users must authenticate first.',
);

console.log(boundary.qualityScore);  // low score -- mid-sentence split
console.log(boundary.isMidSentence); // true
console.log(boundary.minOverlap);    // tokens needed to capture the full sentence
console.log(boundary.tailFragment);  // "The system verifies the token before"
```

---

### `createAnalyzer(config)`

Creates a configured analyzer instance with preset options. Each method on the returned instance accepts optional overrides that merge with the factory configuration.

**Signature:**

```typescript
function createAnalyzer(config: AnalyzerOptions): Analyzer
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `AnalyzerOptions` | Base configuration for all subsequent calls. |

**Returns:** `Analyzer`

| Method | Signature |
|--------|-----------|
| `recommend` | `(chunks: string[], overrides?: Partial<AnalyzerOptions>) => Promise<OverlapRecommendation>` |
| `analyze` | `(chunks: string[], overrides?: Partial<AnalyzerOptions>) => Promise<OverlapAnalysis>` |
| `analyzeBoundary` | `(chunkEnd: string, nextChunkStart: string, overrides?: Partial<AnalyzerOptions>) => Promise<BoundaryAnalysis>` |

**Example:**

```typescript
import { createAnalyzer } from 'chunk-overlap-optimizer';

const analyzer = createAnalyzer({
  sizeUnit: 'tokens',
  targetPercentile: 95,
  windowSize: 128,
  abbreviations: ['API', 'SDK', 'CLI'],
});

// Analyze multiple corpora with the same configuration
const docsResult = await analyzer.recommend(documentationChunks);
const faqResult = await analyzer.recommend(faqChunks);

// Override a specific option for one call
const strictResult = await analyzer.recommend(legalChunks, { targetPercentile: 99 });
```

---

### `AnalyzerError`

Custom error class with typed error codes, thrown for invalid inputs and configuration.

**Signature:**

```typescript
class AnalyzerError extends Error {
  readonly code: AnalyzerErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AnalyzerErrorCode,
    message: string,
    details?: Record<string, unknown>,
  );
}
```

**Error codes:**

| Code | Cause |
|------|-------|
| `INSUFFICIENT_CHUNKS` | Fewer than 2 chunks provided. |
| `INVALID_CHUNKS` | `chunks` is not an array of strings. |
| `INVALID_PERCENTILE` | `targetPercentile` is not in [1, 99]. |
| `INVALID_WINDOW_SIZE` | `windowSize` is not greater than 0. |
| `INVALID_MAX_OVERLAP` | `maxOverlap` is not greater than 0. |
| `EMBED_FN_ERROR` | The provided `embedFn` threw an error. |
| `INVALID_SENTENCE_DETECTOR` | The custom `sentenceDetector` returned invalid output. |

## Configuration

All functions accept an `AnalyzerOptions` object.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sizeUnit` | `'tokens' \| 'chars'` | `'tokens'` | Unit for overlap measurements and recommendations. |
| `tokenCounter` | `(text: string) => number` | `Math.ceil(text.length / 4)` | Token counting function. Only used when `sizeUnit` is `'tokens'`. |
| `windowSize` | `number` | `128` | Size of the text window extracted from each side of a boundary for analysis. |
| `targetPercentile` | `number` | `90` | Percentile of the overlap distribution used for the recommendation. Range: 1-99. |
| `maxOverlap` | `number` | `200` | Maximum overlap value the recommendation will return. |
| `problemBoundaryCount` | `number` | `5` | Number of problem boundaries to include in the recommendation. |
| `abbreviations` | `string[]` | `[]` | Additional abbreviations to suppress during sentence detection. Case-insensitive. Merged with the built-in list. |
| `sentenceDetector` | `SentenceDetectorFn` | `undefined` | Custom sentence boundary detector. Replaces the built-in detector when provided. Must return a sorted ascending array of integer positions. |
| `embedFn` | `EmbedFn` | `undefined` | Embedding function for semantic continuity analysis. When provided, enables cosine similarity computation between chunk edges. |
| `adjustForSemantics` | `boolean` | `true` (when `embedFn` provided) | Whether to use semantic continuity to adjust per-boundary overlap requirements. |
| `semanticBoostThreshold` | `number` | `0.80` | Cosine similarity threshold above which a boundary's overlap is boosted. |
| `semanticBoostFactor` | `number` | `1.3` | Multiplication factor applied to `minOverlap` when semantic continuity exceeds the threshold. |
| `concurrency` | `number` | `8` | Maximum number of concurrent embedding requests. |
| `currentOverlap` | `number` | `undefined` | Current overlap value for comparison. Enables `currentOverlapComparison` in the result. |

## Error Handling

All public functions throw `AnalyzerError` with typed error codes for invalid inputs. Catch these errors to provide specific feedback to callers.

```typescript
import { recommend, AnalyzerError } from 'chunk-overlap-optimizer';

try {
  const result = await recommend(chunks);
} catch (err) {
  if (err instanceof AnalyzerError) {
    switch (err.code) {
      case 'INSUFFICIENT_CHUNKS':
        console.error(`Need at least 2 chunks, got ${err.details?.chunkCount}`);
        break;
      case 'INVALID_PERCENTILE':
        console.error(`Percentile must be 1-99, got ${err.details?.targetPercentile}`);
        break;
      default:
        console.error(`Analysis error [${err.code}]: ${err.message}`);
    }
  }
}
```

When `embedFn` is provided and throws for a specific boundary, the error is caught gracefully. That boundary's `semanticContinuity` remains `undefined` and its `adjustedOverlap` falls back to `minOverlap`. The analysis continues without aborting.

## Advanced Usage

### Semantic Continuity with Embeddings

Supply an `embedFn` to enable cosine similarity analysis between chunk edges. Boundaries with high semantic continuity (above `semanticBoostThreshold`) receive a boosted overlap requirement.

```typescript
import { recommend } from 'chunk-overlap-optimizer';

async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

const result = await recommend(chunks, {
  embedFn: embed,
  semanticBoostThreshold: 0.85,
  semanticBoostFactor: 1.5,
  concurrency: 4,
});
```

Embedding calls are deduplicated (identical window texts are embedded once) and dispatched in batches controlled by `concurrency`.

### Custom Token Counter

Replace the built-in approximate counter (`Math.ceil(text.length / 4)`) with an exact tokenizer for your model.

```typescript
import { recommend } from 'chunk-overlap-optimizer';
import { encoding_for_model } from 'tiktoken';

const enc = encoding_for_model('gpt-4');

const result = await recommend(chunks, {
  tokenCounter: (text) => enc.encode(text).length,
});
```

### Custom Sentence Detector

Replace the built-in rule-based scanner with your own sentence segmentation logic.

```typescript
import { recommend } from 'chunk-overlap-optimizer';

const result = await recommend(chunks, {
  sentenceDetector: (text) => {
    // Return sorted array of positions where new sentences start
    const positions: number[] = [];
    const regex = /[.!?]\s+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      positions.push(match.index + match[0].length);
    }
    return positions;
  },
});
```

### Character-Based Analysis

Switch from token-based to character-based measurement.

```typescript
import { analyze } from 'chunk-overlap-optimizer';

const result = await analyze(chunks, {
  sizeUnit: 'chars',
  windowSize: 512,
  maxOverlap: 800,
});
```

### Two-Pass Chunking Workflow

Chunk at overlap=0, analyze, then re-chunk with the recommended overlap.

```typescript
import { recommend } from 'chunk-overlap-optimizer';

// Step 1: Initial chunking with no overlap
const initialChunks = chunkDocument(document, { overlap: 0 });

// Step 2: Analyze and get recommendation
const { recommended } = await recommend(initialChunks);

// Step 3: Re-chunk with the recommended overlap
const optimizedChunks = chunkDocument(document, { overlap: recommended });
```

### CI/CD Quality Gate

Use `currentOverlap` to validate your pipeline configuration.

```typescript
import { recommend } from 'chunk-overlap-optimizer';

const result = await recommend(sampleChunks, {
  currentOverlap: parseInt(process.env.CHUNK_OVERLAP ?? '50'),
});

if (result.currentOverlapComparison?.status === 'insufficient') {
  console.error(
    `Overlap ${result.currentOverlapComparison.current} is insufficient. ` +
    `Recommended: ${result.recommended}. ` +
    `Current coverage: ${result.currentOverlapComparison.currentPercentileCoverage}%`,
  );
  process.exit(1);
}
```

### Interpreting Results

| Field | Interpretation |
|-------|---------------|
| `recommended` | Use directly as the `overlap` parameter in your chunking pipeline. |
| `confidence` | > 0.8 means reliable; < 0.5 means high variability across boundaries. |
| `averageQualityScore` | > 0.75 means good boundaries; < 0.40 means fix the chunking strategy first. |
| `histogram` | Shows the overlap requirement distribution. A spike in the "0 (clean)" bucket means most boundaries are clean. |
| `problemBoundaries` | The worst boundary splits with text excerpts for manual review. |
| `currentOverlapComparison` | `'adequate'` means current overlap is within 5% tolerance; `'insufficient'` means boundaries are under-covered; `'excessive'` means tokens are wasted. |

### Quality Score Rubric

| Score Range | Interpretation |
|-------------|---------------|
| 0.9 -- 1.0 | Perfect break. Sentence-final punctuation at tail end; new sentence at head start. |
| 0.7 -- 0.9 | Good break. Paragraph break or strong punctuation, minor irregularities. |
| 0.5 -- 0.7 | Acceptable break. Boundary at a clause or phrase boundary, not a full sentence break. |
| 0.3 -- 0.5 | Poor break. Mid-sentence with no punctuation near the boundary. |
| 0.0 -- 0.3 | Critical break. Mid-word split or no surrounding context. |

## TypeScript

The package is written in TypeScript and ships type declarations. All types are exported from the package root.

```typescript
import type {
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
} from 'chunk-overlap-optimizer';
```

## License

MIT
