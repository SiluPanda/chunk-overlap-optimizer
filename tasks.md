# chunk-overlap-optimizer — Task Breakdown

## Phase 1: Core Analysis Engine (v0.1.0)

### 1.1 Project Scaffolding and Types

- [x] **Define all TypeScript types in `src/types.ts`** — Create the `types.ts` file with all interfaces and type aliases: `SizeUnit`, `SentenceDetectorFn`, `EmbedFn`, `AnalyzerOptions`, `BoundaryAnalysis`, `OverlapAnalysis`, `HistogramBucket`, `OverlapComparison`, `OverlapRecommendation`, `Analyzer`, `AnalyzerErrorCode`. Every field must include JSDoc comments matching the spec (Section 9). | Status: done

- [x] **Implement `AnalyzerError` class in `src/errors.ts`** — Create an `AnalyzerError` class extending `Error` with a readonly `code: AnalyzerErrorCode` field and an optional `details?: Record<string, unknown>` field. Support all error codes: `INSUFFICIENT_CHUNKS`, `INVALID_PERCENTILE`, `INVALID_WINDOW_SIZE`, `INVALID_MAX_OVERLAP`, `EMBED_FN_ERROR`, `INVALID_CHUNKS`, `INVALID_SENTENCE_DETECTOR`. | Status: done

- [x] **Install dev dependencies** — Add `typescript`, `vitest`, `eslint`, and `@types/node` as devDependencies in `package.json`. Ensure no runtime dependencies are added. | Status: done

- [ ] **Add `bin` field to `package.json` for CLI** — Add `"bin": { "chunk-overlap-optimizer": "dist/cli/index.js" }` to `package.json` so the CLI is available after global install or via npx. | Status: not_done

### 1.2 Token Counter

- [x] **Implement default approximate token counter in `src/token-counter.ts`** — Create a default token counter function: `Math.ceil(text.length / 4)`. Export it as `defaultTokenCounter`. Also export a `resolveTokenCounter` helper that returns the user-supplied `tokenCounter` if provided, or the default. | Status: done

- [x] **Write unit tests for token counter in `src/__tests__/token-counter.test.ts`** — Test that the default counter returns `Math.ceil(text.length / 4)` for various inputs (empty string, short text, long text). Test that a custom counter function is used when provided. | Status: done

### 1.3 Window Extraction

- [x] **Implement tail/head window extraction in `src/window.ts`** — Create `extractTailWindow(chunk, windowSize, tokenCounter)` and `extractHeadWindow(chunk, windowSize, tokenCounter)` functions. The tail window extracts the last `windowSize` tokens from the chunk; the head window extracts the first `windowSize` tokens. If the chunk is shorter than `windowSize` tokens, the entire chunk is used. Support both `tokens` and `chars` size units. Window extraction must count tokens from the relevant end without tokenizing the entire chunk. | Status: done

- [x] **Write unit tests for window extraction in `src/__tests__/window.test.ts`** — Test tail and head window extraction for chunks shorter than, equal to, and longer than `windowSize`. Test with both `tokens` and `chars` units. Test with a custom token counter. Verify that the extracted window is a substring of the original chunk at the correct position. | Status: done

### 1.4 Sentence Boundary Detection

- [x] **Compile built-in abbreviation list in `src/sentence/abbreviations.ts`** — Create the full abbreviation list as specified in Section 7.2: titles (Mr, Mrs, Ms, Dr, Prof, Sr, Jr, Rev, Gen, Sgt, Cpl, Pvt, Pte, Capt, Lt, Col, Maj, Brig, Adm), geographic (St, Ave, Blvd, Rd, Dept, Corp, Inc, Ltd, Co, Gov), Latin/academic (etc, al, approx, vs, cf, viz, e.g, i.e, op, cit, ibid), months (Jan, Feb, Mar, Apr, Jun, Jul, Aug, Sep, Oct, Nov, Dec), single letters (A-Z). Export a function `isAbbreviation(token, customAbbreviations?)` that checks case-insensitively. Export a function to compile abbreviation matching logic (regex or set) for reuse across calls. | Status: done

- [x] **Write unit tests for abbreviation handling in `src/__tests__/sentence/abbreviations.test.ts`** — Test all built-in abbreviation categories. Test case-insensitive matching. Test that custom abbreviations merge with built-in list. Test that non-abbreviation tokens are not suppressed. | Status: done

- [x] **Implement rule-based sentence boundary scanner in `src/sentence/scanner.ts`** — Implement the sentence detector that scans for sentence-terminal punctuation (`.`, `!`, `?`) followed by whitespace and uppercase/digit/quote. Apply all suppression rules from Section 7.3: abbreviation suppression, decimal number suppression (`3.14`), ellipsis handling (`...`), URL suppression (`www.`, `.com`, `.org`, `.io`, `http://`), file extension suppression (`.ts`, `.json`, `.md`), quoted string endings (`."`, `!'`, `?"`), parenthetical endings (`.)` when not line-start). Return an array of integer positions (index of first character of each new sentence), sorted ascending. | Status: done

- [x] **Implement paragraph break detection in `src/sentence/paragraph.ts`** — Detect double-newline sequences (`\n\n`, `\r\n\r\n`) as paragraph breaks. Return paragraph break positions. Handle mixed line endings (`\r\n`, `\r`, `\n`). Export a function that finds paragraph boundary positions in a text string. | Status: done

- [x] **Create sentence detector entry point in `src/sentence/index.ts`** — Combine the scanner and paragraph detector into a unified `detectSentenceBoundaries(text, options?)` function that merges sentence and paragraph boundary positions, deduplicates, and returns sorted ascending. Accept `abbreviations` option for custom abbreviations. | Status: done

- [x] **Write unit tests for sentence scanner in `src/__tests__/sentence/scanner.test.ts`** — Test standard prose sentence detection (period + capital). Test exclamation and question marks. Test abbreviation suppression for all categories ("Dr. Smith", "U.S.A.", "etc.", "vs.", "e.g.", "J. Smith"). Test decimal number suppression ("3.14", "0.001", "1,234.56"). Test ellipsis handling ("Wait... He said"). Test URL suppression ("Visit www.example.com. Then click"). Test file extension suppression ("See index.ts for details."). Test quoted string endings. Test parenthetical endings. Test empty string returns empty array. Test single sentence without terminal punctuation returns empty array. Test paragraph break handling (double newlines). | Status: done

- [x] **Write unit tests for paragraph detection in `src/__tests__/sentence/paragraph.test.ts`** — Test detection of `\n\n`, `\r\n\r\n`, and mixed line ending paragraph breaks. Test text with no paragraph breaks. Test text with multiple consecutive paragraph breaks. Test paragraph break at start and end of text. | Status: done

### 1.5 Quality Score Computation

- [x] **Implement boundary quality score in `src/quality.ts`** — Implement the four-component weighted quality score as specified in Section 5.5. Components: sentence alignment (weight 0.55), head start alignment (weight 0.20), paragraph alignment (weight 0.15), fragment symmetry (weight 0.10). Apply split-severity floors: mid-word split clamps score to max 0.1; tail fragment > 75% of average sentence length clamps score to max 0.35. Inputs: tail fragment, head fragment, average sentence length, whether boundary is at sentence/paragraph boundary, whether split is mid-word. | Status: done

- [x] **Write unit tests for quality score in `src/__tests__/quality.test.ts`** — Test clean boundary (both fragments empty) produces score >= 0.9. Test mid-sentence boundary with long tail fragment produces score <= 0.45. Test paragraph break alignment produces score > 0.85. Test mid-word split produces score <= 0.1. Test all four components contribute at specified weights. Test severity floor clamping. Test edge cases: zero-length fragments, equal-length fragments, very asymmetric fragments. | Status: done

### 1.6 Overlap Computation

- [x] **Implement minimum and adjusted overlap in `src/overlap.ts`** — `minOverlap` equals `tailFragmentSize` when `isMidSentence` is true, 0 for clean boundaries. `adjustedOverlap` equals `minOverlap` when no `embedFn` is provided. When semantic continuity > `semanticBoostThreshold`, `adjustedOverlap = minOverlap * semanticBoostFactor`. Cap `adjustedOverlap` at `maxOverlap`. | Status: done

- [x] **Write unit tests for overlap computation in `src/__tests__/overlap.test.ts`** — Test `minOverlap` equals `tailFragmentSize` for mid-sentence splits. Test `minOverlap` is 0 for clean boundaries. Test `adjustedOverlap` equals `minOverlap` without embeddings. Test `adjustedOverlap` boost when semantic continuity exceeds threshold. Test `adjustedOverlap` capped at `maxOverlap`. Test edge case: `minOverlap` of 0 is not boosted (0 * 1.3 = 0). | Status: done

### 1.7 Single Boundary Analysis

- [x] **Implement `analyzeBoundary()` in `src/boundary.ts`** — Integrate window extraction, sentence detection, quality scoring, and overlap computation for a single boundary between two text segments. Build and return a `BoundaryAnalysis` object with all fields: `qualityScore`, `isMidSentence`, `headContinuation`, `isMidParagraph`, `tailWindow`, `headWindow`, `tailFragment`, `tailFragmentSize`, `headFragment`, `headFragmentSize`, `minOverlap`, `adjustedOverlap`, `tailSentenceBoundaries`, `headSentenceBoundaries`, and optionally `semanticContinuity` and `index`. Detect mid-word splits (no whitespace at split point). Compute average sentence length from detected sentences in both windows. | Status: done

- [x] **Write unit tests for `analyzeBoundary()` in `src/__tests__/boundary.test.ts`** — Test a clean boundary where chunk ends with a period and next starts a new sentence. Test a mid-sentence split. Test a mid-word split. Test with custom `windowSize`. Test with custom `tokenCounter`. Test with a custom `sentenceDetector`. Test that `headContinuation` is set correctly. Test `isMidParagraph` detection. Test that `index` is undefined when calling `analyzeBoundary()` directly. | Status: done

### 1.8 Phase 1 Integration

- [x] **Set up `src/index.ts` with Phase 1 exports** — Export `analyzeBoundary`, `AnalyzerError`, and all type definitions from `src/index.ts`. Ensure the public API matches the spec signatures. | Status: done

---

## Phase 2: Corpus Analysis and Recommendation (v0.2.0)

### 2.1 Histogram

- [x] **Implement overlap histogram construction in `src/histogram.ts`** — Build a histogram from an array of overlap requirements. Buckets: [0] (clean), [1-10], [11-25], [26-50], [51-100], [101-150], [151+]. Each `HistogramBucket` has `min`, `max`, `count`, `fraction`, and `label`. The last bucket has `max: Infinity`. Bucket counts must sum to total boundary count. Fractions must sum to approximately 1.0. Labels: "0 (clean)", "1-10", "11-25", "26-50", "51-100", "101-150", "151+". | Status: done

- [x] **Write unit tests for histogram in `src/__tests__/histogram.test.ts`** — Test correct bucketing of known overlap values. Test counts sum to total. Test the 0-bucket contains only boundaries with minOverlap=0. Test label strings match expected format. Test empty input array. Test all values in a single bucket. Test values spanning all buckets. | Status: done

### 2.2 Percentile Computation

- [x] **Implement percentile calculation in `src/percentile.ts`** — Sort overlap requirements ascending. Compute the value at the configured percentile: `index = Math.ceil(percentile / 100 * length) - 1`. Round up to the nearest word boundary in the corresponding tail window text (next whitespace position). Cap at `maxOverlap`. Handle edge cases: single element, all equal values. | Status: done

- [x] **Write unit tests for percentile computation in `src/__tests__/percentile.test.ts`** — Test that 50th percentile returns the median. Test that 100th percentile returns the maximum. Test 90th percentile on a known distribution. Test with a single element. Test with all equal values. Test that `maxOverlap` cap is applied. Test rounding to word boundary. | Status: done

### 2.3 Confidence Score

- [x] **Implement confidence score in `src/confidence.ts`** — Compute the coefficient of variation: `cv = stddev(requirements) / (mean(requirements) + 1)`. Confidence: `1 / (1 + cv)`. Confidence = 1.0 when all requirements are equal (zero variance). Confidence < 0.5 when requirements are highly variable. | Status: done

- [x] **Write unit tests for confidence score in `src/__tests__/confidence.test.ts`** — Test all requirements equal produces confidence = 1.0. Test wildly varying requirements produce confidence < 0.5. Test moderate variance produces confidence in [0.5, 0.8]. Test single requirement. Test empty array edge case. | Status: done

### 2.4 Current Overlap Comparison

- [x] **Implement current overlap comparison in `src/comparison.ts`** — Given `currentOverlap`, `recommended`, and the sorted overlap requirement distribution, compute: `status` ('adequate' if within 5% tolerance, 'insufficient' if below, 'excessive' if above), `delta` (current - recommended), `currentPercentileCoverage` (what percentile of boundaries the current overlap covers). Return an `OverlapComparison` object. | Status: done

- [x] **Write unit tests for comparison in `src/__tests__/comparison.test.ts`** — Test `currentOverlap` >= recommended within 5% returns 'adequate'. Test `currentOverlap` below recommended returns 'insufficient' with negative delta. Test `currentOverlap` above recommended by > 5% returns 'excessive'. Test `currentPercentileCoverage` accuracy. Test edge case: currentOverlap = 0, recommended = 0. | Status: done

### 2.5 Corpus Analysis (`analyze()`)

- [x] **Implement `analyze()` function in `src/analyzer.ts`** — Iterate over all K-1 boundaries in the chunk array. Call `analyzeBoundary()` for each pair of consecutive chunks (setting `index` on each result). Aggregate results into an `OverlapAnalysis` object: `boundaries`, `boundaryCount`, `midSentenceCount`, `midSentenceRate`, `averageQualityScore`, `medianQualityScore`, resolved `options`, ISO 8601 `timestamp`, `durationMs`. | Status: done

- [x] **Implement input validation in `analyze()`** — Validate `chunks` is a non-empty array of strings (throw `INVALID_CHUNKS`). Validate at least 2 chunks are provided (throw `INSUFFICIENT_CHUNKS`). Validate `targetPercentile` is in [1, 99] (throw `INVALID_PERCENTILE`). Validate `windowSize` > 0 (throw `INVALID_WINDOW_SIZE`). Validate `maxOverlap` > 0 (throw `INVALID_MAX_OVERLAP`). | Status: done

### 2.6 Recommendation (`recommend()`)

- [x] **Implement `recommend()` function in `src/recommend.ts`** — Call `analyze()` to get `OverlapAnalysis`. Use `adjustedOverlap` if embeddings were provided, `minOverlap` otherwise. Build the histogram (Section 6 Step 3). Compute the recommended overlap at `targetPercentile` (Step 4). Compute confidence (Step 5). Select problem boundaries (bottom N by quality score). If `currentOverlap` is provided, compute comparison. Assemble and return `OverlapRecommendation` with all fields: `recommended`, `unit`, `confidence`, `targetPercentile`, `averageQualityScore`, `boundaries`, `histogram`, `problemBoundaries`, `currentOverlapComparison`, `chunkCount`, `boundaryCount`, `timestamp`, `durationMs`. | Status: done

- [x] **Implement problem boundary selection** — Sort boundaries by `qualityScore` ascending. Return the bottom `problemBoundaryCount` (default 5) boundaries. These are included in the `OverlapRecommendation.problemBoundaries` field. | Status: done

### 2.7 Factory (`createAnalyzer()`)

- [x] **Implement `createAnalyzer()` factory in `src/analyzer.ts`** — Accept `AnalyzerOptions` config. Validate configuration at construction time. Cache pre-initialization (e.g., compile abbreviation regex). Return an `Analyzer` object with `recommend()`, `analyze()`, and `analyzeBoundary()` methods. Each method accepts optional `overrides` that are merged with the factory config. The instance is stateless across calls. | Status: done

### 2.8 Public API

- [x] **Update `src/index.ts` with all public exports** — Export `analyze`, `recommend`, `analyzeBoundary`, `createAnalyzer`, `AnalyzerError`, and all TypeScript types. Ensure the export surface matches Section 9 of the spec exactly. | Status: done

### 2.9 Phase 2 Integration Tests

- [x] **Create test fixture: clean corpus (`src/__tests__/fixtures/clean-corpus.json`)** — Create a JSON array of chunk strings where every chunk ends at a sentence boundary. All boundaries should be clean splits producing high quality scores (> 0.85). | Status: done

- [x] **Create test fixture: bad corpus (`src/__tests__/fixtures/bad-corpus.json`)** — Create a JSON array of chunk strings with many mid-sentence splits. Should produce low average quality scores (< 0.4) and recommended overlap > 30. | Status: done

- [x] **Create test fixture: mixed corpus (`src/__tests__/fixtures/mixed-corpus.json`)** — Create a realistic mixed corpus with both clean and mid-sentence boundaries. | Status: done

- [x] **Create test fixture: single chunk (`src/__tests__/fixtures/single-chunk.json`)** — A JSON array with exactly one chunk string. Used to test `INSUFFICIENT_CHUNKS` error. | Status: done

- [x] **Write integration tests for `analyze()` in `src/__tests__/analyze.test.ts`** — Test with clean corpus: verify `averageQualityScore` > 0.85, `midSentenceRate` is low. Test with bad corpus: verify `averageQualityScore` < 0.4, `midSentenceRate` is high. Test with mixed corpus: verify intermediate values. Test single chunk throws `INSUFFICIENT_CHUNKS`. Test two chunks produces exactly one boundary. Test `boundaryCount` equals `chunks.length - 1`. Test timestamp is valid ISO 8601. Test durationMs is a positive number. | Status: done

- [x] **Write integration tests for `recommend()` in `src/__tests__/analyze.test.ts`** — Test with clean corpus: `recommended` <= 10 (small overlap needed). Test with bad corpus: `recommended` > 30. Test `chunkCount` and `boundaryCount` are correct. Test `histogram` buckets sum to `boundaryCount`. Test `problemBoundaries` has at most `problemBoundaryCount` entries sorted by quality ascending. Test `currentOverlapComparison` is present when `currentOverlap` is provided and absent otherwise. Test determinism: same input returns identical results on consecutive calls. | Status: done

- [x] **Write integration test: large corpus performance** — Generate a 500-chunk corpus. Run `recommend()` without embeddings. Verify completion in < 200ms. | Status: done

- [x] **Write integration test: custom sentence detector** — Provide a detector that marks every newline as a boundary. Verify quality scores and overlap requirements reflect the custom detector. | Status: done

- [x] **Write integration test: `createAnalyzer()` factory** — Create an analyzer with preset options. Call `recommend()` and `analyze()` with different chunk sets. Verify options are applied. Test that overrides merge correctly with factory config. | Status: done

---

## Phase 3: Semantic Analysis and CLI (v0.3.0)

### 3.1 Semantic Analysis

- [x] **Implement cosine similarity in `src/semantic.ts`** — Implement `cosineSimilarity(vecA, vecB)`: compute `dot(a, b) / (norm(a) * norm(b))`. Handle zero-norm vectors gracefully (return 0). Validate vectors have equal length. | Status: done

- [x] **Implement embedding deduplication in `src/semantic.ts`** — Before dispatching embedding calls, build a `Map<string, Promise<number[]>>` keyed by unique window text. If the same text appears at multiple boundaries, embed it only once and share the Promise. | Status: done

- [x] **Implement concurrency-limited embedding dispatch in `src/semantic.ts`** — Dispatch embedding calls in batches of `concurrency` (default: 8). Use a concurrency limiter (manual Promise queue or equivalent) to avoid overwhelming the embedding API. | Status: done

- [x] **Implement graceful embedding error handling** — When `embedFn` throws for a specific boundary, catch the error, set `semanticContinuity` to `undefined` for that boundary, fall back `adjustedOverlap` to `minOverlap`, and increment an `embedErrors` counter on the result. Do not abort the entire analysis. | Status: done

- [x] **Integrate semantic analysis into boundary analysis** — When `embedFn` is provided in options, embed tail and head windows for each boundary. Compute `semanticContinuity` via cosine similarity. Apply semantic boost to `adjustedOverlap` when `adjustForSemantics` is true and `semanticContinuity > semanticBoostThreshold`. Default `adjustForSemantics` to true when `embedFn` is provided. | Status: done

- [x] **Write unit tests for cosine similarity in `src/__tests__/semantic.test.ts`** — Test identical vectors produce similarity 1.0. Test orthogonal vectors produce similarity 0.0. Test known vectors produce expected similarity. Test zero-norm vector handling. Test mismatched vector lengths. | Status: done

- [x] **Write tests for embedding deduplication in `src/__tests__/semantic.test.ts`** — Mock `embedFn` with a call counter. Provide boundaries where the same window text appears at multiple positions. Verify `embedFn` is called only once per unique text. | Status: done

- [x] **Write tests for concurrency limiting in `src/__tests__/semantic.test.ts`** — Mock `embedFn` with a concurrency counter (increment on call, decrement on resolve). Set `concurrency: 2`. Verify max concurrent calls never exceeds 2. | Status: done

- [x] **Write tests for graceful embedding degradation in `src/__tests__/semantic.test.ts`** — Mock `embedFn` that throws for one specific boundary. Verify analysis completes successfully. Verify `semanticContinuity` is `undefined` for the failed boundary. Verify `adjustedOverlap` equals `minOverlap` for the failed boundary. Verify `embedErrors` count is 1. | Status: done

- [x] **Write tests for semantic boost logic in `src/__tests__/semantic.test.ts`** — Mock `embedFn` returning pre-computed vectors with known cosine similarities. Test boundary with similarity > 0.80 gets `adjustedOverlap = minOverlap * 1.3`. Test boundary with similarity < 0.80 gets `adjustedOverlap = minOverlap`. Test `adjustedOverlap` capped at `maxOverlap`. Test `adjustForSemantics: false` disables boost. | Status: done

### 3.2 CLI

- [ ] **Implement CLI entry point in `cli/index.ts`** — Use `parseArgs` from `node:util` (Node 18+) for argument parsing. Parse all flags from Section 12: `--percentile`, `--window`, `--unit`, `--current-overlap`, `--max-overlap`, `--abbrev`, `--format`, `--pretty`, `--boundaries`, `--histogram`, `--problem-count`, `--version`, `--help`. Read input from file argument or stdin. Add hashbang `#!/usr/bin/env node` at top. | Status: not_done

- [ ] **Implement JSON input parsing in CLI** — Auto-detect input format: if first element is a string, treat as plain chunk array; if first element is an object, extract `.content` field from each element (chunk-smart output format). Validate input is a valid JSON array. Handle parse errors gracefully with exit code 1. | Status: not_done

- [ ] **Implement text output format in CLI** — Format the `OverlapRecommendation` as human-readable text matching the example in Section 12: header, chunk/boundary counts, average quality with interpretation, mid-sentence rate, recommendation with confidence, current overlap comparison (if provided), overlap distribution histogram with bar chart, and problem boundaries list with text excerpts. | Status: not_done

- [ ] **Implement JSON output format in CLI** — With `--format json`, output the full `OverlapRecommendation` as JSON. With `--pretty`, pretty-print with 2-space indentation. With `--boundaries`, include the full boundaries array. Without `--boundaries`, omit the boundaries array from JSON output (it can be very large). | Status: not_done

- [ ] **Implement CLI exit codes** — Exit 0 on success. Exit 1 on input errors (file not found, invalid JSON). Exit 2 on configuration errors (invalid flags). Exit 3 on insufficient input (fewer than 2 chunks). Exit 4 when `--current-overlap` is set and the comparison status is 'insufficient'. | Status: not_done

- [ ] **Implement `--version` and `--help` flags** — `--version` prints the version from package.json and exits. `--help` prints usage information matching the flag reference in Section 12 and exits. | Status: not_done

- [ ] **Write CLI tests in `src/__tests__/cli.test.ts`** — Spawn the CLI as a child process for each test. Test file input with a JSON file path. Test stdin input (pipe JSON array). Test chunk-smart format input (array of objects with `content` field). Test `--format json` produces valid JSON. Test `--format json --pretty` produces indented JSON. Test `--percentile 95` flag. Test `--window 64` flag. Test `--unit chars` flag. Test `--current-overlap` flag. Test `--abbrev API,SDK` flag. Test `--problem-count 3` flag. Test `--boundaries` flag includes boundaries in JSON output. Test `--histogram` flag shows histogram in text output. | Status: not_done

- [ ] **Write CLI exit code tests in `src/__tests__/cli.test.ts`** — Test exit code 0 on successful analysis. Test exit code 1 on file not found. Test exit code 1 on invalid JSON input. Test exit code 2 on invalid/unrecognized flags. Test exit code 3 on single-chunk input. Test exit code 4 when `--current-overlap` is below recommendation. Test exit code 0 when `--current-overlap` is adequate. | Status: not_done

---

## Phase 4: Polish and Production Readiness (v1.0.0)

### 4.1 Edge Case Hardening

- [ ] **Handle whitespace-only chunks** — Chunks containing only whitespace should produce quality score 0.0 and minOverlap 0. Sentence detector should return empty array. Add test cases. | Status: not_done

- [ ] **Handle very long sentences exceeding `maxOverlap`** — When a sentence fragment is longer than `maxOverlap` tokens, the recommendation must be capped at `maxOverlap`. Verify this works correctly end-to-end. Add test cases. | Status: not_done

- [ ] **Handle Unicode and non-ASCII text** — Test sentence detection with CJK characters, emoji, RTL text, and Unicode sentence-terminal punctuation (`。`, `！`, `？`). Ensure the scanner recognizes Unicode sentence boundaries where appropriate. Add test cases. | Status: not_done

- [ ] **Handle mixed line endings** — Ensure paragraph detection works with `\r\n`, `\r`, and `\n` line endings, including mixed usage within the same text. Add test cases. | Status: not_done

- [ ] **Handle code chunks (non-prose)** — When chunks contain code with no prose sentences, the sentence detector should find no boundaries. The boundary should be treated with a neutral quality score. Add test cases. | Status: not_done

- [ ] **Handle chunks with trailing/leading whitespace only** — Verify these are treated as clean boundaries. Add test cases. | Status: not_done

- [ ] **Handle `targetPercentile: 50`** — Verify it returns the median overlap requirement. | Status: not_done

- [ ] **Handle `targetPercentile: 100`** — Verify it returns the maximum overlap requirement. | Status: not_done

### 4.2 Custom Sentence Detector Validation

- [ ] **Validate custom `sentenceDetector` output** — When a caller-supplied `sentenceDetector` is provided, validate that it returns a sorted array of integers within bounds (0 to text.length). Throw `AnalyzerError` with `INVALID_SENTENCE_DETECTOR` if validation fails. | Status: not_done

- [ ] **Write tests for custom sentence detector validation** — Test valid custom detector works. Test detector returning non-array throws. Test detector returning non-integer positions throws. Test detector returning out-of-bounds positions throws. Test detector returning unsorted positions throws. | Status: not_done

### 4.3 Performance

- [ ] **Benchmark sentence scanner performance** — Profile the sentence scanner against the performance targets in Section 16. 10 chunks < 1ms, 100 chunks < 5ms, 500 chunks < 20ms, 1000 chunks < 50ms (without embeddings, on approximate token counter). Optimize hot paths if targets are not met. | Status: not_done

- [ ] **Benchmark corpus analysis loop** — Profile the full `recommend()` pipeline without embeddings. Verify it meets the performance targets. Identify and fix any bottlenecks. | Status: not_done

- [ ] **Verify no memory amplification** — Confirm boundary analysis objects contain window text substrings but not copies of full chunks. Output size should be proportional to `K * 2 * windowSize`. | Status: not_done

### 4.4 Documentation

- [x] **Write comprehensive README.md** — Cover: installation, quick start example, `recommend()` usage, `analyze()` usage, `analyzeBoundary()` usage, `createAnalyzer()` factory usage, all configuration options with defaults, CLI usage with examples, two-pass `chunk-smart` workflow, CI/CD quality gate pattern, embedding integration with `embed-cache`, interpreting the report (recommended, confidence, histogram, problem boundaries, current overlap comparison), custom sentence detector, custom token counter, error handling (`AnalyzerError` codes), performance characteristics. | Status: done

- [ ] **Add JSDoc comments to all public API functions** — Ensure `recommend()`, `analyze()`, `analyzeBoundary()`, `createAnalyzer()`, and `AnalyzerError` have comprehensive JSDoc comments matching the spec descriptions, including parameter descriptions, return type descriptions, and usage examples. | Status: not_done

### 4.5 Build and Publish Preparation

- [ ] **Verify TypeScript compilation** — Run `npm run build` and confirm all source files compile without errors. Verify `dist/` output contains `.js`, `.d.ts`, and `.d.ts.map` files for all modules. | Status: not_done

- [ ] **Verify ESLint passes** — Run `npm run lint` and fix any linting errors. Ensure the codebase is clean. | Status: not_done

- [ ] **Verify all tests pass** — Run `npm run test` (vitest run) and confirm all unit, integration, and CLI tests pass. | Status: not_done

- [ ] **Verify CLI works end-to-end** — Install the package locally (`npm link` or equivalent), run `chunk-overlap-optimizer` on a test JSON file, verify text and JSON output formats work correctly. | Status: not_done

- [ ] **Bump version to 1.0.0** — Update `version` in `package.json` to `1.0.0` for production release. | Status: not_done

- [ ] **Verify `files` field in `package.json`** — Ensure only `dist` is included in the published package. Verify the CLI binary path is correct in the `bin` field. | Status: not_done
