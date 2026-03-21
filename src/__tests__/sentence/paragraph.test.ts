import { describe, it, expect } from 'vitest';
import { detectParagraphBreaks } from '../../sentence/paragraph.js';

describe('detectParagraphBreaks', () => {
  it('detects \\n\\n paragraph breaks', () => {
    const text = 'First paragraph.\n\nSecond paragraph.';
    const positions = detectParagraphBreaks(text);
    expect(positions.length).toBe(1);
    expect(text.slice(positions[0]).startsWith('Second')).toBe(true);
  });

  it('detects \\r\\n\\r\\n paragraph breaks', () => {
    const text = 'First paragraph.\r\n\r\nSecond paragraph.';
    const positions = detectParagraphBreaks(text);
    expect(positions.length).toBe(1);
    expect(text.slice(positions[0]).startsWith('Second')).toBe(true);
  });

  it('returns empty array for text with no paragraph breaks', () => {
    const text = 'Single paragraph with no breaks.';
    expect(detectParagraphBreaks(text)).toEqual([]);
  });

  it('returns empty for text with single newline only', () => {
    const text = 'Line one.\nLine two.';
    expect(detectParagraphBreaks(text)).toEqual([]);
  });

  it('detects multiple paragraph breaks', () => {
    const text = 'Para 1.\n\nPara 2.\n\nPara 3.';
    const positions = detectParagraphBreaks(text);
    expect(positions.length).toBe(2);
  });

  it('handles multiple consecutive paragraph breaks', () => {
    const text = 'Para 1.\n\n\n\nPara 2.';
    const positions = detectParagraphBreaks(text);
    expect(positions.length).toBe(1);
    expect(text.slice(positions[0]).startsWith('Para 2')).toBe(true);
  });

  it('handles empty string', () => {
    expect(detectParagraphBreaks('')).toEqual([]);
  });

  it('does not detect paragraph break at end of text', () => {
    const text = 'Some text.\n\n';
    const positions = detectParagraphBreaks(text);
    expect(positions.length).toBe(0);
  });

  it('handles mixed line endings', () => {
    const text = 'Para 1.\r\n\r\nPara 2.\n\nPara 3.';
    const positions = detectParagraphBreaks(text);
    expect(positions.length).toBe(2);
  });
});
