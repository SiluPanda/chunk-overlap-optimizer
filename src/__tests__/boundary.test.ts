import { describe, it, expect } from 'vitest';
import { analyzeBoundaryCore } from '../boundary.js';
import { resolveOptions } from '../defaults.js';

describe('analyzeBoundaryCore', () => {
  const defaultOpts = resolveOptions();

  it('detects clean boundary (chunk ends with period, next starts new sentence)', () => {
    const result = analyzeBoundaryCore(
      'The system validates all requests.',
      'Each token is verified against the authority.',
      defaultOpts,
    );
    expect(result.qualityScore).toBeGreaterThan(0.5);
    expect(result.isMidSentence).toBe(false);
    expect(result.minOverlap).toBe(0);
  });

  it('detects mid-sentence split', () => {
    const result = analyzeBoundaryCore(
      'The authentication token is stored in the',
      'secure storage mechanism for later use.',
      defaultOpts,
    );
    expect(result.isMidSentence).toBe(true);
    expect(result.minOverlap).toBeGreaterThan(0);
    expect(result.tailFragment.length).toBeGreaterThan(0);
  });

  it('detects mid-word split', () => {
    const result = analyzeBoundaryCore(
      'The authen',
      'tication token is used.',
      defaultOpts,
    );
    expect(result.qualityScore).toBeLessThanOrEqual(0.1);
    expect(result.isMidSentence).toBe(true);
  });

  it('uses custom windowSize', () => {
    const opts = resolveOptions({ windowSize: 16 });
    const longText = 'A'.repeat(200);
    const result = analyzeBoundaryCore(longText, longText, opts);
    // The windows should be limited
    expect(result.tailWindow.length).toBeLessThanOrEqual(200);
    expect(result.headWindow.length).toBeLessThanOrEqual(200);
  });

  it('uses custom tokenCounter', () => {
    const wordCounter = (t: string) => t.split(/\s+/).filter(Boolean).length;
    const opts = resolveOptions({ tokenCounter: wordCounter, windowSize: 5 });
    const result = analyzeBoundaryCore(
      'One two three four five six seven eight nine ten.',
      'Eleven twelve thirteen fourteen fifteen.',
      opts,
    );
    expect(result.tailWindow).toBeDefined();
    expect(result.headWindow).toBeDefined();
  });

  it('uses custom sentenceDetector', () => {
    const detector = (text: string): number[] => {
      const positions: number[] = [];
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') positions.push(i + 1);
      }
      return positions;
    };
    const opts = resolveOptions({ sentenceDetector: detector });
    const result = analyzeBoundaryCore(
      'Line one\nLine two',
      'Line three\nLine four',
      opts,
    );
    expect(result.tailSentenceBoundaries.length).toBeGreaterThan(0);
    expect(result.headSentenceBoundaries.length).toBeGreaterThan(0);
  });

  it('sets headContinuation correctly', () => {
    const result = analyzeBoundaryCore(
      'Complete sentence here.',
      'continuation of something that started before.',
      defaultOpts,
    );
    // Head starts lowercase so scanner won't find a sentence before this
    // The head fragment would be the whole window
    expect(result.headContinuation).toBe(true);
  });

  it('detects isMidParagraph', () => {
    const result = analyzeBoundaryCore(
      'Some text in a paragraph.',
      'More text continues.',
      defaultOpts,
    );
    // No paragraph breaks, so mid-paragraph
    expect(result.isMidParagraph).toBe(true);

    // With paragraph break
    const result2 = analyzeBoundaryCore(
      'First paragraph.\n\nSecond paragraph.',
      'Third paragraph.',
      defaultOpts,
    );
    // Has paragraph break, check if it's paragraph-aligned
    expect(typeof result2.isMidParagraph).toBe('boolean');
  });

  it('index is undefined when not passed', () => {
    const result = analyzeBoundaryCore(
      'Text one.',
      'Text two.',
      defaultOpts,
    );
    expect(result.index).toBeUndefined();
  });

  it('index is set when passed', () => {
    const result = analyzeBoundaryCore(
      'Text one.',
      'Text two.',
      defaultOpts,
      5,
    );
    expect(result.index).toBe(5);
  });

  it('returns all expected fields', () => {
    const result = analyzeBoundaryCore(
      'Some text here.',
      'More text there.',
      defaultOpts,
    );
    expect(result).toHaveProperty('qualityScore');
    expect(result).toHaveProperty('isMidSentence');
    expect(result).toHaveProperty('headContinuation');
    expect(result).toHaveProperty('isMidParagraph');
    expect(result).toHaveProperty('tailWindow');
    expect(result).toHaveProperty('headWindow');
    expect(result).toHaveProperty('tailFragment');
    expect(result).toHaveProperty('tailFragmentSize');
    expect(result).toHaveProperty('headFragment');
    expect(result).toHaveProperty('headFragmentSize');
    expect(result).toHaveProperty('minOverlap');
    expect(result).toHaveProperty('adjustedOverlap');
    expect(result).toHaveProperty('tailSentenceBoundaries');
    expect(result).toHaveProperty('headSentenceBoundaries');
  });

  it('qualityScore is between 0 and 1', () => {
    const cases = [
      ['Ends cleanly.', 'Starts cleanly.'],
      ['Mid sentence here but', 'this continues further.'],
      ['abruptly cut her', 'e is more text.'],
    ] as const;

    for (const [tail, head] of cases) {
      const result = analyzeBoundaryCore(tail, head, defaultOpts);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    }
  });

  it('adjustedOverlap equals minOverlap without embeddings', () => {
    const result = analyzeBoundaryCore(
      'The token is stored in',
      'the secure mechanism.',
      defaultOpts,
    );
    expect(result.adjustedOverlap).toBe(result.minOverlap);
    expect(result.semanticContinuity).toBeUndefined();
  });

  it('detects mid-sentence when tail ends with abbreviation (Dr.)', () => {
    const result = analyzeBoundaryCore(
      'The patient should see Dr.',
      'Smith for a consultation tomorrow.',
      defaultOpts,
    );
    expect(result.isMidSentence).toBe(true);
    expect(result.minOverlap).toBeGreaterThan(0);
    expect(result.tailFragment.length).toBeGreaterThan(0);
  });

  it('detects mid-sentence when tail ends with abbreviation (Mr.)', () => {
    const result = analyzeBoundaryCore(
      'She met with Mr.',
      'Johnson at the office yesterday.',
      defaultOpts,
    );
    expect(result.isMidSentence).toBe(true);
    expect(result.minOverlap).toBeGreaterThan(0);
  });

  it('detects mid-sentence when tail ends with abbreviation (etc.)', () => {
    const result = analyzeBoundaryCore(
      'They brought food, drinks, etc.',
      'Everything was ready for the party.',
      defaultOpts,
    );
    expect(result.isMidSentence).toBe(true);
    expect(result.minOverlap).toBeGreaterThan(0);
  });

  it('still detects clean boundary for real sentence endings', () => {
    const result = analyzeBoundaryCore(
      'The system validates all requests.',
      'Each token is verified.',
      defaultOpts,
    );
    expect(result.isMidSentence).toBe(false);
    expect(result.minOverlap).toBe(0);
  });

  it('handles abbreviation in quotes at tail end', () => {
    const result = analyzeBoundaryCore(
      'She said "call me Dr.',
      'Smith" and left the room.',
      defaultOpts,
    );
    // "Dr." is an abbreviation; this is mid-sentence
    expect(result.isMidSentence).toBe(true);
  });

  it('detects mid-sentence with custom abbreviation at tail end', () => {
    const opts = resolveOptions({ abbreviations: ['Fig'] });
    const result = analyzeBoundaryCore(
      'As shown in Fig.',
      '3, the results are clear.',
      opts,
    );
    expect(result.isMidSentence).toBe(true);
    expect(result.minOverlap).toBeGreaterThan(0);
  });

  it('correctly handles sentence after abbreviation in tail', () => {
    const result = analyzeBoundaryCore(
      'She met Dr. Smith. The appointment went well.',
      'They discussed the results.',
      defaultOpts,
    );
    // Tail ends with a real sentence ("The appointment went well.")
    expect(result.isMidSentence).toBe(false);
    expect(result.minOverlap).toBe(0);
  });
});
