# chunk-overlap-optimizer -- Specification

## 1. Overview

`chunk-overlap-optimizer` is a boundary-analysis library that examines a set of text chunks, scores each inter-chunk boundary for quality, and recommends the optimal overlap size to use when re-chunking the same content. It accepts an array of chunk strings, detects sentence boundaries at each chunk edge, measures how badly each boundary interrupts the natural flow of text, optionally computes embedding similarity across boundaries for deeper semantic analysis, and returns a structured `OverlapRecommendation` object containing a token-level overlap value, a confidence score, a per-boundary breakdown, and an overlap histogram -- all with enough detail to justify the recommendation and diagnose poor splits.

The gap this package fills is specific and well-defined. Every RAG pipeline requires a chunk overlap setting, but no tool exists to derive that setting from the actual content being chunked. LangChain's `RecursiveCharacterTextSplitter` defaults to 200 characters of overlap regardless of content type, document structure, or average sentence length. LlamaIndex uses a similar fixed default. Nearly every team building a RAG pipeline copies one of these defaults, picks 50 or 100 tokens by gut feeling, or cargo-cults a number from a blog post. The consequence is systematic suboptimality in one of the most impactful parameters of the retrieval pipeline.

Overlap exists for one reason: to prevent information loss at chunk boundaries. When a sentence spans two chunks, the embedding of chunk N encodes only the beginning of the sentence, and the embedding of chunk N+1 encodes only the end. Neither embedding fully represents the sentence's meaning. Retrieval of either chunk alone yields an incomplete passage. Overlap solves this by duplicating the end of chunk N at the start of chunk N+1, so the complete sentence appears in at least one chunk. The correct overlap size is therefore determined by the sentence length at boundary positions -- not by a fixed number of tokens. In a corpus of short, declarative sentences, 20 tokens of overlap may capture every sentence at every boundary. In a corpus of dense technical prose with long multi-clause sentences, 150 tokens may be needed. The only way to know is to measure the actual sentences at the actual boundaries.

`chunk-overlap-optimizer` makes this measurement. It scans each boundary between consecutive chunks, detects sentences at the edge of each chunk, identifies when a boundary falls mid-sentence (a bad split) or at a natural sentence break (a good split), and computes the minimum overlap needed to ensure complete sentences appear at each boundary. It aggregates these measurements into a histogram and uses a configurable percentile (default: 90th) to compute the recommended overlap -- the value that covers 90% of boundaries well. It reports problem boundaries (the worst splits in the corpus), compares the current overlap against the recommended value, and optionally deepens the analysis with embedding similarity, which identifies boundaries that cut through semantically related content even when sentence boundaries are present.

The package provides a TypeScript/JavaScript API for programmatic use in ingestion pipelines and a CLI for analyzing chunk files from the terminal. Both interfaces return the same `OverlapRecommendation` structure. The package has zero mandatory runtime dependencies -- sentence boundary detection is implemented with rule-based scanning and abbreviation handling, all inline. Embedding similarity is opt-in and requires the caller to supply an embedding function.

---

## 2. Goals and Non-Goals

### Goals

- Provide an `analyze(chunks, options?)` function that takes an array of chunk strings and returns a per-boundary `OverlapAnalysis` with quality scores, sentence boundary status, and per-boundary overlap recommendations.
- Provide a `recommend(chunks, options?)` function that returns an `OverlapRecommendation` -- a single overlap value, unit, confidence score, per-boundary breakdown, and histogram -- suitable for direct use as the `overlap` parameter in a chunking call.
- Provide an `analyzeBoundary(chunkEnd, nextChunkStart, options?)` function that analyzes a single boundary in isolation, enabling targeted inspection of specific boundaries without analyzing a full chunk set.
- Provide a `createAnalyzer(config)` factory function that creates a configured analyzer instance with preset options, for repeated use across many document corpora.
- Detect sentence boundaries at each chunk edge using rule-based detection: punctuation patterns (`.`, `!`, `?`), abbreviation lists ("Dr.", "U.S.A.", "etc.", "vs."), Unicode sentence break properties, ellipsis handling (`...`), and decimal number handling (`3.14`).
- Score each boundary on a continuous quality scale from 0.0 to 1.0: 1.0 means a perfect natural break (sentence-final punctuation at chunk edge, no continuation), 0.0 means a mid-word split.
- Compute, for each boundary, the minimum overlap in tokens (or characters) needed to include the complete sentence that the boundary interrupted.
- Optionally compute cosine similarity between the tail of one chunk and the head of the next using a caller-supplied embedding function, identifying boundaries that cut through semantically cohesive content.
- Aggregate boundary-level overlap requirements into a histogram and derive a recommended overlap value at a configurable percentile (default: 90th percentile).
- Report problem boundaries: the N boundaries with the lowest quality scores, with per-boundary detail for debugging.
- Accept a `currentOverlap` parameter and compare it against the recommended value, producing a structured comparison including whether the current overlap is adequate, excessive, or insufficient.
- Provide a CLI (`chunk-overlap-optimizer`) that reads chunk files (one chunk per file, or a JSON array of chunks) and outputs a recommendation.
- Keep mandatory runtime dependencies at zero. All sentence detection, scoring, and overlap computation logic is implemented using Node.js built-in APIs.
- Target Node.js 18 and above.

### Non-Goals

- **Not a chunker.** This package analyzes existing chunks to recommend overlap settings. It does not split text into chunks. For chunking, use `chunk-smart` and feed its output to this package.
- **Not an embedding generator.** This package accepts an embedding function from the caller when semantic analysis is requested. It does not call any embedding API directly. For embedding generation with caching, use `embed-cache`.
- **Not a re-chunker.** This package recommends an overlap value. It does not re-chunk the corpus with the recommended overlap. The caller applies the recommendation to their next chunking run.
- **Not a semantic chunker.** This package does not split text at semantic boundaries. It evaluates boundaries that already exist and scores their quality.
- **Not a document-level quality scorer.** This package analyzes chunk-boundary quality, not the semantic quality of individual chunks, their embedding quality, or their retrieval performance. For retrieval quality evaluation, use an evaluation framework.
- **Not a full sentence parser.** Sentence boundary detection uses rule-based scanning with abbreviation handling. It does not build a parse tree, run a neural sentence segmenter (like spaCy or Punkt), or understand syntactic structure. For production NLP pipelines where sentence accuracy is critical, the caller can provide a custom sentence detector via the `sentenceDetector` option.
- **Not a tokenizer.** Token counting uses a pluggable counter. The built-in approximate counter divides character count by 4. For exact token counts, the caller provides a token counting function wrapping `tiktoken` or an equivalent.
- **Not a retrieval evaluator.** This package does not measure whether recommended overlaps improve retrieval metrics (precision, recall, MRR). That evaluation requires query/answer pairs and a retrieval system. This package evaluates boundary quality from the text alone.

---

## 3. Target Users and Use Cases

### RAG Pipeline Tuners

Developers who have built a RAG pipeline with a fixed overlap value (50, 100, or 200 tokens) and want to know whether that value is appropriate for their document corpus. They run `recommend(chunks)` against a sample of their chunked documents, inspect the `OverlapRecommendation`, and update their chunking configuration with a value grounded in the actual content rather than a heuristic. A typical integration: chunk a document with `chunk-smart` at overlap=0, pass the resulting chunks to `recommend`, re-chunk with the recommended overlap.

### Document Ingestion Pipeline Owners

Teams ingesting diverse document corpora (technical documentation, legal documents, research papers, customer support articles) where document style and sentence length vary widely. Different document types may need different overlap values. They use `createAnalyzer` once and call `recommend(chunks)` per document type, building a corpus-specific overlap profile. Documents with long, dense sentences (legal text) receive a higher recommended overlap than documents with short, declarative sentences (FAQ pages).

### Chunk Quality Auditors

Engineers auditing an existing chunk corpus for boundary quality. They run `analyze(chunks)` over the full corpus, inspect the `boundaries` array sorted by quality score ascending, identify the worst boundaries (lowest quality scores), and trace them back to source documents for investigation. The problem boundary report highlights the exact text at each boundary, the detected sentence fragments, and the overlap needed to fix each split.

### CI/CD Quality Gate Operators

Teams building automated quality gates for their document ingestion pipelines. They integrate `recommend` into a CI job: if the current overlap is below the 80th-percentile coverage value computed from a sample corpus, the pipeline fails. The CLI exit code (non-zero when the current overlap is inadequate) enables shell-script integration without writing custom JavaScript.

### Chunking Configuration Researchers

Developers experimenting with different chunking strategies (fixed size, semantic, structure-aware) who want an objective boundary quality metric to compare strategies. By running `analyze(chunksFromStrategyA)` and `analyze(chunksFromStrategyB)`, they compare average boundary quality scores, histogram distributions, and problem boundary counts -- a quantitative basis for strategy selection.

---

## 4. Core Concepts

### Chunk

A chunk is a string of text that is a contiguous segment of a larger document, produced by a chunker such as `chunk-smart`. In `chunk-overlap-optimizer`, chunks are plain strings. The package does not require metadata -- only the text content. When analyzing a corpus produced by `chunk-smart`, the `chunk.content` field is passed in as the chunk string.

### Boundary

A boundary is the junction between two consecutive chunks: the end of chunk N and the start of chunk N+1. A corpus of K chunks has K-1 boundaries. Each boundary is analyzed independently to assess its quality and compute the minimum overlap needed to improve it. The boundary is characterized by two text windows: the tail of chunk N (the last M tokens) and the head of chunk N+1 (the first M tokens), where M is configurable (default: 128 tokens). These windows contain the text that a better overlap would duplicate.

### Sentence Boundary

A sentence boundary is a position in the text where one sentence ends and the next begins. Sentence boundaries are natural, high-quality chunk split points because neither chunk starts or ends mid-thought. The key question at each chunk boundary is whether the chunk boundary aligns with a sentence boundary. When they coincide, the boundary quality is high. When the chunk boundary falls inside a sentence (mid-sentence split), the quality is low and overlap is needed.

### Boundary Quality Score

The boundary quality score is a number in [0.0, 1.0] that measures how well the chunk boundary aligns with natural sentence structure. A score of 1.0 means the boundary falls exactly at a sentence boundary: chunk N ends with sentence-final punctuation (or a paragraph break), and chunk N+1 starts at the beginning of a new sentence. A score of 0.0 means the boundary falls mid-word. Intermediate scores represent partial alignment: a boundary that falls mid-sentence but at a clause break scores around 0.4-0.6; a boundary that falls between a complete sentence and an abbreviation ("Dr.") that interrupted sentence detection scores around 0.7-0.8. The score is the primary metric for assessing chunk corpus quality.

### Boundary Quality Score Rubric

| Score Range | Interpretation | Example |
|-------------|---------------|---------|
| 0.9 -- 1.0 | Perfect break. Sentence-final punctuation at tail end; new sentence at head start. | Chunk ends `...completes the handshake.` / next starts `The client then sends...` |
| 0.7 -- 0.9 | Good break. Paragraph break or strong punctuation, but minor irregularities. | Chunk ends at a list item boundary or after a heading. |
| 0.5 -- 0.7 | Acceptable break. Boundary falls at a clause or phrase boundary, not a full sentence break. | Chunk ends `...which enables` / next starts `the system to verify...` |
| 0.3 -- 0.5 | Poor break. Boundary falls mid-sentence with no punctuation near the boundary. | Chunk ends `...the authentication token is` / next starts `stored in the secure...` |
| 0.0 -- 0.3 | Critical break. Boundary falls mid-word or immediately after a word with no surrounding context. | Chunk ends `...authen` / next starts `tication...` (forced character split) |

### Overlap

Overlap is the intentional duplication of tokens from the end of one chunk at the beginning of the next. An overlap of 50 tokens means the last 50 tokens of chunk N are prepended to chunk N+1. The purpose of overlap is to ensure that complete sentences appear in at least one chunk even when the boundary falls mid-sentence. The `chunk-overlap-optimizer` recommends an overlap value in tokens (or characters, when `sizeUnit: 'chars'` is configured) that is sufficient to cover the interrupted sentence at each analyzed boundary.

### Minimum Overlap for a Boundary

The minimum overlap for a single boundary is the number of tokens from the end of chunk N that must be included in chunk N+1 (or vice versa) to ensure that both the preceding and following sentence fragments are complete in at least one chunk. This is computed as the number of tokens from the start of the interrupted sentence to the chunk boundary, measured in the tail window of chunk N. If the boundary is already at a sentence break, the minimum overlap is 0 (no repair needed). If the boundary falls mid-sentence 40 tokens into the sentence, the minimum overlap is 40 tokens.

### Overlap Recommendation

The overlap recommendation is the single overlap value that a caller should configure in their chunking pipeline. It is derived from the distribution of minimum-overlap values across all analyzed boundaries, computed at a configurable percentile. The default 90th-percentile recommendation means that 90% of all boundaries are adequately covered by the recommended overlap. The recommendation includes the value, its unit, a confidence score derived from the consistency of the boundary distribution, and the full per-boundary analysis.

### Overlap Histogram

The overlap histogram is a frequency distribution of minimum-overlap values across all boundaries. Boundaries are bucketed by their minimum overlap requirement (e.g., [0-10], [11-25], [26-50], [51-100], [101+] tokens). The histogram reveals the shape of the distribution: if most boundaries cluster near 0 (good sentence-boundary alignment), a small overlap suffices. If the distribution is bimodal (many boundaries near 0, many near 100), the chunker is sometimes splitting at good boundaries and sometimes at very bad ones -- a sign that the chunking strategy needs review, not just overlap tuning.

### Semantic Continuity Score

The semantic continuity score is an optional per-boundary metric computed when the caller provides an embedding function. It measures the cosine similarity between the embedding of the tail of chunk N and the embedding of the head of chunk N+1. High similarity (> 0.85) means the tail and head are semantically related -- the boundary is cutting through content that the embedding model considers cohesive. Low similarity (< 0.5) means the boundary falls between topically distinct passages, and overlap is less critical at this boundary. The semantic continuity score complements the structural quality score: a boundary can have a high structural quality score (good sentence break) but a high semantic continuity score (the two sentences on either side are tightly related), suggesting that overlap is still beneficial there.

---

## 5. Boundary Analysis

Boundary analysis is the core computation that `chunk-overlap-optimizer` performs on each pair of consecutive chunks. For each of the K-1 boundaries in the corpus, the analyzer computes a `BoundaryAnalysis` object containing all per-boundary metrics.

### 5.1 Text Window Extraction

Before any analysis begins, the analyzer extracts two text windows at each boundary:

- **Tail window**: The last `windowSize` tokens (default: 128) of chunk N. This is the text immediately before the boundary.
- **Head window**: The first `windowSize` tokens of chunk N+1. This is the text immediately after the boundary.

The windows are extracted using the configured token counter. If the chunk is shorter than `windowSize` tokens, the entire chunk is used. The windows are used for sentence detection, quality scoring, and embedding similarity computation.

### 5.2 Sentence Boundary Detection at Each Edge

The analyzer runs the sentence detector on the tail window and the head window independently. For the tail window, it identifies the last complete sentence and the fragment that follows (the text from the last sentence boundary to the end of the tail). For the head window, it identifies the first complete sentence and the fragment that precedes it (the text from the start of the head to the first sentence boundary).

These two fragments are the core of the boundary analysis:

- **Tail fragment**: The text from the last sentence boundary in the tail to the end of chunk N. If the chunk ends at a sentence boundary, the tail fragment is empty (length 0).
- **Head fragment**: The text from the start of chunk N+1 to the first sentence boundary in the head. If the chunk starts at a sentence boundary, the head fragment is empty.

When both tail fragment and head fragment are non-empty, the boundary has interrupted a sentence: the tail fragment is the end of a sentence that started before the boundary, and the head fragment is the beginning of that same (or a related) sentence that continues after the boundary.

### 5.3 Mid-Sentence Detection and Minimum Overlap

A boundary is classified as a **mid-sentence split** when the tail fragment is non-empty (chunk N ends mid-sentence). The **minimum overlap** for this boundary is the length of the tail fragment in tokens: including this many tokens from the end of chunk N in the beginning of chunk N+1 ensures that the interrupted sentence appears complete in chunk N+1.

A boundary where only the head fragment is non-empty (chunk N+1 starts mid-sentence) requires no structural overlap from chunk N's perspective, because the complete beginning of the sentence is already in chunk N. However, this situation (head starts with a sentence continuation) indicates a poor split from the other direction and is flagged in the analysis with a `headContinuation: true` field.

A boundary where both fragments are empty is a **clean boundary**: the chunk ends at a sentence boundary and the next chunk starts at a sentence boundary. The minimum overlap for a clean boundary is 0.

### 5.4 Mid-Paragraph Detection

Paragraphs (separated by `\n\n` or equivalent) are coarser natural breaks than sentences. The analyzer also detects whether the boundary falls inside a paragraph (mid-paragraph) or at a paragraph boundary. A boundary that interrupts a paragraph but aligns with a sentence receives a moderate quality score. A boundary that interrupts a paragraph mid-sentence receives a low quality score (the mid-sentence penalty compounds the mid-paragraph penalty).

Mid-paragraph detection is performed by scanning the tail window for double-newline sequences. If the last double-newline in the tail window is before the last sentence boundary, the boundary is within the final paragraph of the tail -- a mid-paragraph split.

### 5.5 Quality Score Computation

The boundary quality score is computed from four components, combined into a weighted sum:

| Component | Weight | Description |
|-----------|--------|-------------|
| Sentence alignment | 0.55 | 1.0 if boundary falls at a sentence boundary; decreases linearly with tail fragment length as a fraction of average sentence length. |
| Head start alignment | 0.20 | 1.0 if chunk N+1 starts at a sentence boundary; 0.5 if it starts mid-sentence. |
| Paragraph alignment | 0.15 | 1.0 if boundary falls at a paragraph boundary; 0.6 if mid-paragraph but sentence-aligned; 0.0 if mid-sentence within a paragraph. |
| Fragment symmetry | 0.10 | 1.0 if both fragments are empty (clean break); scaled by min(tailLen, headLen) / max(tailLen, headLen) otherwise (penalizes very asymmetric splits where one side is a long fragment). |

The weighted sum produces a raw score in [0.0, 1.0]. The raw score is then floored by the split-severity floor:

- If the boundary falls mid-word (no whitespace at the split point), the score is clamped to at most 0.1.
- If the tail fragment is longer than 75% of the average sentence length in the corpus, the score is clamped to at most 0.35.

### 5.6 Semantic Continuity Scoring (Optional)

When an `embedFn` is provided in the options, the analyzer computes embeddings for the tail window and head window of each boundary and derives a cosine similarity score.

```
semanticContinuity = cosineSimilarity(embed(tailWindow), embed(headWindow))
```

This score is stored on the `BoundaryAnalysis` object as `semanticContinuity` (a number in [0.0, 1.0]). The semantic continuity score does not affect the quality score or the minimum overlap computation directly. It is provided as an additional signal: a high continuity score at a boundary with a high structural quality score indicates that even though the boundary is structurally clean, the semantic relationship across the boundary is strong enough that overlap would improve retrieval at this boundary.

The `adjustedOverlap` field on `BoundaryAnalysis` incorporates the semantic signal: when semantic continuity is high (> `semanticBoostThreshold`, default 0.80) and the structural minimum overlap is less than a full sentence length, the adjusted overlap is boosted by a configurable factor (default: 1.3x). When semantic continuity is low (< 0.5) and the structural minimum overlap is non-zero, the adjusted overlap is not reduced -- structural sentence integrity always takes precedence.

---

## 6. Overlap Recommendation Algorithm

The overlap recommendation is computed from the per-boundary analysis in five steps.

### Step 1: Analyze All Boundaries

Run the boundary analysis on all K-1 boundaries in the chunk array. This produces K-1 `BoundaryAnalysis` objects, each containing:

- `qualityScore`: number in [0, 1]
- `minOverlap`: minimum overlap in tokens to cover the interrupted sentence
- `adjustedOverlap`: minimum overlap adjusted for semantic continuity (if embeddings provided)
- `tailFragmentTokens`: length of the tail fragment in tokens
- `headFragmentTokens`: length of the head fragment in tokens
- `isMidSentence`: boolean
- `isMidParagraph`: boolean
- `semanticContinuity?`: cosine similarity (if embeddings provided)

### Step 2: Compute Overlap Requirements per Boundary

For each boundary, the overlap requirement used in the aggregate computation is:

- `adjustedOverlap` if embedding similarity was computed.
- `minOverlap` otherwise.

Clean boundaries (minOverlap = 0, high quality score) contribute a requirement of 0. This is correct: the recommendation should not be inflated by clean boundaries, which do not need overlap.

### Step 3: Build the Overlap Histogram

Bucket the overlap requirements across all boundaries:

```
Bucket 0:  [0]        -- clean boundaries needing no overlap
Bucket 1:  [1-10]     -- very short fragments
Bucket 2:  [11-25]    -- short sentence fragments
Bucket 3:  [26-50]    -- medium sentence fragments
Bucket 4:  [51-100]   -- long sentence fragments
Bucket 5:  [101-150]  -- very long sentences
Bucket 6:  [151+]     -- extreme cases (very long sentences or paragraphs)
```

The histogram is included verbatim in the `OverlapRecommendation` output.

### Step 4: Compute the Recommended Overlap at the Configured Percentile

Sort all overlap requirements ascending. The recommended overlap is the value at the configured percentile position (default: 90th percentile).

```
sortedRequirements = sort(overlapRequirements ascending)
index = Math.ceil(percentile / 100 * sortedRequirements.length) - 1
recommendedOverlap = sortedRequirements[index]
```

The recommended overlap is then rounded up to the nearest word boundary (the next position in the tail window that corresponds to the end of a complete word), so that the overlap region does not end mid-word.

**Percentile semantics**: The 90th-percentile recommendation means that 90% of all boundaries are covered by the recommended overlap. The remaining 10% have sentence fragments longer than the recommended overlap -- these are the problem boundaries. A higher percentile (e.g., 95th) covers more boundaries but may recommend a larger overlap that wastes tokens. A lower percentile (e.g., 75th) is more token-efficient but leaves more boundaries poorly covered. The percentile is configurable as `targetPercentile` (default: 90).

### Step 5: Compute Confidence and Report

The confidence score reflects how consistent the overlap requirements are across boundaries. It is computed as:

```
meanReq   = mean(overlapRequirements)
stddevReq = stddev(overlapRequirements)
cv        = stddevReq / (meanReq + 1)   -- coefficient of variation (avoid division by zero)
confidence = 1 / (1 + cv)
```

- **High confidence (> 0.8)**: Boundaries are consistent. The recommended overlap will perform well across the corpus. A corpus where most boundaries need 40-60 tokens of overlap produces high confidence.
- **Medium confidence (0.5 -- 0.8)**: Moderate variability. The recommendation is valid but some boundaries will be over-covered and others under-covered. Consider using a higher percentile.
- **Low confidence (< 0.5)**: High variability. The corpus has both clean boundaries (needing 0 overlap) and very bad boundaries (needing 100+ tokens). A single overlap value cannot serve all boundaries well. Consider reviewing the chunking strategy to produce more consistent boundary quality before tuning overlap.

The `OverlapRecommendation` also includes:

- `currentOverlapComparison`: when `currentOverlap` is provided, a structured comparison object indicating whether the current overlap is `adequate`, `insufficient`, or `excessive`, by how many tokens it differs from the recommendation, and the percentile coverage it achieves.
- `problemBoundaries`: the N boundaries with the lowest quality scores (N = `problemBoundaryCount` option, default: 5), sorted ascending by quality score. These are the splits most in need of attention.
- `averageQualityScore`: the mean quality score across all boundaries. A corpus-level quality metric independent of the recommended overlap.

---

## 7. Sentence Boundary Detection

### 7.1 Rule-Based Detection

The sentence detector is a rule-based scanner that identifies sentence boundaries in a text window. It does not use a statistical model or neural network. The detector is fast (linear time), deterministic, and configurable.

The core algorithm scans for sentence-terminal punctuation sequences:

1. `.`, `!`, or `?` -- candidate sentence terminals.
2. Followed by one or more whitespace characters (space, tab, newline) or end-of-string.
3. Followed by an uppercase letter, a digit, a quote character, or end-of-string (for `.`, `!`, `?`).

When a candidate terminal is found, it is validated against a set of suppression rules that prevent false positives.

### 7.2 Abbreviation Handling

The most common source of false-positive sentence boundaries is abbreviations that contain a period. The detector maintains a built-in abbreviation list and suppresses sentence boundaries when the token before the period matches:

**Built-in abbreviations (always suppressed)**:

```
Titles:  Mr, Mrs, Ms, Dr, Prof, Sr, Jr, Rev, Gen, Sgt, Cpl, Pvt, Pte, Capt,
         Lt, Col, Maj, Brig, Adm
Geographic: St, Ave, Blvd, Rd, Dept, Corp, Inc, Ltd, Co, Gov
Latin/Academic: etc, al, approx, vs, cf, viz, e.g, i.e, op, cit, ibid
Months: Jan, Feb, Mar, Apr, Jun, Jul, Aug, Sep, Oct, Nov, Dec
Single letters: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S,
                T, U, V, W, X, Y, Z (initials in proper names)
```

When the token before the period matches any abbreviation (case-insensitive), the period is not treated as a sentence terminal, regardless of what follows.

**Configurable abbreviations**: The caller can supply additional abbreviations via `abbreviations: string[]` in the options. Custom abbreviations are merged with the built-in list.

### 7.3 Additional Suppression Rules

Beyond abbreviations, the detector suppresses sentence boundaries in the following cases:

- **Decimal numbers**: A period flanked by digits on both sides (`3.14`, `0.5`, `1,234.56`) is not a sentence boundary.
- **Ellipsis**: Three or more consecutive periods (`...`) are not sentence boundaries. The entire ellipsis sequence is consumed as a single token.
- **In-text URLs**: A period that is part of a URL pattern (`http://`, `www.`, `.com`, `.org`, `.io`, etc.) is not a sentence boundary.
- **In-text file paths**: A period in a file extension context (`.ts`, `.json`, `.md` following a word without spaces) is not a sentence boundary.
- **Quoted strings ending with punctuation**: A sentence-terminal punctuation mark followed by a closing quotation mark (`."`, `!'`, `?"`) is treated as a single terminal unit. The sentence boundary is placed after the closing quote.
- **Parenthetical endings**: Punctuation before a closing parenthesis (`.)`), when the parenthetical is not at the start of a line, is suppressed. The sentence boundary is placed after the closing parenthesis.

### 7.4 Sentence Boundary Positions

The detector returns an array of integer positions within the text window, each representing the index of the character immediately following a sentence boundary (the start of the next sentence). These positions are used to:

1. Find the last sentence boundary in the tail window (the end of the last complete sentence in the tail).
2. Find the first sentence boundary in the head window (the end of the first sentence fragment in the head).
3. Compute the tail fragment length: `tailWindowLength - lastSentenceBoundaryPos`.
4. Compute the head fragment length: `firstSentenceBoundaryPos` (positions of characters from head start to first boundary).

### 7.5 Paragraph Break Detection

Paragraph breaks (double newlines `\n\n`, or `\r\n\r\n`) are treated as strong sentence boundaries. When a paragraph break is detected, it is inserted into the sentence boundary position array at the appropriate position. The quality scoring treats a chunk boundary that aligns with a paragraph break as equivalent to a sentence boundary (both receive the maximum sentence alignment component in the quality score).

### 7.6 Custom Sentence Detector

The `sentenceDetector` option accepts a caller-supplied function that replaces the built-in rule-based detector. This enables integration with a statistical or neural sentence segmenter for corpora where the built-in rules are insufficient (e.g., OCR text, non-English text, scientific notation-heavy content).

```typescript
type SentenceDetectorFn = (text: string) => number[];
// Returns an array of positions immediately following each sentence boundary.
```

The custom detector is called with the tail window or head window text and must return an array of integer positions.

---

## 8. Embedding Similarity Analysis

### 8.1 How Embedding Analysis Works

When the caller provides an `embedFn` in the options, the analyzer computes embeddings for both sides of each boundary and measures their cosine similarity. The embedding function is called with a text string and returns a `Promise<number[]>` (a floating-point vector). All boundaries are analyzed concurrently (via `Promise.all`) unless `concurrency` is set to limit parallelism.

```typescript
type EmbedFn = (text: string) => Promise<number[]>;
```

The tail window and head window are passed to `embedFn` separately. The resulting vectors are used to compute:

```
semanticContinuity = dot(tailEmbedding, headEmbedding) / (norm(tailEmbedding) * norm(headEmbedding))
```

### 8.2 Interpreting Semantic Continuity

| Continuity Score | Interpretation |
|-----------------|----------------|
| 0.90 -- 1.00 | The tail and head are near-identical in meaning. The boundary cuts through highly cohesive content. Overlap is strongly beneficial. |
| 0.75 -- 0.90 | Strong semantic relationship. The boundary interrupts a connected discussion. Overlap is beneficial. |
| 0.55 -- 0.75 | Moderate relationship. The content is related but the boundary may be a reasonable topic transition. Overlap is mildly beneficial. |
| 0.30 -- 0.55 | Weak relationship. The boundary likely falls between topically distinct passages. Overlap is not critical. |
| 0.00 -- 0.30 | No significant semantic relationship. The boundary is a natural topic break. Overlap is unnecessary at this boundary. |

### 8.3 Semantic Boost to Recommended Overlap

When `adjustForSemantics: true` (default when `embedFn` is provided), boundaries with high semantic continuity scores receive an adjusted overlap boost:

```
if semanticContinuity > semanticBoostThreshold (default: 0.80):
  adjustedOverlap = minOverlap * semanticBoostFactor (default: 1.3)
else:
  adjustedOverlap = minOverlap
```

The adjusted overlap is capped at `maxOverlap` (default: 200 tokens) to prevent extreme recommendations from outlier boundaries. The `adjustedOverlap` values (not the `minOverlap` values) are used for the final histogram and recommendation computation when embedding analysis is enabled.

### 8.4 Embedding Function Integration

The `embedFn` is designed to accept any compatible function. Typical integrations:

```typescript
// OpenAI embeddings (via openai npm package)
import OpenAI from 'openai';
const client = new OpenAI();
const embedFn = async (text: string) => {
  const res = await client.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return res.data[0].embedding;
};

// embed-cache (in-process caching wrapper)
import { createEmbedCache } from 'embed-cache';
const cache = createEmbedCache({ provider: 'openai', model: 'text-embedding-3-small' });
const embedFn = (text: string) => cache.embed(text);
```

Embedding calls for boundary windows are deduplicated: if the same text window appears at multiple boundaries (e.g., short chunks where the same window is reused), each unique text is embedded only once.

---

## 9. API Surface

### Installation

```bash
npm install chunk-overlap-optimizer
```

### No Runtime Dependencies

`chunk-overlap-optimizer` has zero mandatory runtime dependencies. Sentence boundary detection, quality scoring, histogram computation, and overlap recommendation are implemented with Node.js built-in APIs. Embedding similarity analysis requires an externally provided function; no embedding SDK is bundled or depended upon.

### Primary Export: `recommend`

```typescript
import { recommend } from 'chunk-overlap-optimizer';

const chunks = [
  'The authentication token is stored securely. Each request must include',
  'the token in the Authorization header. Tokens expire after 24 hours.',
  'To refresh a token, call the /auth/refresh endpoint with the current token.',
];

const result = await recommend(chunks, {
  currentOverlap: 50,
  sizeUnit: 'tokens',
  targetPercentile: 90,
});

console.log(result.recommended);        // e.g., 38
console.log(result.unit);              // 'tokens'
console.log(result.confidence);        // e.g., 0.82
console.log(result.currentOverlapComparison.status);  // 'excessive'
console.log(result.averageQualityScore);              // e.g., 0.54
```

**Signature**:

```typescript
async function recommend(
  chunks: string[],
  options?: AnalyzerOptions,
): Promise<OverlapRecommendation>;
```

When no `embedFn` is provided, the function is effectively synchronous (all sentence detection is synchronous). It returns a `Promise` in all cases for API consistency.

### Secondary Export: `analyze`

```typescript
import { analyze } from 'chunk-overlap-optimizer';

const analysis = await analyze(chunks, options);

analysis.boundaries.forEach(b => {
  console.log(`Boundary ${b.index}: quality=${b.qualityScore.toFixed(2)}, minOverlap=${b.minOverlap}`);
});
```

**Signature**:

```typescript
async function analyze(
  chunks: string[],
  options?: AnalyzerOptions,
): Promise<OverlapAnalysis>;
```

`analyze` returns the full per-boundary analysis without computing the top-level recommendation. Use `analyze` when you need raw boundary data for custom aggregation, sorting, or visualization.

### Single-Boundary Export: `analyzeBoundary`

```typescript
import { analyzeBoundary } from 'chunk-overlap-optimizer';

const boundary = await analyzeBoundary(
  'The system verifies the token before',    // tail: end of chunk N
  'allowing access to protected resources.', // head: start of chunk N+1
  { windowSize: 64 },
);

console.log(boundary.qualityScore);   // 0.42 (mid-sentence split)
console.log(boundary.minOverlap);     // 8 (tokens needed to fix the split)
console.log(boundary.isMidSentence);  // true
```

**Signature**:

```typescript
async function analyzeBoundary(
  chunkEnd: string,
  nextChunkStart: string,
  options?: AnalyzerOptions,
): Promise<BoundaryAnalysis>;
```

`analyzeBoundary` is useful for testing the analyzer against specific text pairs, for debugging a known-problematic boundary, or for integration into custom analysis pipelines that supply tail/head text directly rather than full chunk arrays.

### Factory Export: `createAnalyzer`

```typescript
import { createAnalyzer } from 'chunk-overlap-optimizer';

const analyzer = createAnalyzer({
  sizeUnit: 'tokens',
  tokenCounter: myExactTokenCounter,
  targetPercentile: 95,
  windowSize: 128,
  abbreviations: ['API', 'SDK', 'e.g', 'i.e'],
});

const rec1 = await analyzer.recommend(docAChunks);
const rec2 = await analyzer.recommend(docBChunks);
const ana  = await analyzer.analyze(mixedChunks);
const bnd  = await analyzer.analyzeBoundary(tailText, headText);
```

**Signature**:

```typescript
function createAnalyzer(config: AnalyzerOptions): Analyzer;

interface Analyzer {
  recommend(chunks: string[], overrides?: Partial<AnalyzerOptions>): Promise<OverlapRecommendation>;
  analyze(chunks: string[], overrides?: Partial<AnalyzerOptions>): Promise<OverlapAnalysis>;
  analyzeBoundary(chunkEnd: string, nextChunkStart: string, overrides?: Partial<AnalyzerOptions>): Promise<BoundaryAnalysis>;
}
```

The `Analyzer` instance validates configuration at construction time and caches any pre-initialization (e.g., compiling abbreviation regex). The returned instance is stateless across calls -- each call is independent.

### TypeScript Type Definitions

```typescript
// ── Size and Unit ────────────────────────────────────────────────────

/** Unit of measurement for overlap values. */
type SizeUnit = 'tokens' | 'chars';

// ── Sentence Detector ────────────────────────────────────────────────

/**
 * A function that identifies sentence boundary positions in a text string.
 * Returns an array of integer positions, each the index of the first character
 * of a new sentence (i.e., the position immediately following a sentence boundary).
 * Positions are sorted ascending. An empty array means no sentence boundaries detected.
 */
type SentenceDetectorFn = (text: string) => number[];

// ── Embedding Function ───────────────────────────────────────────────

/**
 * A function that computes an embedding vector for a text string.
 * Returns a Promise resolving to a floating-point array (the embedding vector).
 */
type EmbedFn = (text: string) => Promise<number[]>;

// ── Options ──────────────────────────────────────────────────────────

/** Options for the analyzer functions and createAnalyzer factory. */
interface AnalyzerOptions {
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
   * A larger window improves sentence detection accuracy at the cost of
   * more text to process.
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
   * Prevents extreme outlier boundaries from inflating the recommendation
   * beyond a practical limit.
   * Default: 200 (tokens or chars, matching sizeUnit).
   */
  maxOverlap?: number;

  /**
   * Number of problem boundaries to include in the OverlapRecommendation.
   * Problem boundaries are the boundaries with the lowest quality scores.
   * Default: 5.
   */
  problemBoundaryCount?: number;

  /**
   * Additional abbreviations to suppress during sentence boundary detection.
   * Each string should be the text before the period (without the period).
   * Case-insensitive. Merged with the built-in abbreviation list.
   * Example: ['API', 'SDK', 'HTTP', 'URL'].
   * Default: [] (no additional abbreviations).
   */
  abbreviations?: string[];

  /**
   * Custom sentence boundary detection function.
   * When provided, replaces the built-in rule-based detector entirely.
   * Must return an array of positions where new sentences start.
   * Default: undefined (use built-in detector).
   */
  sentenceDetector?: SentenceDetectorFn;

  /**
   * Embedding function for optional semantic continuity analysis.
   * When provided, embeddings are computed for the tail and head windows
   * of each boundary, and cosine similarity is measured.
   * When absent, semantic continuity analysis is skipped.
   * Default: undefined (no semantic analysis).
   */
  embedFn?: EmbedFn;

  /**
   * Whether to use the semantic continuity score to adjust the per-boundary
   * overlap requirement. Only applies when embedFn is provided.
   * When true, boundaries with high semantic continuity receive boosted
   * overlap requirements (semanticBoostFactor applied to minOverlap).
   * Default: true (when embedFn is provided).
   */
  adjustForSemantics?: boolean;

  /**
   * The cosine similarity threshold above which a boundary's overlap
   * requirement is boosted by semanticBoostFactor.
   * Only applies when embedFn is provided and adjustForSemantics is true.
   * Default: 0.80.
   */
  semanticBoostThreshold?: number;

  /**
   * The multiplication factor applied to minOverlap when semantic continuity
   * exceeds semanticBoostThreshold.
   * Only applies when embedFn is provided and adjustForSemantics is true.
   * Default: 1.3.
   */
  semanticBoostFactor?: number;

  /**
   * Maximum number of concurrent embedding requests when computing semantic
   * continuity. Only applies when embedFn is provided.
   * Default: 8.
   */
  concurrency?: number;

  /**
   * The current overlap value used in the chunk corpus being analyzed.
   * When provided, the OverlapRecommendation includes a currentOverlapComparison
   * object indicating whether the current overlap is adequate, insufficient,
   * or excessive relative to the recommendation.
   * Default: undefined (no comparison performed).
   */
  currentOverlap?: number;
}

// ── Boundary Analysis ────────────────────────────────────────────────

/** Analysis of a single inter-chunk boundary. */
interface BoundaryAnalysis {
  /**
   * Zero-based index of this boundary in the corpus.
   * Boundary i is the junction between chunk[i] and chunk[i+1].
   * Not present when calling analyzeBoundary() directly.
   */
  index?: number;

  /**
   * Quality score for this boundary, in the range [0.0, 1.0].
   * Higher is better. 1.0 = perfect natural break. 0.0 = mid-word split.
   */
  qualityScore: number;

  /**
   * True if chunk N ends mid-sentence (the tail fragment is non-empty).
   * The boundary interrupts a sentence that started in chunk N.
   */
  isMidSentence: boolean;

  /**
   * True if chunk N+1 starts mid-sentence (the head fragment is non-empty
   * and does not start at a sentence boundary).
   */
  headContinuation: boolean;

  /**
   * True if the boundary falls in the middle of a paragraph (the tail window
   * does not contain a paragraph break after the last sentence boundary).
   */
  isMidParagraph: boolean;

  /**
   * The last windowSize tokens (or chars) of chunk N, used for analysis.
   */
  tailWindow: string;

  /**
   * The first windowSize tokens (or chars) of chunk N+1, used for analysis.
   */
  headWindow: string;

  /**
   * The text of the tail fragment: the text from the last sentence boundary
   * in the tail window to the end of chunk N.
   * Empty string when the chunk ends at a sentence boundary.
   */
  tailFragment: string;

  /**
   * Length of the tail fragment in the configured sizeUnit (tokens or chars).
   */
  tailFragmentSize: number;

  /**
   * The text of the head fragment: the text from the start of chunk N+1
   * to the first sentence boundary in the head window.
   * Empty string when the chunk starts at a sentence boundary.
   */
  headFragment: string;

  /**
   * Length of the head fragment in the configured sizeUnit.
   */
  headFragmentSize: number;

  /**
   * Minimum overlap, in the configured sizeUnit, needed to include the complete
   * interrupted sentence in chunk N+1. Equal to tailFragmentSize.
   * 0 when the boundary is clean (isMidSentence is false).
   */
  minOverlap: number;

  /**
   * Overlap requirement adjusted for semantic continuity.
   * Equal to minOverlap when no embedFn was provided or adjustForSemantics is false.
   * May be higher than minOverlap when semantic continuity is high.
   */
  adjustedOverlap: number;

  /**
   * Cosine similarity between the embedding of tailWindow and headWindow.
   * Present only when embedFn was provided.
   * Range: [0.0, 1.0]. Higher means the tail and head are semantically related.
   */
  semanticContinuity?: number;

  /**
   * Detected sentence boundary positions within the tail window.
   * Each value is the index of the first character of a new sentence.
   */
  tailSentenceBoundaries: number[];

  /**
   * Detected sentence boundary positions within the head window.
   */
  headSentenceBoundaries: number[];
}

// ── Overlap Analysis ─────────────────────────────────────────────────

/** Full per-boundary analysis of a chunk array. */
interface OverlapAnalysis {
  /** Array of per-boundary analysis objects, one per inter-chunk boundary. */
  boundaries: BoundaryAnalysis[];

  /** Total number of boundaries analyzed (equal to chunks.length - 1). */
  boundaryCount: number;

  /** Number of boundaries with isMidSentence = true. */
  midSentenceCount: number;

  /**
   * Fraction of boundaries that are mid-sentence splits.
   * midSentenceCount / boundaryCount.
   */
  midSentenceRate: number;

  /** Mean quality score across all boundaries. */
  averageQualityScore: number;

  /** Median quality score across all boundaries. */
  medianQualityScore: number;

  /** The options used for this analysis (resolved defaults applied). */
  options: Required<AnalyzerOptions>;

  /** ISO 8601 timestamp of when the analysis was performed. */
  timestamp: string;

  /** Wall-clock time for the analysis in milliseconds. */
  durationMs: number;
}

// ── Overlap Histogram ────────────────────────────────────────────────

/** One bucket in the overlap requirement histogram. */
interface HistogramBucket {
  /** Lower bound of this bucket (inclusive), in sizeUnit. */
  min: number;

  /** Upper bound of this bucket (exclusive), in sizeUnit. Infinity for the last bucket. */
  max: number;

  /** Number of boundaries in this bucket. */
  count: number;

  /** Fraction of all boundaries in this bucket (count / totalBoundaries). */
  fraction: number;

  /**
   * Human-readable label for this bucket.
   * Example: "0 tokens (clean)", "1-10", "11-25", "101+".
   */
  label: string;
}

// ── Current Overlap Comparison ────────────────────────────────────────

/** Comparison of the current overlap against the recommendation. */
interface OverlapComparison {
  /**
   * 'adequate': currentOverlap >= recommended (within a 5% tolerance).
   * 'insufficient': currentOverlap is meaningfully below recommended.
   * 'excessive': currentOverlap is meaningfully above recommended.
   */
  status: 'adequate' | 'insufficient' | 'excessive';

  /** The current overlap value provided in options. */
  current: number;

  /** The recommended overlap. */
  recommended: number;

  /** The difference (current - recommended). Negative means insufficient. */
  delta: number;

  /**
   * The percentile of boundaries covered by the current overlap.
   * E.g., if currentOverlap = 30 and 75% of boundaries have minOverlap <= 30,
   * this is 75. Useful for understanding the coverage of the current setting.
   */
  currentPercentileCoverage: number;
}

// ── Overlap Recommendation ────────────────────────────────────────────

/** The top-level recommendation returned by recommend(). */
interface OverlapRecommendation {
  /**
   * The recommended overlap value, in the configured sizeUnit.
   * Derived from the targetPercentile of the overlap requirement distribution.
   */
  recommended: number;

  /** The unit of the recommended value. */
  unit: SizeUnit;

  /**
   * Confidence score for the recommendation, in [0, 1].
   * Higher confidence means the boundary overlap requirements are consistent,
   * so the recommendation is reliable.
   * Lower confidence means high variability across boundaries.
   */
  confidence: number;

  /**
   * The percentile used to compute the recommendation.
   * Matches targetPercentile from options (default: 90).
   */
  targetPercentile: number;

  /** Mean quality score across all boundaries in the analyzed corpus. */
  averageQualityScore: number;

  /** Full per-boundary analysis, sorted by index ascending. */
  boundaries: BoundaryAnalysis[];

  /** Overlap requirement histogram. */
  histogram: HistogramBucket[];

  /**
   * The N lowest-quality boundaries (sorted by qualityScore ascending).
   * N = problemBoundaryCount option (default: 5).
   * These are the boundaries most in need of structural improvement.
   */
  problemBoundaries: BoundaryAnalysis[];

  /**
   * Comparison of the currentOverlap against the recommendation.
   * Present only when currentOverlap was provided in options.
   */
  currentOverlapComparison?: OverlapComparison;

  /** Total number of chunks analyzed. */
  chunkCount: number;

  /** Total number of boundaries analyzed (chunkCount - 1). */
  boundaryCount: number;

  /** ISO 8601 timestamp of when recommend() was called. */
  timestamp: string;

  /** Wall-clock time for the full recommendation in milliseconds. */
  durationMs: number;
}
```

---

## 10. Analysis Report

The `OverlapRecommendation` returned by `recommend()` is the primary observability artifact of `chunk-overlap-optimizer`. It answers the question "what overlap should I use, and why?" with enough detail to justify the recommendation, identify the worst boundaries, and guide decisions about whether to change the overlap or fix the underlying chunking strategy.

### Reading the Report

**`recommended` and `confidence`**

The recommended overlap is the headline result. Use it directly as the `overlap` parameter in your next `chunk-smart` call. The confidence score qualifies that number: high confidence (> 0.8) means the recommendation will serve the corpus well; low confidence (< 0.5) means the corpus has such varied boundary quality that no single overlap value is a good fit.

**`averageQualityScore`**

This is the first diagnostic to read. A high average quality score (> 0.75) means most boundaries are already good -- the chunker is producing clean splits, and overlap is a refinement. A low average quality score (< 0.40) means the chunker is frequently splitting mid-sentence across the entire corpus. In this case, the problem is not overlap -- it is the chunking strategy. Fix the chunking first (switch from fixed-size to sentence-aware splitting, or use `chunk-smart`'s structure-aware chunking), then re-analyze.

**`histogram`**

Read the histogram to understand the distribution shape. A healthy distribution has most boundaries in the 0-25 token bucket (clean or short-fragment boundaries) with a long tail. An unhealthy distribution has a bimodal shape: many boundaries at 0 and many at 50+. The bimodal shape means the chunker is mixing good and bad boundary placement -- possibly a sign that the `maxChunkSize` is mismatched to the natural paragraph length in the corpus, causing some splits to land at paragraph breaks (clean) and others to fall mid-sentence (bad).

**`problemBoundaries`**

The problem boundaries are the lowest-scoring boundaries in the corpus. Each problem boundary includes the `tailWindow` and `headWindow` text, making it easy to inspect exactly where the boundary falls. The `tailFragment` and `headFragment` fields show the fragments on each side of the cut. Use these for manual review: are these boundaries unavoidable (the chunk size is smaller than the longest sentence)? Or are they happening in easy-to-fix places (a code comment or a short heading getting split)?

**`currentOverlapComparison`**

When `currentOverlap` is provided, the comparison status tells you whether your current setting is adequate. An `'insufficient'` status means you are losing sentence context at `currentPercentileCoverage`% of boundaries but missing the rest. An `'excessive'` status means you are duplicating more text than necessary, wasting index space and embedding capacity.

### Report Example

```typescript
{
  recommended: 42,
  unit: 'tokens',
  confidence: 0.76,
  targetPercentile: 90,
  averageQualityScore: 0.61,
  chunkCount: 47,
  boundaryCount: 46,
  histogram: [
    { min: 0,   max: 1,   count: 12, fraction: 0.261, label: '0 (clean)' },
    { min: 1,   max: 11,  count: 7,  fraction: 0.152, label: '1-10' },
    { min: 11,  max: 26,  count: 9,  fraction: 0.196, label: '11-25' },
    { min: 26,  max: 51,  count: 11, fraction: 0.239, label: '26-50' },
    { min: 51,  max: 101, count: 5,  fraction: 0.109, label: '51-100' },
    { min: 101, max: 151, count: 2,  fraction: 0.043, label: '101-150' },
    { min: 151, max: Infinity, count: 0, fraction: 0.000, label: '151+' },
  ],
  problemBoundaries: [
    {
      index: 23,
      qualityScore: 0.21,
      isMidSentence: true,
      tailFragment: 'Authentication tokens issued by the identity provider must be validated against',
      tailFragmentSize: 14,
      minOverlap: 14,
      adjustedOverlap: 14,
      // ...
    },
    // ...4 more problem boundaries
  ],
  currentOverlapComparison: {
    status: 'insufficient',
    current: 25,
    recommended: 42,
    delta: -17,
    currentPercentileCoverage: 67,
  },
  timestamp: '2026-03-18T10:14:22.003Z',
  durationMs: 18,
  boundaries: [ /* 46 BoundaryAnalysis objects */ ],
}
```

---

## 11. Configuration Reference

All options with their defaults:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sizeUnit` | `'tokens' \| 'chars'` | `'tokens'` | Unit for all overlap measurements. |
| `tokenCounter` | `(text: string) => number` | `Math.ceil(text.length / 4)` | Token counting function. |
| `windowSize` | `number` | `128` | Token/char window extracted from each side of a boundary. |
| `targetPercentile` | `number` | `90` | Percentile of boundary overlap distribution for the recommendation. |
| `maxOverlap` | `number` | `200` | Hard cap on the recommended overlap. |
| `problemBoundaryCount` | `number` | `5` | Number of worst boundaries to include in the report. |
| `abbreviations` | `string[]` | `[]` | Extra abbreviations to suppress during sentence detection. |
| `sentenceDetector` | `SentenceDetectorFn` | built-in rule-based | Custom sentence boundary detection function. |
| `embedFn` | `EmbedFn` | `undefined` | Embedding function for semantic continuity analysis. |
| `adjustForSemantics` | `boolean` | `true` (when `embedFn` set) | Boost overlap requirements for high-continuity boundaries. |
| `semanticBoostThreshold` | `number` | `0.80` | Cosine similarity threshold above which boost is applied. |
| `semanticBoostFactor` | `number` | `1.3` | Multiplier applied to `minOverlap` for high-continuity boundaries. |
| `concurrency` | `number` | `8` | Max concurrent `embedFn` calls. |
| `currentOverlap` | `number` | `undefined` | Current overlap for comparison reporting. |

---

## 12. CLI Interface

### Installation and Invocation

```bash
# Global install
npm install -g chunk-overlap-optimizer
chunk-overlap-optimizer chunks.json

# npx (no install required)
npx chunk-overlap-optimizer --percentile 95 --window 64 < chunks.json

# As a pipeline stage
chunk-smart --max-size 512 --format json document.md | chunk-overlap-optimizer
```

### Input Formats

The CLI accepts two input formats:

**JSON array of chunk strings**: A JSON file or stdin stream containing a JSON array where each element is a chunk content string.

```json
[
  "The authentication service validates credentials against the user database.",
  "Each validation request checks the provided token signature and expiration time.",
  "Expired tokens are rejected immediately with a 401 Unauthorized response."
]
```

**`chunk-smart` JSON output**: A JSON array of `Chunk` objects (as produced by `chunk-smart --format json`). The CLI extracts the `content` field from each object automatically.

```json
[
  { "content": "The authentication service...", "metadata": { "index": 0 } },
  { "content": "Each validation request...", "metadata": { "index": 1 } }
]
```

The CLI auto-detects the format: if the first array element is a string, it is treated as a plain chunk string array; if it is an object, the `content` field is extracted.

### Flags

```
chunk-overlap-optimizer [file] [options]

Input:
  [file]                    Path to JSON file containing chunks. Reads from stdin if not provided.

Analysis options:
  --percentile <n>          Target percentile for the recommendation (1-99). Default: 90.
  --window <n>              Window size in tokens/chars to analyze at each boundary. Default: 128.
  --unit <unit>             Size unit: tokens, chars. Default: tokens.
  --current-overlap <n>     Current overlap to compare against the recommendation.
  --max-overlap <n>         Maximum overlap value the recommendation can return. Default: 200.

Sentence detection options:
  --abbrev <word,...>       Comma-separated additional abbreviations (without periods).
                            Example: --abbrev API,SDK,HTTP

Output options:
  --format <format>         Output format: json, text. Default: text.
                            text: human-readable summary with recommendation and problem boundaries.
                            json: full OverlapRecommendation object as JSON.
  --pretty                  Pretty-print JSON output (when --format json).
  --boundaries              Include full per-boundary analysis in JSON output (large output).
  --histogram               Show the overlap requirement histogram (text format) or
                            include it explicitly (JSON format already includes it).
  --problem-count <n>       Number of problem boundaries to show. Default: 5.

General:
  --version                 Print version and exit.
  --help                    Print help and exit.
```

### Text Output Format

The default human-readable text output provides a concise summary:

```
chunk-overlap-optimizer analysis
================================
Chunks analyzed:     47
Boundaries analyzed: 46
Average quality:     0.61 (moderate -- some mid-sentence splits)
Mid-sentence rate:   39.1%

RECOMMENDATION: 42 tokens overlap (90th percentile)
Confidence:     0.76 (medium)

Current overlap: 25 tokens -- INSUFFICIENT
  Covers 67% of boundaries. Recommendation covers 90%.
  Increase by 17 tokens to reach the recommended level.

Overlap distribution:
  0 (clean)    ██████████████  12  (26.1%)
  1-10         ████████        7   (15.2%)
  11-25        ██████████      9   (19.6%)
  26-50        ████████████    11  (23.9%)
  51-100       █████           5   (10.9%)
  101-150      ██              2   ( 4.3%)
  151+         0               0   ( 0.0%)

Problem boundaries (lowest quality):
  #23  quality=0.21  minOverlap=14  "...must be validated against | the identity provider..."
  #31  quality=0.28  minOverlap=22  "...configured threshold the" | "system will reject..."
  #7   quality=0.33  minOverlap=9   "...each request includes the" | "Authorization header..."
  #18  quality=0.39  minOverlap=31  "...rate limiting policy" | "applied per API key..."
  #41  quality=0.44  minOverlap=5   "...as described in" | "Section 4.2 of the..."
```

### JSON Output Format

With `--format json`, the CLI outputs the full `OverlapRecommendation` object. With `--boundaries`, the full `boundaries` array (potentially large) is included.

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Analysis completed. The recommendation is valid. |
| `1` | Input error. File not found, unreadable, or not valid JSON. |
| `2` | Configuration error. Invalid option values or incompatible flags. |
| `3` | Insufficient input. Fewer than 2 chunks provided (no boundaries to analyze). |
| `4` | Current overlap is inadequate (only when `--current-overlap` is set and the comparison status is `'insufficient'`). Exit code 4 enables CI/CD gates: fail the pipeline when the current overlap falls below the recommendation. |

### CLI Usage Examples

```bash
# Analyze chunks from a file with default settings
chunk-overlap-optimizer chunks.json

# Analyze stdin chunks at 95th percentile
cat chunks.json | chunk-overlap-optimizer --percentile 95

# Compare current overlap of 50 tokens against recommendation
chunk-overlap-optimizer --current-overlap 50 chunks.json

# CI/CD gate: fail if current overlap is insufficient
chunk-overlap-optimizer --current-overlap 50 chunks.json; \
  [ $? -ne 4 ] || (echo "Overlap too low -- update chunk config" && exit 1)

# Output full JSON report with histogram and all boundaries
chunk-overlap-optimizer --format json --pretty --boundaries chunks.json

# Pipe chunk-smart output directly into the analyzer
chunk-smart document.md --max-size 512 --format json | chunk-overlap-optimizer

# Analyze with custom abbreviations for a medical corpus
chunk-overlap-optimizer --abbrev Dr,MD,PhD,Fig,Eq,No medical_chunks.json
```

---

## 13. Integration

### With `chunk-smart`

`chunk-overlap-optimizer` is designed as a post-processor for `chunk-smart` output. The recommended workflow is a two-pass chunking run:

1. **Pass 1**: Chunk the corpus with `overlap: 0` using `chunk-smart`. This produces chunks with clean, non-overlapping boundaries. Feed these chunks to `chunk-overlap-optimizer` to measure boundary quality with no overlap noise.
2. **Analyze**: Run `recommend(chunks)` on the pass-1 output to compute the optimal overlap.
3. **Pass 2**: Re-chunk the same corpus with `overlap: recommendation.recommended` to produce the final chunk set with optimized overlap.

```typescript
import { chunk } from 'chunk-smart';
import { recommend } from 'chunk-overlap-optimizer';

// Pass 1: chunk without overlap to measure boundary quality
const pass1Chunks = chunk(documentText, { maxChunkSize: 512, overlap: 0 });
const chunkContents = pass1Chunks.map(c => c.content);

// Analyze and recommend
const recommendation = await recommend(chunkContents, { targetPercentile: 90 });
console.log(`Recommended overlap: ${recommendation.recommended} tokens`);
console.log(`Confidence: ${recommendation.confidence.toFixed(2)}`);

// Pass 2: re-chunk with recommended overlap
const finalChunks = chunk(documentText, {
  maxChunkSize: 512,
  overlap: recommendation.recommended,
});
```

The `chunk-smart` SPEC explicitly references `chunk-overlap-optimizer` in its integration section as the tool to use for tuning the `overlap` parameter. The two packages are designed to work together as consecutive pipeline stages.

### With `embed-cache`

`embed-cache` provides a content-addressable embedding cache with TTL and deduplication. When embedding similarity analysis is needed, wrapping `embed-cache` around the embedding provider ensures that repeated analysis runs (e.g., analyzing the same corpus with different percentile thresholds) do not re-embed the same window text:

```typescript
import { createEmbedCache } from 'embed-cache';
import { recommend } from 'chunk-overlap-optimizer';

const cache = createEmbedCache({
  provider: 'openai',
  model: 'text-embedding-3-small',
  ttlSeconds: 3600,
});

const result = await recommend(chunks, {
  embedFn: (text) => cache.embed(text),
  adjustForSemantics: true,
  semanticBoostThreshold: 0.80,
});
```

Boundary window texts (128-token windows) are short, and `embed-cache`'s content-addressable caching means each unique window is embedded only once across repeated calls, reducing API cost.

### With Other Pipeline Packages

- **`context-packer`**: `chunk-overlap-optimizer` ensures chunks entering the retrieval pipeline have adequate overlap. `context-packer` selects and arranges retrieved chunks for the LLM context window. These solve different problems in the same pipeline and do not interact directly.
- **`rag-prompt-builder`**: Builds RAG prompts from packed chunks. The overlap quality of chunks (ensured by `chunk-overlap-optimizer`) affects the completeness of retrieved passages before `rag-prompt-builder` formats them.
- **`fusion-rank`**: Fuses results from multiple retrievers. Better chunk overlap (tuned by `chunk-overlap-optimizer`) produces better per-chunk embeddings, which improve all downstream retrieval metrics including the scores that `fusion-rank` combines.

---

## 14. Error Handling

### `AnalyzerError`

An `AnalyzerError` is thrown when the input or configuration is invalid. It extends `Error` with a `code` field for programmatic handling.

```typescript
class AnalyzerError extends Error {
  readonly code: AnalyzerErrorCode;
  readonly details?: Record<string, unknown>;
}

type AnalyzerErrorCode =
  | 'INSUFFICIENT_CHUNKS'     // fewer than 2 chunks provided (no boundaries)
  | 'INVALID_PERCENTILE'      // targetPercentile not in [1, 99]
  | 'INVALID_WINDOW_SIZE'     // windowSize <= 0
  | 'INVALID_MAX_OVERLAP'     // maxOverlap <= 0
  | 'EMBED_FN_ERROR'          // embedFn threw or returned invalid vector
  | 'INVALID_CHUNKS'          // chunks is not an array, or entries are not strings
  | 'INVALID_SENTENCE_DETECTOR' // sentenceDetector returned non-array or invalid positions
```

### Graceful Boundary Degradation

When `embedFn` throws on a specific boundary, the error is caught, the `semanticContinuity` field is set to `undefined` for that boundary, and analysis continues. The `adjustedOverlap` falls back to `minOverlap` for that boundary. The `OverlapAnalysis` result includes an `embedErrors` count field indicating how many boundaries encountered embedding failures.

---

## 15. Testing Strategy

### Unit Tests

Each component of the analyzer is tested in isolation with deterministic inputs.

**Sentence detector tests**:
- Verify sentence boundaries are detected correctly for standard prose: periods followed by capitalized words, exclamation marks, question marks.
- Verify abbreviation suppression: "Dr. Smith", "U.S.A.", "etc.", "vs.", "e.g.", single-letter initials ("J. Smith").
- Verify decimal number suppression: "3.14", "0.001", "1,234.56" are not sentence boundaries.
- Verify ellipsis handling: "Wait..." followed by "He said" produces one boundary after the ellipsis.
- Verify URL suppression: "Visit www.example.com. Then click" has one boundary (after the URL sentence, before "Then").
- Verify file extension suppression: "See index.ts for details." has one boundary.
- Verify paragraph break handling: double newlines are treated as sentence boundaries.
- Verify empty string input returns empty array.
- Verify single sentence with no terminal punctuation returns empty array.
- Verify custom abbreviation list merges correctly with built-in list.

**Quality score tests**:
- Clean boundary (both fragments empty): verify score >= 0.9.
- Mid-sentence boundary (tail fragment = 30 tokens, average sentence = 20 tokens): verify score <= 0.45.
- Paragraph break alignment: verify score > 0.85.
- Mid-word split: verify score <= 0.1.
- Verify all four components contribute according to their weights.
- Verify the split-severity floor clamps scores correctly.

**Minimum overlap computation tests**:
- Verify `minOverlap` equals `tailFragmentSize` when `isMidSentence` is true.
- Verify `minOverlap` is 0 for clean boundaries.
- Verify `adjustedOverlap` equals `minOverlap` when no `embedFn` is provided.
- Verify `adjustedOverlap` is boosted when `semanticContinuity > semanticBoostThreshold`.
- Verify `adjustedOverlap` is capped at `maxOverlap`.

**Histogram tests**:
- Verify all overlap requirements are correctly bucketed.
- Verify bucket counts sum to the total boundary count.
- Verify the 0-bucket contains only clean boundaries (minOverlap = 0).
- Verify the label field is human-readable and correct.

**Recommendation computation tests**:
- Given a known set of overlap requirements, verify the recommended value matches the correct percentile.
- Verify 50th-percentile recommendation is the median.
- Verify 100th-percentile is the maximum requirement.
- Verify rounding to word boundary.
- Verify `maxOverlap` cap is applied.

**Confidence score tests**:
- All requirements equal (zero variance): verify confidence = 1.0.
- All requirements wildly varying: verify confidence < 0.5.
- Moderate variance: verify confidence in [0.5, 0.8].

**Current overlap comparison tests**:
- `currentOverlap` >= `recommended` (within 5%): verify status = 'adequate'.
- `currentOverlap` below recommended: verify status = 'insufficient', `delta` is negative.
- `currentOverlap` above recommended by > 5%: verify status = 'excessive'.
- Verify `currentPercentileCoverage` is the correct percentile rank of `currentOverlap` in the distribution.

### Integration Tests

End-to-end tests that verify the complete pipeline from chunk array to recommendation.

- **Corpus roundtrip**: Take a known document, chunk it with `chunk-smart` at overlap=0, analyze with `recommend`, verify recommendation is a positive integer <= `maxOverlap`, boundaries count equals chunks.length - 1.
- **All-clean corpus**: A document chunked at natural paragraph boundaries (all chunks end with `.`): verify `averageQualityScore` > 0.85, `recommended` <= 10 (very small or zero overlap needed).
- **All-bad corpus**: A document chunked at every N characters with no structure awareness: verify `averageQualityScore` < 0.4, `recommended` > 30.
- **Single chunk**: Verify `AnalyzerError` with `INSUFFICIENT_CHUNKS`.
- **Two chunks**: Verify one boundary is analyzed, report has `boundaryCount: 1`.
- **Large corpus**: 500 chunks, verify completion in < 200ms (no embeddings).
- **Determinism**: Same input, same options: two consecutive calls return identical results.
- **Custom sentence detector**: Provide a detector that marks every newline as a boundary; verify the quality scores and overlap requirements reflect that detector's output.

### Embedding Tests

- Provide a mock `embedFn` that returns pre-computed vectors for known inputs.
- Verify `semanticContinuity` equals the expected cosine similarity of those vectors.
- Verify `adjustedOverlap` is boosted correctly for high-similarity pairs.
- Verify embedding deduplication: if the same window text appears at multiple boundaries, `embedFn` is called only once for that text.
- Verify `concurrency` limits concurrent embedding calls (mock with a counter).
- Verify graceful degradation when `embedFn` throws for one boundary.

### CLI Tests

- **File input**: Verify chunking a JSON file by path produces correct text output.
- **Stdin input**: Pipe a JSON array to the CLI, verify the recommendation is printed.
- **`chunk-smart` output**: Pipe `chunk-smart` JSON output (array of Chunk objects), verify the CLI extracts `content` fields correctly.
- **Exit code 4**: Provide `--current-overlap` below the recommendation, verify exit code is 4.
- **Exit code 0**: Provide `--current-overlap` matching or exceeding the recommendation, verify exit code is 0.
- **Exit code 3**: Provide a single-chunk JSON array, verify exit code is 3 and error message is printed.
- **`--format json`**: Verify the output is valid JSON matching the `OverlapRecommendation` shape.
- **Flag parsing**: `--percentile 95`, `--window 64`, `--unit chars`, `--abbrev API,SDK` are all parsed correctly.
- **Invalid flags**: Unrecognized flags produce exit code 2 with a usage message.

### Edge Cases to Test

- Chunks containing only whitespace (no sentence-detectable text): verify score = 0.0, minOverlap = 0.
- Chunks with very long sentences (> `maxOverlap` tokens): verify recommendation is capped at `maxOverlap`.
- Non-ASCII and Unicode text: CJK characters, emoji, RTL text, Unicode punctuation (`。`, `！`, `？`).
- Mixed line endings: `\r\n`, `\r`, `\n` -- paragraph detection handles all variants.
- Code chunks (text containing no prose sentences): sentence detector finds no boundaries, boundary is treated as a non-sentence structure with a neutral quality score.
- Chunks with trailing/leading whitespace only: treated as clean boundaries.
- `targetPercentile: 50` returns the median requirement.
- `targetPercentile: 100` returns the maximum requirement.

### Test Framework

Tests use Vitest, matching the project's existing `package.json` configuration.

---

## 16. Performance

### Design Constraints

`chunk-overlap-optimizer` analyzes chunk corpora that may contain thousands of chunks. A 1000-chunk corpus has 999 boundaries. Each boundary analysis runs the sentence detector (linear scan) twice and computes quality scores. The entire analysis should complete in milliseconds for typical corpora.

### Optimization Strategy

- **Single-pass sentence detection**: The sentence detector scans each window once with a linear-time scanner, building the boundary position array without backtracking regex.
- **Window extraction without full tokenization**: The window extraction counts tokens from the end of the chunk (tail) and from the start (head) without tokenizing the entire chunk -- it stops counting as soon as `windowSize` tokens are accumulated.
- **Lazy embedding with deduplication**: When `embedFn` is provided, unique window texts are embedded once (deduplicated by text content). A `Map<string, Promise<number[]>>` is built before any embedding calls, so concurrent calls for the same text share one Promise.
- **Concurrent embedding with `concurrency` limit**: Embedding calls are dispatched in batches of `concurrency` (default: 8) to avoid overwhelming the embedding API while keeping total latency low.
- **No memory amplification**: The boundary analysis objects contain the window text strings (which are substrings of the input chunks), but no copies of the full chunks. The output size is proportional to `K * 2 * windowSize`, where K is the boundary count.

### Performance Targets

| Corpus Size | Embeddings | Expected Time |
|-------------|-----------|---------------|
| 10 chunks (9 boundaries) | None | < 1ms |
| 100 chunks (99 boundaries) | None | < 5ms |
| 500 chunks (499 boundaries) | None | < 20ms |
| 1000 chunks (999 boundaries) | None | < 50ms |
| 100 chunks | OpenAI (128-dim windows) | < 5s (network-bound) |
| 100 chunks | Cached (embed-cache) | < 10ms (cache hits) |

Targets measured on Node.js 22, Apple M3, using the default approximate token counter. Exact token counting with `tiktoken` adds approximately 2-5x overhead for the window extraction step.

---

## 17. Dependencies

### Runtime Dependencies

None. `chunk-overlap-optimizer` has zero mandatory runtime dependencies. Sentence boundary detection, quality scoring, histogram computation, percentile calculation, confidence scoring, and cosine similarity (for embedding analysis) are all implemented using Node.js built-in APIs (`String.prototype`, `RegExp`, `Math`, `Array.prototype`).

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linting |
| `@types/node` | Node.js type definitions |

### Peer Dependencies

None. Callers may optionally integrate `tiktoken`, `gpt-tokenizer`, or `@anthropic-ai/sdk` for exact token counting, and any embedding provider SDK or `embed-cache` for semantic analysis. None of these are required or bundled.

### Why Zero Dependencies

The sentence detection, quality scoring, and overlap recommendation algorithms are specific to this package's use case and simpler than any general-purpose NLP library's interface. Adding `natural`, `compromise`, or `@stdlib/nlp-tokenize-sentences` as dependencies would bring significant bundle weight, indirect dependencies, and potential version conflicts for no meaningful quality improvement over the hand-written rule-based detector, which is tuned specifically to English technical prose in RAG corpora. For non-English or high-accuracy-critical use cases, the `sentenceDetector` option allows plugging in any external library without making it a mandatory dependency.

---

## 18. File Structure

```
chunk-overlap-optimizer/
├── src/
│   ├── index.ts                     -- Public API: analyze, recommend, analyzeBoundary,
│   │                                   createAnalyzer, AnalyzerError, all types
│   ├── types.ts                     -- All TypeScript interfaces and type aliases
│   ├── analyzer.ts                  -- Core orchestration: createAnalyzer factory,
│   │                                   boundary loop, corpus aggregation
│   ├── boundary.ts                  -- analyzeBoundary() -- single boundary analysis
│   ├── recommend.ts                 -- recommend() -- recommendation from OverlapAnalysis
│   ├── sentence/
│   │   ├── index.ts                 -- Sentence detector entry point
│   │   ├── scanner.ts               -- Rule-based sentence boundary scanner
│   │   ├── abbreviations.ts         -- Built-in abbreviation list and matching logic
│   │   └── paragraph.ts             -- Paragraph break detection
│   ├── quality.ts                   -- Boundary quality score computation (4 components)
│   ├── overlap.ts                   -- Minimum overlap and adjusted overlap computation
│   ├── histogram.ts                 -- Overlap histogram construction and bucket assignment
│   ├── percentile.ts                -- Percentile computation from sorted requirements
│   ├── confidence.ts                -- Confidence score computation (coefficient of variation)
│   ├── comparison.ts                -- Current overlap comparison logic
│   ├── semantic.ts                  -- Cosine similarity, embedding deduplication,
│   │                                   concurrency-limited dispatch
│   ├── window.ts                    -- Tail/head window extraction with token counting
│   ├── token-counter.ts             -- Default approximate counter + pluggable interface
│   └── errors.ts                    -- AnalyzerError class and AnalyzerErrorCode type
├── cli/
│   └── index.ts                     -- CLI entrypoint: argument parsing, input reading,
│                                       output formatting, exit codes
├── src/__tests__/
│   ├── analyze.test.ts              -- Integration tests for analyze() and recommend()
│   ├── boundary.test.ts             -- Unit tests for analyzeBoundary()
│   ├── sentence/
│   │   ├── scanner.test.ts          -- Sentence boundary scanner tests
│   │   ├── abbreviations.test.ts    -- Abbreviation suppression tests
│   │   └── paragraph.test.ts        -- Paragraph break detection tests
│   ├── quality.test.ts              -- Quality score computation tests
│   ├── overlap.test.ts              -- Minimum and adjusted overlap tests
│   ├── histogram.test.ts            -- Histogram construction and bucketing tests
│   ├── percentile.test.ts           -- Percentile computation tests
│   ├── confidence.test.ts           -- Confidence score tests
│   ├── comparison.test.ts           -- Current overlap comparison tests
│   ├── semantic.test.ts             -- Cosine similarity and embedding dispatch tests
│   ├── window.test.ts               -- Window extraction tests
│   ├── token-counter.test.ts        -- Token counting tests (default and custom)
│   ├── cli.test.ts                  -- CLI end-to-end tests (spawn process, verify stdout)
│   └── fixtures/
│       ├── clean-corpus.json        -- Corpus with clean boundaries (high quality)
│       ├── bad-corpus.json          -- Corpus with many mid-sentence splits (low quality)
│       ├── mixed-corpus.json        -- Realistic mixed corpus
│       └── single-chunk.json        -- Edge case: one chunk, no boundaries
├── package.json
├── tsconfig.json
├── SPEC.md
└── README.md
```

---

## 19. Implementation Roadmap

### Phase 1: Core Analysis Engine (v0.1.0)

Implement the foundation: types, window extraction, sentence detection, quality scoring, and single-boundary analysis.

1. **Types**: Define all TypeScript types in `types.ts` -- `BoundaryAnalysis`, `OverlapAnalysis`, `OverlapRecommendation`, `HistogramBucket`, `OverlapComparison`, `AnalyzerOptions`, `SizeUnit`, `SentenceDetectorFn`, `EmbedFn`, `Analyzer`, `AnalyzerError`.
2. **Token counter**: Implement default approximate counter and pluggable interface in `token-counter.ts`.
3. **Window extraction**: Implement tail/head window extraction (stop counting at `windowSize` tokens from the relevant end) in `window.ts`.
4. **Abbreviation list**: Compile the built-in abbreviation list and matching regex in `sentence/abbreviations.ts`.
5. **Sentence scanner**: Implement the rule-based scanner with all suppression rules (decimal numbers, ellipsis, URLs, file extensions, quoted endings) in `sentence/scanner.ts`.
6. **Paragraph detection**: Implement double-newline paragraph break detection in `sentence/paragraph.ts`.
7. **Quality scorer**: Implement the four-component quality score with weight table and severity floors in `quality.ts`.
8. **Overlap computation**: Implement `minOverlap` = `tailFragmentSize`, `adjustedOverlap` = `minOverlap` (semantic boost deferred to Phase 2) in `overlap.ts`.
9. **Single boundary analysis**: Implement `analyzeBoundary()` integrating window extraction, sentence detection, quality scoring, and overlap computation in `boundary.ts`.
10. **AnalyzerError**: Implement error class in `errors.ts`.
11. **Tests**: Unit tests for all Phase 1 components. Integration test for `analyzeBoundary()`.

### Phase 2: Corpus Analysis and Recommendation (v0.2.0)

Extend to full corpus analysis and implement the recommendation algorithm.

1. **Corpus boundary loop**: Implement `analyze()` -- iterate over all K-1 boundaries, call `analyzeBoundary()` for each, aggregate into `OverlapAnalysis` in `analyzer.ts`.
2. **Histogram**: Implement bucket assignment and histogram construction in `histogram.ts`.
3. **Percentile computation**: Implement the sorted-array percentile lookup in `percentile.ts`.
4. **Confidence score**: Implement coefficient of variation computation in `confidence.ts`.
5. **Comparison**: Implement current overlap comparison (percentile coverage lookup, status classification) in `comparison.ts`.
6. **Problem boundary selection**: Sort boundaries by quality score ascending, return the bottom N in `recommend.ts`.
7. **`recommend()` function**: Integrate all Phase 2 components and produce `OverlapRecommendation`.
8. **`createAnalyzer()` factory**: Implement option merging, configuration validation, and the `Analyzer` instance in `analyzer.ts`.
9. **Public API**: Export all functions from `index.ts`.
10. **Tests**: Unit tests for histogram, percentile, confidence, comparison. Integration tests for `analyze()` and `recommend()` with the clean, bad, and mixed corpus fixtures.

### Phase 3: Semantic Analysis and CLI (v0.3.0)

Add embedding-based semantic continuity analysis and the CLI.

1. **Cosine similarity**: Implement vector normalization and dot product in `semantic.ts`.
2. **Embedding deduplication**: Build `Map<string, Promise<number[]>>` for unique window texts before dispatching embedding calls.
3. **Concurrency-limited dispatch**: Implement batch dispatch respecting the `concurrency` option.
4. **Semantic boost**: Implement `adjustedOverlap` boost logic when `semanticContinuity > semanticBoostThreshold` in `overlap.ts`.
5. **Integration with `analyzeBoundary()`**: When `embedFn` is provided, embed tail/head windows and populate `semanticContinuity` and `adjustedOverlap`.
6. **CLI**: Implement argument parsing (manual or `parseArgs` from `node:util`), JSON/text output formatting, input format auto-detection, and exit code logic in `cli/index.ts`.
7. **CLI tests**: Spawn the CLI process with test inputs, verify stdout and exit codes for all scenarios.
8. **Embedding tests**: Mock embedding function tests for cosine similarity, boost logic, deduplication, and graceful degradation.

### Phase 4: Polish and Production Readiness (v1.0.0)

1. **Performance benchmarks**: Benchmark the sentence scanner and corpus analysis loop against the performance targets. Profile and optimize hot paths.
2. **Edge case hardening**: Unicode punctuation, CJK text, mixed line endings, all edge case test inputs listed in the testing strategy.
3. **Custom sentence detector validation**: Validate that caller-supplied `sentenceDetector` returns a sorted array of integers within bounds; throw `AnalyzerError` with `INVALID_SENTENCE_DETECTOR` on violation.
4. **Documentation**: Comprehensive README with usage examples for every common scenario, including the two-pass `chunk-smart` workflow and the CI/CD quality gate pattern.

---

## 20. Example Use Cases

### 20.1 Tuning Overlap for a Documentation Corpus

A team has built a RAG pipeline over their product documentation. They are using `chunk-smart` with `maxChunkSize: 512, overlap: 100`. Someone suggests reducing overlap to 50 to cut index size. They use `chunk-overlap-optimizer` to make an informed decision:

```typescript
import { chunk } from 'chunk-smart';
import { recommend } from 'chunk-overlap-optimizer';
import { readFileSync } from 'node:fs';

// Sample 10 representative documentation files
const docs = ['api.md', 'auth.md', 'configuration.md', 'quickstart.md', 'sdk.md',
               'webhooks.md', 'errors.md', 'rate-limits.md', 'migration.md', 'faq.md']
  .map(f => readFileSync(`./docs/${f}`, 'utf-8'));

// Pass 1: chunk without overlap to get clean boundaries
const allChunks: string[] = [];
for (const doc of docs) {
  const chunks = chunk(doc, { maxChunkSize: 512, overlap: 0 });
  allChunks.push(...chunks.map(c => c.content));
}

// Analyze and get recommendation
const rec = await recommend(allChunks, {
  currentOverlap: 100,    // what we're using now
  targetPercentile: 90,
});

console.log(`Recommendation: ${rec.recommended} tokens`);
console.log(`Current (100): ${rec.currentOverlapComparison?.status}`);
// e.g., "Recommendation: 67 tokens / Current (100): excessive"
// The current 100-token overlap is more than needed -- safe to reduce to 67.

// Pass 2: re-chunk with the recommended overlap
const finalChunks = chunk(docs[0], { maxChunkSize: 512, overlap: rec.recommended });
```

### 20.2 CI/CD Quality Gate for Chunk Boundaries

A platform team has defined a standard that the corpus-average boundary quality score must stay above 0.60 and the recommended overlap must not exceed 80 tokens (their embedding model's practical limit for meaningful overlap). They enforce this in CI:

```bash
# In the ingestion CI job, after chunking is complete:
cat /tmp/chunks.json | chunk-overlap-optimizer \
  --current-overlap 50 \
  --percentile 90 \
  --format json \
  --pretty > /tmp/overlap-report.json

# Check quality score
QUALITY=$(jq '.averageQualityScore' /tmp/overlap-report.json)
RECOMMENDED=$(jq '.recommended' /tmp/overlap-report.json)

if (( $(echo "$QUALITY < 0.60" | bc -l) )); then
  echo "FAIL: Average boundary quality ${QUALITY} below threshold 0.60"
  echo "Review chunking strategy -- too many mid-sentence splits"
  exit 1
fi

if (( $(echo "$RECOMMENDED > 80" | bc -l) )); then
  echo "FAIL: Recommended overlap ${RECOMMENDED} exceeds 80-token limit"
  echo "Sentences are too long for this chunk size -- increase maxChunkSize"
  exit 1
fi

# Exit code 4 from chunk-overlap-optimizer means current overlap is insufficient
chunk-overlap-optimizer --current-overlap 50 chunks.json
if [ $? -eq 4 ]; then
  echo "FAIL: Current overlap of 50 tokens is insufficient"
  exit 1
fi

echo "PASS: Boundary quality and overlap within acceptable bounds"
```

### 20.3 Comparing Chunking Strategies

A developer is deciding between fixed-size chunking (every 512 tokens, regardless of structure) and `chunk-smart`'s structure-aware chunking for a markdown documentation corpus. They use `chunk-overlap-optimizer` as an objective quality metric:

```typescript
import { chunkMarkdown } from 'chunk-smart';
import { analyze } from 'chunk-overlap-optimizer';

const documentText = readFileSync('./full-docs.md', 'utf-8');

// Strategy A: naive fixed-size split (simulated by chunk-smart with structure disabled)
const strategyAChunks = chunkMarkdown(documentText, {
  maxChunkSize: 512, preserveStructure: false,
}).map(c => c.content);

// Strategy B: structure-aware chunking
const strategyBChunks = chunkMarkdown(documentText, {
  maxChunkSize: 512, preserveStructure: true,
}).map(c => c.content);

const analysisA = await analyze(strategyAChunks);
const analysisB = await analyze(strategyBChunks);

console.log('Strategy A (naive):');
console.log(`  Average quality: ${analysisA.averageQualityScore.toFixed(3)}`);
console.log(`  Mid-sentence rate: ${(analysisA.midSentenceRate * 100).toFixed(1)}%`);

console.log('Strategy B (structure-aware):');
console.log(`  Average quality: ${analysisB.averageQualityScore.toFixed(3)}`);
console.log(`  Mid-sentence rate: ${(analysisB.midSentenceRate * 100).toFixed(1)}%`);
// e.g.:
// Strategy A (naive):
//   Average quality: 0.381
//   Mid-sentence rate: 58.2%
// Strategy B (structure-aware):
//   Average quality: 0.803
//   Mid-sentence rate: 12.4%
```

The numbers make the decision straightforward: structure-aware chunking cuts the mid-sentence rate from 58% to 12% and more than doubles the average boundary quality score.

### 20.4 Semantic Analysis for Technical Documentation

A team ingesting dense technical documentation with long sentences wants to understand which boundaries are cutting through semantically cohesive content, even when sentence boundaries are present:

```typescript
import { recommend } from 'chunk-overlap-optimizer';
import { createEmbedCache } from 'embed-cache';

const cache = createEmbedCache({ provider: 'openai', model: 'text-embedding-3-small' });

const rec = await recommend(technicalChunks, {
  embedFn: (text) => cache.embed(text),
  adjustForSemantics: true,
  semanticBoostThreshold: 0.80,
  semanticBoostFactor: 1.4,
  targetPercentile: 90,
});

// Boundaries with high semantic continuity are highlighted
const semanticBoundaries = rec.boundaries
  .filter(b => (b.semanticContinuity ?? 0) > 0.80)
  .sort((a, b) => (b.semanticContinuity ?? 0) - (a.semanticContinuity ?? 0));

console.log(`${semanticBoundaries.length} boundaries cut through high-continuity content`);
semanticBoundaries.forEach(b => {
  console.log(`  Boundary ${b.index}: continuity=${b.semanticContinuity?.toFixed(2)}, adjusted=${b.adjustedOverlap}`);
});
```
