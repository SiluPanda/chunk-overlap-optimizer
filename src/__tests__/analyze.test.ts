import { describe, it, expect } from 'vitest';
import { analyze, analyzeBoundary, createAnalyzer } from '../analyzer.js';
import { recommend } from '../recommend.js';
import { AnalyzerError } from '../errors.js';
import cleanCorpus from './fixtures/clean-corpus.json';
import badCorpus from './fixtures/bad-corpus.json';
import mixedCorpus from './fixtures/mixed-corpus.json';

describe('analyze()', () => {
  it('clean corpus: averageQualityScore > 0.7', async () => {
    const result = await analyze(cleanCorpus);
    expect(result.averageQualityScore).toBeGreaterThan(0.7);
  });

  it('clean corpus: low midSentenceRate', async () => {
    const result = await analyze(cleanCorpus);
    expect(result.midSentenceRate).toBeLessThan(0.3);
  });

  it('bad corpus: averageQualityScore < 0.5', async () => {
    const result = await analyze(badCorpus);
    expect(result.averageQualityScore).toBeLessThan(0.5);
  });

  it('bad corpus: high midSentenceRate', async () => {
    const result = await analyze(badCorpus);
    expect(result.midSentenceRate).toBeGreaterThan(0.7);
  });

  it('mixed corpus: intermediate values', async () => {
    const result = await analyze(mixedCorpus);
    expect(result.averageQualityScore).toBeGreaterThan(0.2);
    expect(result.averageQualityScore).toBeLessThan(0.9);
  });

  it('single chunk throws INSUFFICIENT_CHUNKS', async () => {
    await expect(analyze(['only one chunk'])).rejects.toThrow(AnalyzerError);
    try {
      await analyze(['only one chunk']);
    } catch (e) {
      expect((e as AnalyzerError).code).toBe('INSUFFICIENT_CHUNKS');
    }
  });

  it('empty array throws INSUFFICIENT_CHUNKS', async () => {
    await expect(analyze([])).rejects.toThrow(AnalyzerError);
  });

  it('non-string chunk throws INVALID_CHUNKS', async () => {
    await expect(analyze([123 as unknown as string, 'test'])).rejects.toThrow(AnalyzerError);
    try {
      await analyze([123 as unknown as string, 'test']);
    } catch (e) {
      expect((e as AnalyzerError).code).toBe('INVALID_CHUNKS');
    }
  });

  it('two chunks produce exactly one boundary', async () => {
    const result = await analyze(['First chunk.', 'Second chunk.']);
    expect(result.boundaryCount).toBe(1);
    expect(result.boundaries.length).toBe(1);
  });

  it('boundaryCount equals chunks.length - 1', async () => {
    const result = await analyze(cleanCorpus);
    expect(result.boundaryCount).toBe(cleanCorpus.length - 1);
  });

  it('timestamp is valid ISO 8601', async () => {
    const result = await analyze(cleanCorpus);
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('durationMs is a positive number', async () => {
    const result = await analyze(cleanCorpus);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.durationMs).toBe('number');
  });

  it('invalid targetPercentile throws INVALID_PERCENTILE', async () => {
    await expect(analyze(cleanCorpus, { targetPercentile: 0 })).rejects.toThrow(AnalyzerError);
    await expect(analyze(cleanCorpus, { targetPercentile: 101 })).rejects.toThrow(AnalyzerError);
  });

  it('invalid windowSize throws INVALID_WINDOW_SIZE', async () => {
    await expect(analyze(cleanCorpus, { windowSize: 0 })).rejects.toThrow(AnalyzerError);
    await expect(analyze(cleanCorpus, { windowSize: -1 })).rejects.toThrow(AnalyzerError);
  });

  it('invalid maxOverlap throws INVALID_MAX_OVERLAP', async () => {
    await expect(analyze(cleanCorpus, { maxOverlap: 0 })).rejects.toThrow(AnalyzerError);
  });

  it('medianQualityScore is computed', async () => {
    const result = await analyze(cleanCorpus);
    expect(typeof result.medianQualityScore).toBe('number');
    expect(result.medianQualityScore).toBeGreaterThanOrEqual(0);
    expect(result.medianQualityScore).toBeLessThanOrEqual(1);
  });

  it('boundaries have correct indices', async () => {
    const result = await analyze(cleanCorpus);
    for (let i = 0; i < result.boundaries.length; i++) {
      expect(result.boundaries[i].index).toBe(i);
    }
  });
});

describe('recommend()', () => {
  it('clean corpus: recommended <= 15', async () => {
    const result = await recommend(cleanCorpus);
    expect(result.recommended).toBeLessThanOrEqual(15);
  });

  it('bad corpus: recommended > 10', async () => {
    const result = await recommend(badCorpus);
    expect(result.recommended).toBeGreaterThan(10);
  });

  it('chunkCount and boundaryCount are correct', async () => {
    const result = await recommend(cleanCorpus);
    expect(result.chunkCount).toBe(cleanCorpus.length);
    expect(result.boundaryCount).toBe(cleanCorpus.length - 1);
  });

  it('histogram buckets sum to boundaryCount', async () => {
    const result = await recommend(cleanCorpus);
    const totalCount = result.histogram.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(result.boundaryCount);
  });

  it('problemBoundaries has at most problemBoundaryCount entries', async () => {
    const result = await recommend(cleanCorpus, { problemBoundaryCount: 3 });
    expect(result.problemBoundaries.length).toBeLessThanOrEqual(3);
  });

  it('problemBoundaries sorted by quality ascending', async () => {
    const result = await recommend(mixedCorpus);
    for (let i = 1; i < result.problemBoundaries.length; i++) {
      expect(result.problemBoundaries[i].qualityScore)
        .toBeGreaterThanOrEqual(result.problemBoundaries[i - 1].qualityScore);
    }
  });

  it('currentOverlapComparison present when currentOverlap provided', async () => {
    const result = await recommend(cleanCorpus, { currentOverlap: 50 });
    expect(result.currentOverlapComparison).toBeDefined();
    expect(result.currentOverlapComparison!.current).toBe(50);
  });

  it('currentOverlapComparison absent when currentOverlap not provided', async () => {
    const result = await recommend(cleanCorpus);
    expect(result.currentOverlapComparison).toBeUndefined();
  });

  it('determinism: same input returns identical results', async () => {
    const chunks = ['First sentence here.', 'Second sentence here.', 'Third sentence here.'];
    const result1 = await recommend(chunks);
    const result2 = await recommend(chunks);

    expect(result1.recommended).toBe(result2.recommended);
    expect(result1.confidence).toBe(result2.confidence);
    expect(result1.averageQualityScore).toBe(result2.averageQualityScore);
    expect(result1.boundaries.length).toBe(result2.boundaries.length);
  });

  it('unit matches sizeUnit option', async () => {
    const tokResult = await recommend(cleanCorpus, { sizeUnit: 'tokens' });
    expect(tokResult.unit).toBe('tokens');

    const charResult = await recommend(cleanCorpus, { sizeUnit: 'chars' });
    expect(charResult.unit).toBe('chars');
  });

  it('targetPercentile is reflected in result', async () => {
    const result = await recommend(cleanCorpus, { targetPercentile: 75 });
    expect(result.targetPercentile).toBe(75);
  });

  it('confidence is between 0 and 1', async () => {
    const result = await recommend(cleanCorpus);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('recommended is capped at maxOverlap', async () => {
    const result = await recommend(badCorpus, { maxOverlap: 5 });
    expect(result.recommended).toBeLessThanOrEqual(5);
  });

  it('timestamp is valid ISO 8601', async () => {
    const result = await recommend(cleanCorpus);
    expect(() => new Date(result.timestamp)).not.toThrow();
  });

  it('histogram has 7 buckets', async () => {
    const result = await recommend(cleanCorpus);
    expect(result.histogram.length).toBe(7);
  });
});

describe('analyzeBoundary()', () => {
  it('works for a clean boundary', async () => {
    const result = await analyzeBoundary(
      'The system is working correctly.',
      'All tests pass successfully.',
    );
    expect(result.qualityScore).toBeGreaterThan(0.5);
    expect(result.isMidSentence).toBe(false);
    expect(result.index).toBeUndefined();
  });

  it('works for a mid-sentence boundary', async () => {
    const result = await analyzeBoundary(
      'The token is stored in the',
      'secure storage mechanism for access.',
    );
    expect(result.isMidSentence).toBe(true);
    expect(result.minOverlap).toBeGreaterThan(0);
  });

  it('accepts options', async () => {
    const result = await analyzeBoundary(
      'Text one here.',
      'Text two here.',
      { windowSize: 32 },
    );
    expect(result).toBeDefined();
  });
});

describe('createAnalyzer()', () => {
  it('creates an analyzer with preset options', () => {
    const analyzer = createAnalyzer({ targetPercentile: 85, windowSize: 64 });
    expect(analyzer).toBeDefined();
    expect(analyzer.recommend).toBeDefined();
    expect(analyzer.analyze).toBeDefined();
    expect(analyzer.analyzeBoundary).toBeDefined();
  });

  it('recommend() uses factory config', async () => {
    const analyzer = createAnalyzer({ targetPercentile: 50 });
    const result = await analyzer.recommend(cleanCorpus);
    expect(result.targetPercentile).toBe(50);
  });

  it('analyze() uses factory config', async () => {
    const analyzer = createAnalyzer({ windowSize: 32 });
    const result = await analyzer.analyze(cleanCorpus);
    expect(result.boundaryCount).toBe(cleanCorpus.length - 1);
  });

  it('analyzeBoundary() uses factory config', async () => {
    const analyzer = createAnalyzer({});
    const result = await analyzer.analyzeBoundary('Text one.', 'Text two.');
    expect(result).toBeDefined();
  });

  it('overrides merge correctly with factory config', async () => {
    const analyzer = createAnalyzer({ targetPercentile: 50 });
    const result = await analyzer.recommend(cleanCorpus, { targetPercentile: 75 });
    expect(result.targetPercentile).toBe(75);
  });

  it('throws at construction for invalid config', () => {
    expect(() => createAnalyzer({ targetPercentile: 0 })).toThrow(AnalyzerError);
    expect(() => createAnalyzer({ windowSize: -1 })).toThrow(AnalyzerError);
    expect(() => createAnalyzer({ maxOverlap: 0 })).toThrow(AnalyzerError);
  });
});

describe('large corpus performance', () => {
  it('500-chunk corpus completes in < 500ms (without embeddings)', async () => {
    // Generate 500 chunks
    const chunks: string[] = [];
    for (let i = 0; i < 500; i++) {
      chunks.push(`This is chunk number ${i}. It contains some text for testing purposes.`);
    }

    const start = Date.now();
    const result = await recommend(chunks);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
    expect(result.boundaryCount).toBe(499);
  });
});

describe('custom sentence detector', () => {
  it('uses custom detector for analysis', async () => {
    const newlineDetector = (text: string): number[] => {
      const positions: number[] = [];
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') positions.push(i + 1);
      }
      return positions;
    };

    const chunks = [
      'Line one\nLine two',
      'Line three\nLine four',
      'Line five\nLine six',
    ];

    const result = await recommend(chunks, { sentenceDetector: newlineDetector });
    expect(result.boundaryCount).toBe(2);
  });
});

describe('semantic analysis integration', () => {
  it('computes semanticContinuity when embedFn is provided', async () => {
    // Fixed-size embedding: hash text to a 4-dimensional vector
    const embedFn = async (text: string) => {
      const hash = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return [hash % 100, (hash * 7) % 100, (hash * 13) % 100, (hash * 31) % 100];
    };

    const result = await analyzeBoundary(
      'The authentication system works well.',
      'Security tokens are verified.',
      { embedFn },
    );

    expect(result.semanticContinuity).toBeDefined();
    expect(typeof result.semanticContinuity).toBe('number');
  });

  it('handles embedFn error gracefully for single boundary', async () => {
    const embedFn = async () => {
      throw new Error('Embedding service unavailable');
    };

    const result = await analyzeBoundary(
      'Text one.',
      'Text two.',
      { embedFn },
    );

    // Should complete without throwing
    expect(result).toBeDefined();
    expect(result.semanticContinuity).toBeUndefined();
  });

  it('applies semantic boost when continuity exceeds threshold', async () => {
    // Create embedFn that returns identical vectors (similarity = 1.0)
    const embedFn = async () => [1, 0, 0, 0];

    const result = await analyzeBoundary(
      'The token is stored in the',
      'secure mechanism for later use.',
      { embedFn, semanticBoostThreshold: 0.5, semanticBoostFactor: 1.5 },
    );

    if (result.isMidSentence && result.minOverlap > 0) {
      expect(result.adjustedOverlap).toBeGreaterThanOrEqual(result.minOverlap);
    }
  });
});
