export interface QualityScoreInput {
  /** The tail fragment text (from last sentence boundary to end of chunk). */
  tailFragment: string;
  /** Length of the tail fragment in size units. */
  tailFragmentSize: number;
  /** The head fragment text (from start of next chunk to first sentence boundary). */
  headFragment: string;
  /** Length of the head fragment in size units. */
  headFragmentSize: number;
  /** Average sentence length in the analysis windows (in size units). */
  averageSentenceLength: number;
  /** Whether the boundary is at a sentence boundary. */
  isSentenceBoundary: boolean;
  /** Whether the boundary is at a paragraph boundary. */
  isParagraphBoundary: boolean;
  /** Whether the split is mid-word (no whitespace at split point). */
  isMidWord: boolean;
}

/**
 * Compute the boundary quality score using a four-component weighted sum.
 *
 * Components:
 * - Sentence alignment (weight 0.55): 1.0 if at sentence boundary; decreases
 *   linearly with tail fragment length as a fraction of average sentence length.
 * - Head start alignment (weight 0.20): 1.0 if head starts at sentence boundary;
 *   0.5 if mid-sentence.
 * - Paragraph alignment (weight 0.15): 1.0 if at paragraph boundary; 0.6 if
 *   mid-paragraph but sentence-aligned; 0.0 if mid-sentence within paragraph.
 * - Fragment symmetry (weight 0.10): 1.0 if both fragments empty; otherwise
 *   scaled by min/max of fragment sizes.
 *
 * Severity floors:
 * - Mid-word split: clamped to max 0.1
 * - Tail fragment > 75% of average sentence length: clamped to max 0.35
 */
export function computeQualityScore(input: QualityScoreInput): number {
  const {
    tailFragmentSize,
    headFragmentSize,
    averageSentenceLength,
    isSentenceBoundary,
    isParagraphBoundary,
    isMidWord,
  } = input;

  // Component 1: Sentence alignment (weight 0.55)
  let sentenceAlignment: number;
  if (isSentenceBoundary) {
    sentenceAlignment = 1.0;
  } else if (averageSentenceLength > 0) {
    sentenceAlignment = Math.max(0, 1.0 - (tailFragmentSize / averageSentenceLength));
  } else {
    sentenceAlignment = tailFragmentSize === 0 ? 1.0 : 0.0;
  }

  // Component 2: Head start alignment (weight 0.20)
  const headStartAlignment = headFragmentSize === 0 ? 1.0 : 0.5;

  // Component 3: Paragraph alignment (weight 0.15)
  let paragraphAlignment: number;
  if (isParagraphBoundary) {
    paragraphAlignment = 1.0;
  } else if (isSentenceBoundary) {
    paragraphAlignment = 0.6;
  } else {
    paragraphAlignment = 0.0;
  }

  // Component 4: Fragment symmetry (weight 0.10)
  let fragmentSymmetry: number;
  if (tailFragmentSize === 0 && headFragmentSize === 0) {
    fragmentSymmetry = 1.0;
  } else {
    const minFrag = Math.min(tailFragmentSize, headFragmentSize);
    const maxFrag = Math.max(tailFragmentSize, headFragmentSize);
    fragmentSymmetry = maxFrag > 0 ? minFrag / maxFrag : 0.0;
  }

  // Weighted sum
  let score =
    sentenceAlignment * 0.55 +
    headStartAlignment * 0.20 +
    paragraphAlignment * 0.15 +
    fragmentSymmetry * 0.10;

  // Severity floors
  if (isMidWord) {
    score = Math.min(score, 0.1);
  }

  if (averageSentenceLength > 0 && tailFragmentSize > 0.75 * averageSentenceLength) {
    score = Math.min(score, 0.35);
  }

  return Math.max(0, Math.min(1, score));
}
