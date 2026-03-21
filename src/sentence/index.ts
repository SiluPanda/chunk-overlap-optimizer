import { scanSentenceBoundaries } from './scanner.js';
import { detectParagraphBreaks } from './paragraph.js';
import { compileAbbreviations } from './abbreviations.js';

export interface SentenceDetectorOptions {
  /** Additional abbreviations to suppress. */
  abbreviations?: string[];
}

/**
 * Detect sentence boundaries in text, combining the rule-based sentence
 * scanner with paragraph break detection.
 *
 * Returns a sorted, deduplicated array of positions where new sentences start.
 */
export function detectSentenceBoundaries(
  text: string,
  options?: SentenceDetectorOptions,
): number[] {
  const customAbbrevs = options?.abbreviations?.length
    ? compileAbbreviations(options.abbreviations)
    : undefined;

  const sentencePositions = scanSentenceBoundaries(text, customAbbrevs);
  const paragraphPositions = detectParagraphBreaks(text);

  // Merge and deduplicate
  const allPositions = new Set([...sentencePositions, ...paragraphPositions]);
  return Array.from(allPositions).sort((a, b) => a - b);
}

export { scanSentenceBoundaries } from './scanner.js';
export { detectParagraphBreaks } from './paragraph.js';
export { isAbbreviation, compileAbbreviations, BUILT_IN_ABBREVIATIONS } from './abbreviations.js';
