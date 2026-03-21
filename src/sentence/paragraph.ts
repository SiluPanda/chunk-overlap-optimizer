/**
 * Detect paragraph break positions in a text string.
 * A paragraph break is a sequence of two or more consecutive newlines
 * (with optional carriage returns).
 *
 * Returns an array of positions where new paragraphs start (the index
 * of the first character after the paragraph break).
 */
export function detectParagraphBreaks(text: string): number[] {
  const positions: number[] = [];
  // Match sequences of two or more line breaks (possibly with \r)
  const pattern = /(?:\r?\n){2,}|\r{2,}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const endPos = match.index + match[0].length;
    if (endPos < text.length) {
      positions.push(endPos);
    }
  }

  return positions;
}
