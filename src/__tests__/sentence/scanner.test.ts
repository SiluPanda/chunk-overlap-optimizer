import { describe, it, expect } from 'vitest';
import { scanSentenceBoundaries } from '../../sentence/scanner.js';

describe('scanSentenceBoundaries', () => {
  it('returns empty array for empty string', () => {
    expect(scanSentenceBoundaries('')).toEqual([]);
  });

  it('returns empty array for single sentence without terminal', () => {
    expect(scanSentenceBoundaries('Hello world')).toEqual([]);
  });

  it('detects standard period + uppercase sentence boundary', () => {
    const text = 'First sentence. Second sentence.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('S');
  });

  it('detects exclamation mark boundaries', () => {
    const text = 'Wow! That is great.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('T');
  });

  it('detects question mark boundaries', () => {
    const text = 'Is this working? Yes it is.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('Y');
  });

  it('detects multiple sentence boundaries', () => {
    const text = 'One. Two. Three. Four.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(3);
  });

  // Abbreviation suppression
  it('suppresses Dr. abbreviation', () => {
    const text = 'Dr. Smith is here. He arrived today.';
    const positions = scanSentenceBoundaries(text);
    // Only boundary after "here."
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('H');
  });

  it('suppresses Mr. and Mrs. abbreviations', () => {
    const text = 'Mr. and Mrs. Jones arrived. They were late.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('T');
  });

  it('suppresses etc. abbreviation', () => {
    const text = 'Items include apples, oranges, etc. The list goes on. More items here.';
    const positions = scanSentenceBoundaries(text);
    // "etc." is suppressed, but "on." is a real boundary before "More"
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('M');
  });

  it('suppresses vs. abbreviation', () => {
    const text = 'Team A vs. Team B played. The game was good.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('T');
  });

  it('suppresses single letter abbreviations (J. Smith)', () => {
    const text = 'J. Smith wrote the report. It was thorough.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('I');
  });

  it('suppresses U.S.A. style multi-period abbreviations', () => {
    // Each period preceded by a single letter — all suppressed
    const text = 'The U.S.A. delegation arrived. They represented America.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('T');
  });

  // Decimal number suppression
  it('suppresses decimal numbers like 3.14', () => {
    const text = 'Pi is approximately 3.14 and it is useful. Math is fun.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('M');
  });

  it('suppresses 0.001', () => {
    const text = 'The value was 0.001 which is very small. Next topic.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
  });

  // Ellipsis handling
  it('handles ellipsis correctly', () => {
    const text = 'Wait... He said something. Then left.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBeGreaterThanOrEqual(1);
    // Should detect boundary after "something."
  });

  it('handles four dots as ellipsis', () => {
    const text = 'Thinking.... Then he decided. It was final.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBeGreaterThanOrEqual(1);
  });

  // URL suppression
  it('suppresses URLs', () => {
    const text = 'Visit www.example.com for details. Then click something.';
    const positions = scanSentenceBoundaries(text);
    // Should detect boundary after "details." but not within the URL
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('T');
  });

  it('suppresses http URLs', () => {
    const text = 'See http://example.org/page for info. More text here.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('M');
  });

  // File extension suppression
  it('suppresses file extensions like index.ts', () => {
    const text = 'See index.ts for details. The code is there.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('T');
  });

  it('suppresses .json extensions', () => {
    const text = 'Edit config.json to change settings. Then restart.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('T');
  });

  // Quoted string endings
  it('handles quoted string endings', () => {
    const text = 'He said "Hello." She replied "Hi."';
    const positions = scanSentenceBoundaries(text);
    // After '."' + whitespace + uppercase
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('S');
  });

  // Multiple boundary types
  it('handles mixed punctuation', () => {
    const text = 'Statement one. Question two? Exclamation three! Final four.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(3);
  });

  it('handles text ending with sentence boundary', () => {
    const text = 'First sentence. Second sentence.';
    const positions = scanSentenceBoundaries(text);
    // Only one boundary (between first and second), not at end
    expect(positions.length).toBe(1);
  });

  it('does not create boundary when next char is lowercase', () => {
    const text = 'this is a test. and this continues lowercase.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(0);
  });

  it('creates boundary when next char is a digit', () => {
    const text = 'Step complete. 3 more steps remain.';
    const positions = scanSentenceBoundaries(text);
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('3');
  });

  it('handles custom abbreviations', () => {
    const custom = new Set(['api', 'sdk']);
    const text = 'Use the API. SDK handles this. Then continue.';
    const positions = scanSentenceBoundaries(text, custom);
    // Both "API." and "SDK." should be suppressed
    expect(positions.length).toBe(1);
    expect(text[positions[0]]).toBe('T');
  });
});
