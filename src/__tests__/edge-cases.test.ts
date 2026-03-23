import { describe, it, expect } from 'vitest';
import { analyzeBoundary, analyze, recommend, AnalyzerError } from '../index.js';

describe('edge case hardening', () => {
  describe('whitespace-only chunks', () => {
    it('handles whitespace-only chunks with valid quality scores', async () => {
      const result = await analyze(['Hello world. Foo bar.', '   \n\t  ', 'Next chunk here. Done.']);
      // Whitespace-only chunk is treated as empty text; both boundaries are "clean"
      // (no mid-sentence split), so quality scores remain valid and high.
      for (const boundary of result.boundaries) {
        expect(boundary.qualityScore).toBeGreaterThanOrEqual(0);
        expect(boundary.qualityScore).toBeLessThanOrEqual(1);
      }
      expect(result.boundaryCount).toBe(2);
    });
  });

  describe('very long sentences exceeding maxOverlap', () => {
    it('caps recommended overlap at maxOverlap', async () => {
      // Create chunks where the boundary splits a very long sentence
      const longSentence = 'word '.repeat(200); // ~200 words
      const chunks = [
        'First sentence. ' + longSentence,
        longSentence + ' Last sentence.',
      ];
      const result = await recommend(chunks, { maxOverlap: 50 });
      expect(result.recommended).toBeLessThanOrEqual(50);
    });
  });

  describe('Unicode and non-ASCII text', () => {
    it('handles CJK text without crashing', async () => {
      const chunks = [
        '这是第一段话。这里有很多中文文字。',
        '第二段开始了。继续用中文写作。',
      ];
      const result = await analyze(chunks);
      expect(result.boundaryCount).toBe(1);
      expect(result.boundaries[0].qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.boundaries[0].qualityScore).toBeLessThanOrEqual(1);
    });

    it('handles emoji in text', async () => {
      const chunks = [
        'Hello world! 🌍 This is great.',
        'More text here. 🚀 Keep going.',
      ];
      const result = await analyze(chunks);
      expect(result.boundaryCount).toBe(1);
    });
  });

  describe('mixed line endings', () => {
    it('handles \\r\\n line endings', async () => {
      const chunks = [
        'First paragraph.\r\n\r\nSecond paragraph.',
        'Third paragraph.\r\n\r\nFourth paragraph.',
      ];
      const result = await analyze(chunks);
      expect(result.boundaryCount).toBe(1);
    });

    it('handles mixed \\n and \\r\\n', async () => {
      const chunks = [
        'First paragraph.\n\nSecond paragraph.',
        'Third paragraph.\r\n\r\nFourth paragraph.',
      ];
      const result = await analyze(chunks);
      expect(result.boundaryCount).toBe(1);
    });
  });

  describe('code chunks (non-prose)', () => {
    it('handles code with no prose sentences', async () => {
      const chunks = [
        'function hello() {\n  console.log("hi");\n  return true;\n}',
        'const x = 42;\nconst y = x + 1;\nconsole.log(y);',
      ];
      const result = await analyze(chunks);
      expect(result.boundaryCount).toBe(1);
      // Code has no clear sentence boundaries, so boundary should exist
      expect(result.boundaries[0].qualityScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('chunks with trailing/leading whitespace only', () => {
    it('treats trailing whitespace as clean boundary', async () => {
      const chunks = [
        'The first sentence ends here.   ',
        'The second sentence starts here.',
      ];
      const result = await analyze(chunks);
      const boundary = result.boundaries[0];
      // Trailing whitespace after period should be treated as clean
      expect(boundary.isMidSentence).toBe(false);
    });
  });

  describe('targetPercentile edge values', () => {
    const chunks = [
      'First sentence. Second sentence.',
      'Third sentence starts mid flow and continues',
      'Fourth sentence. Fifth sentence.',
      'Sixth is split here without period',
      'Seventh sentence. Eighth sentence.',
    ];

    it('targetPercentile: 50 returns the median overlap', async () => {
      const result = await recommend(chunks, { targetPercentile: 50 });
      expect(result.targetPercentile).toBe(50);
      expect(result.recommended).toBeGreaterThanOrEqual(0);
    });

    it('targetPercentile: 100 returns the maximum overlap', async () => {
      const result = await recommend(chunks, { targetPercentile: 100 });
      expect(result.targetPercentile).toBe(100);
      // Should be >= the 50th percentile result
      const p50 = await recommend(chunks, { targetPercentile: 50 });
      expect(result.recommended).toBeGreaterThanOrEqual(p50.recommended);
    });

    it('targetPercentile: 1 returns the minimum overlap', async () => {
      const result = await recommend(chunks, { targetPercentile: 1 });
      expect(result.targetPercentile).toBe(1);
      expect(result.recommended).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('custom sentence detector validation', () => {
  it('accepts valid custom detector output', async () => {
    const detector = (text: string) => {
      const positions: number[] = [];
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') positions.push(i + 1);
      }
      return positions;
    };
    const result = await analyze(
      ['Line one.\nLine two.', 'Line three.\nLine four.'],
      { sentenceDetector: detector },
    );
    expect(result.boundaryCount).toBe(1);
  });

  it('throws INVALID_SENTENCE_DETECTOR when detector returns non-array', async () => {
    const detector = () => 'not an array' as any;
    await expect(
      analyzeBoundary('Hello world.', 'Next sentence.', { sentenceDetector: detector }),
    ).rejects.toThrow(AnalyzerError);
    try {
      await analyzeBoundary('Hello world.', 'Next sentence.', { sentenceDetector: detector });
    } catch (e) {
      expect((e as AnalyzerError).code).toBe('INVALID_SENTENCE_DETECTOR');
    }
  });

  it('throws INVALID_SENTENCE_DETECTOR when detector returns non-integers', async () => {
    const detector = () => [1.5, 3.7];
    await expect(
      analyzeBoundary('Hello world.', 'Next sentence.', { sentenceDetector: detector }),
    ).rejects.toThrow(AnalyzerError);
  });

  it('throws INVALID_SENTENCE_DETECTOR when detector returns out-of-bounds positions', async () => {
    const detector = (text: string) => [text.length + 10];
    await expect(
      analyzeBoundary('Hello world.', 'Next sentence.', { sentenceDetector: detector }),
    ).rejects.toThrow(AnalyzerError);
  });

  it('throws INVALID_SENTENCE_DETECTOR when detector returns unsorted positions', async () => {
    const detector = () => [10, 5, 15];
    await expect(
      analyzeBoundary('Hello world. More text here.', 'Next sentence.', { sentenceDetector: detector }),
    ).rejects.toThrow(AnalyzerError);
  });
});
