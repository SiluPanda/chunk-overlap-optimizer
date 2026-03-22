import type { BoundaryAnalysis, ResolvedOptions } from './types.js';
import { extractTailWindow, extractHeadWindow } from './window.js';
import { detectSentenceBoundaries } from './sentence/index.js';
import { detectParagraphBreaks } from './sentence/paragraph.js';
import { isAbbreviation, compileAbbreviations } from './sentence/abbreviations.js';
import { computeQualityScore } from './quality.js';
import { computeMinOverlap, computeAdjustedOverlap } from './overlap.js';

/**
 * Compute the average sentence length from detected sentence boundaries in text.
 */
function computeAverageSentenceLength(
  text: string,
  boundaries: number[],
  sizeCounter: (text: string) => number,
): number {
  if (boundaries.length === 0) return sizeCounter(text);

  const sentenceLengths: number[] = [];
  let prevPos = 0;
  for (const pos of boundaries) {
    const sentence = text.slice(prevPos, pos);
    const len = sizeCounter(sentence);
    if (len > 0) sentenceLengths.push(len);
    prevPos = pos;
  }
  // Add the last fragment
  if (prevPos < text.length) {
    const last = sizeCounter(text.slice(prevPos));
    if (last > 0) sentenceLengths.push(last);
  }

  if (sentenceLengths.length === 0) return 0;
  return sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
}

/**
 * Extract the word token immediately before a period at the given index.
 * Used to check if a trailing period is part of an abbreviation.
 */
function extractTokenBeforePeriod(text: string, periodIndex: number): string {
  let end = periodIndex;
  // Walk back past any preceding periods (for abbreviations like "e.g.")
  while (end > 0 && text[end - 1] === '.') end--;
  let start = end;
  while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) start--;
  return text.slice(start, end);
}

/**
 * Check if a trailing period is part of an abbreviation rather than a
 * sentence terminator. Checks the token before the period against built-in
 * and custom abbreviation lists.
 */
function isTrailingPeriodAbbreviation(
  text: string,
  periodIndex: number,
  customAbbreviations?: ReadonlySet<string>,
): boolean {
  const token = extractTokenBeforePeriod(text, periodIndex);
  return token.length > 0 && isAbbreviation(token, customAbbreviations);
}

/**
 * Check if the text ends at a sentence boundary:
 * ends with sentence-terminal punctuation (., !, ?) optionally followed
 * by closing quotes and/or whitespace. Periods that are part of known
 * abbreviations (Dr., Mr., etc.) are NOT treated as sentence boundaries.
 */
function endsAtSentenceBoundary(
  text: string,
  customAbbreviations?: ReadonlySet<string>,
): boolean {
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) return true;
  const lastChar = trimmed[trimmed.length - 1];
  // Check for !  ?
  if (lastChar === '!' || lastChar === '?') return true;
  // Check for . — but not if it's an abbreviation
  if (lastChar === '.') {
    return !isTrailingPeriodAbbreviation(trimmed, trimmed.length - 1, customAbbreviations);
  }
  // Check for ." !' ?" etc.
  if (lastChar === '"' || lastChar === "'" || lastChar === '\u201D' || lastChar === '\u2019') {
    if (trimmed.length >= 2) {
      const prev = trimmed[trimmed.length - 2];
      if (prev === '!' || prev === '?') return true;
      if (prev === '.') {
        return !isTrailingPeriodAbbreviation(trimmed, trimmed.length - 2, customAbbreviations);
      }
    }
  }
  // Check for .)
  if (lastChar === ')') {
    if (trimmed.length >= 2) {
      const prev = trimmed[trimmed.length - 2];
      if (prev === '!' || prev === '?') return true;
      if (prev === '.') {
        return !isTrailingPeriodAbbreviation(trimmed, trimmed.length - 2, customAbbreviations);
      }
    }
  }
  return false;
}

/**
 * Check if the text starts at a sentence boundary:
 * starts with an uppercase letter, digit, or opening quote
 * optionally preceded by whitespace.
 */
function startsAtSentenceBoundary(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.length === 0) return true;
  const firstChar = trimmed[0];
  return /[A-Z\d"'\u201C\u2018]/.test(firstChar);
}

/**
 * Detect whether a split is mid-word (no whitespace at the boundary).
 */
function isMidWordSplit(tailWindow: string, headWindow: string): boolean {
  if (tailWindow.length === 0 || headWindow.length === 0) return false;
  const lastCharOfTail = tailWindow[tailWindow.length - 1];
  const firstCharOfHead = headWindow[0];
  return !/\s/.test(lastCharOfTail) && !/\s/.test(firstCharOfHead)
    && /\w/.test(lastCharOfTail) && /\w/.test(firstCharOfHead);
}

/**
 * Analyze a single boundary between two chunks.
 *
 * Integrates window extraction, sentence detection, quality scoring,
 * and overlap computation.
 */
export function analyzeBoundaryCore(
  chunkEnd: string,
  nextChunkStart: string,
  options: ResolvedOptions,
  index?: number,
): BoundaryAnalysis {
  const {
    sizeUnit,
    tokenCounter,
    windowSize,
    maxOverlap,
    abbreviations,
    sentenceDetector,
    adjustForSemantics,
    semanticBoostThreshold,
    semanticBoostFactor,
  } = options;

  const sizeCounter = sizeUnit === 'chars'
    ? (t: string) => t.length
    : tokenCounter;

  // Compile custom abbreviations once for reuse
  const compiledAbbrevs = abbreviations.length > 0
    ? compileAbbreviations(abbreviations)
    : undefined;

  // Step 1: Extract windows
  const tailWindow = extractTailWindow(chunkEnd, windowSize, sizeUnit, tokenCounter);
  const headWindow = extractHeadWindow(nextChunkStart, windowSize, sizeUnit, tokenCounter);

  // Step 2: Detect sentence boundaries
  const tailSentenceBoundaries = sentenceDetector
    ? sentenceDetector(tailWindow)
    : detectSentenceBoundaries(tailWindow, { abbreviations });
  const headSentenceBoundaries = sentenceDetector
    ? sentenceDetector(headWindow)
    : detectSentenceBoundaries(headWindow, { abbreviations });

  // Step 3: Compute fragments
  // Tail fragment: text from last sentence boundary to end of tail
  // If the tail ends with sentence-terminal punctuation, the fragment is empty.
  const lastTailBoundary = tailSentenceBoundaries.length > 0
    ? tailSentenceBoundaries[tailSentenceBoundaries.length - 1]
    : 0;

  let tailFragment: string;
  if (endsAtSentenceBoundary(tailWindow, compiledAbbrevs)) {
    // The tail ends at a sentence boundary — clean split from the tail side
    tailFragment = '';
  } else if (tailSentenceBoundaries.length > 0) {
    tailFragment = tailWindow.slice(lastTailBoundary);
  } else {
    tailFragment = tailWindow; // no sentence boundaries found => entire window is fragment
  }

  // Head fragment: text from start of head to first sentence boundary
  // If the head starts at a sentence boundary (uppercase/digit), the fragment is empty.
  const firstHeadBoundary = headSentenceBoundaries.length > 0
    ? headSentenceBoundaries[0]
    : headWindow.length;

  let headFragment: string;
  if (startsAtSentenceBoundary(headWindow)) {
    // The head starts at a sentence boundary — clean split from the head side
    headFragment = '';
  } else if (headSentenceBoundaries.length > 0) {
    headFragment = headWindow.slice(0, firstHeadBoundary);
  } else {
    headFragment = headWindow; // no boundaries => entire head is fragment
  }

  const tailFragmentSize = sizeCounter(tailFragment.trim());
  const headFragmentSize = sizeCounter(headFragment.trim());

  // Step 4: Determine mid-sentence status
  // A boundary is "clean" if the tail fragment (trimmed) is empty
  const tailTrimmed = tailFragment.trim();
  const headTrimmed = headFragment.trim();
  const isMidSentence = tailTrimmed.length > 0;
  const headContinuation = headTrimmed.length > 0;

  // Step 5: Detect mid-paragraph
  const paragraphBreaks = detectParagraphBreaks(tailWindow);
  const lastParagraphBreak = paragraphBreaks.length > 0
    ? paragraphBreaks[paragraphBreaks.length - 1]
    : -1;
  // If the last paragraph break is before the last sentence boundary,
  // the boundary is within the final paragraph (mid-paragraph).
  // If no paragraph breaks at all, it's mid-paragraph.
  const isParagraphBoundary = lastParagraphBreak >= lastTailBoundary && lastParagraphBreak > 0;
  const isMidParagraph = !isParagraphBoundary;

  // Step 6: Compute average sentence length from both windows
  const avgTail = computeAverageSentenceLength(tailWindow, tailSentenceBoundaries, sizeCounter);
  const avgHead = computeAverageSentenceLength(headWindow, headSentenceBoundaries, sizeCounter);
  const avgSentenceLength = (avgTail + avgHead) / 2;

  // Step 7: Detect mid-word split
  const midWord = isMidWordSplit(tailWindow, headWindow);

  // Step 8: Compute quality score
  const qualityScore = computeQualityScore({
    tailFragment: tailTrimmed,
    tailFragmentSize,
    headFragment: headTrimmed,
    headFragmentSize,
    averageSentenceLength: avgSentenceLength,
    isSentenceBoundary: !isMidSentence,
    isParagraphBoundary,
    isMidWord: midWord,
  });

  // Step 9: Compute overlap
  const minOverlap = computeMinOverlap(tailFragmentSize, isMidSentence);
  const adjustedOverlap = computeAdjustedOverlap(
    minOverlap,
    maxOverlap,
    undefined, // semanticContinuity set later
    adjustForSemantics,
    semanticBoostThreshold,
    semanticBoostFactor,
  );

  return {
    index,
    qualityScore,
    isMidSentence,
    headContinuation,
    isMidParagraph,
    tailWindow,
    headWindow,
    tailFragment: tailTrimmed,
    tailFragmentSize,
    headFragment: headTrimmed,
    headFragmentSize,
    minOverlap,
    adjustedOverlap,
    tailSentenceBoundaries,
    headSentenceBoundaries,
  };
}
