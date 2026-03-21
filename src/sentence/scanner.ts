import { isAbbreviation } from './abbreviations.js';

/** Common file extensions that should not be treated as sentence boundaries. */
const FILE_EXTENSIONS = new Set([
  'ts', 'js', 'tsx', 'jsx', 'json', 'md', 'html', 'css', 'scss',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h',
  'yml', 'yaml', 'toml', 'xml', 'csv', 'txt', 'log', 'env', 'sh',
  'bat', 'exe', 'dll', 'so', 'png', 'jpg', 'gif', 'svg', 'pdf',
  'zip', 'tar', 'gz', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'com', 'org', 'io', 'net', 'edu', 'gov',
]);

/**
 * Extract the token (word) immediately before a period at the given index.
 * Returns the word characters preceding the period.
 */
function getTokenBeforePeriod(text: string, periodIndex: number): string {
  let end = periodIndex;
  // Walk back past any preceding periods (for abbreviations like "e.g.")
  while (end > 0 && text[end - 1] === '.') {
    end--;
  }
  let start = end;
  while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
    start--;
  }
  return text.slice(start, end);
}

/**
 * Check if a period is part of a decimal number.
 * A period flanked by digits on both sides (e.g., 3.14).
 */
function isDecimalNumber(text: string, periodIndex: number): boolean {
  if (periodIndex === 0 || periodIndex >= text.length - 1) return false;
  return /\d/.test(text[periodIndex - 1]) && /\d/.test(text[periodIndex + 1]);
}

/**
 * Check if a period is part of an ellipsis (three or more dots).
 */
function isEllipsis(text: string, periodIndex: number): boolean {
  // Check if there are at least 3 consecutive dots including this one
  let count = 1;
  let i = periodIndex - 1;
  while (i >= 0 && text[i] === '.') { count++; i--; }
  i = periodIndex + 1;
  while (i < text.length && text[i] === '.') { count++; i++; }
  return count >= 3;
}

/**
 * Check if a period is part of a URL pattern.
 */
function isUrlContext(text: string, periodIndex: number): boolean {
  // Look backwards for "http://", "https://", "www."
  const before = text.slice(Math.max(0, periodIndex - 100), periodIndex + 1);
  if (/https?:\/\/\S*$/i.test(before)) return true;
  if (/www\.\S*$/i.test(before)) return true;

  // Check if the extension after the period is a URL domain suffix
  // and there's no space before the period (part of a URL/domain)
  if (periodIndex > 0 && !/\s/.test(text[periodIndex - 1])) {
    const after = text.slice(periodIndex + 1, periodIndex + 10);
    const extMatch = after.match(/^([a-zA-Z]+)/);
    if (extMatch) {
      const ext = extMatch[1].toLowerCase();
      if (['com', 'org', 'io', 'net', 'edu', 'gov'].includes(ext)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a period is part of a file extension pattern.
 */
function isFileExtension(text: string, periodIndex: number): boolean {
  // Must have a non-space character before the period
  if (periodIndex === 0 || /\s/.test(text[periodIndex - 1])) return false;

  const after = text.slice(periodIndex + 1, periodIndex + 10);
  const extMatch = after.match(/^([a-zA-Z]+)/);
  if (!extMatch) return false;

  const ext = extMatch[1].toLowerCase();
  if (FILE_EXTENSIONS.has(ext)) {
    // Check if the extension is followed by a non-alphanumeric char or end of string
    const afterExt = periodIndex + 1 + extMatch[1].length;
    if (afterExt >= text.length || !/[a-zA-Z0-9]/.test(text[afterExt])) {
      return true;
    }
  }
  return false;
}

/**
 * Rule-based sentence boundary scanner.
 *
 * Scans for sentence-terminal punctuation (., !, ?) followed by whitespace
 * and an uppercase letter, digit, or quote character. Applies suppression
 * rules for abbreviations, decimals, ellipses, URLs, and file extensions.
 *
 * Returns an array of integer positions (index of the first character of
 * each new sentence), sorted ascending.
 */
export function scanSentenceBoundaries(
  text: string,
  customAbbreviations?: ReadonlySet<string>,
): number[] {
  if (!text || text.length === 0) return [];

  const positions: number[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    // Check for sentence-terminal punctuation
    if (ch === '.' || ch === '!' || ch === '?') {
      // Skip ellipsis
      if (ch === '.' && isEllipsis(text, i)) {
        // Skip past all dots in the ellipsis
        while (i < text.length && text[i] === '.') i++;
        continue;
      }

      // For periods, apply suppression rules
      if (ch === '.') {
        if (isDecimalNumber(text, i)) { i++; continue; }
        if (isUrlContext(text, i)) { i++; continue; }
        if (isFileExtension(text, i)) { i++; continue; }

        // Check abbreviation
        const token = getTokenBeforePeriod(text, i);
        if (token.length > 0 && isAbbreviation(token, customAbbreviations)) {
          i++;
          continue;
        }
      }

      // Handle quoted string endings: .", !' , ?"
      let endPunct = i + 1;
      while (endPunct < text.length && (text[endPunct] === '"' || text[endPunct] === "'" || text[endPunct] === '\u201D' || text[endPunct] === '\u2019')) {
        endPunct++;
      }

      // Handle parenthetical endings: .)
      if (endPunct < text.length && text[endPunct] === ')') {
        // Only suppress if not at start of line
        const lineStart = text.lastIndexOf('\n', i) + 1;
        const textBefore = text.slice(lineStart, i).trim();
        if (textBefore.length > 0) {
          endPunct++;
        }
      }

      // Check for whitespace after the terminal punctuation
      if (endPunct >= text.length) {
        // End of string — no new sentence starts
        i = endPunct;
        continue;
      }

      // Look for whitespace followed by uppercase/digit/quote
      let ws = endPunct;
      while (ws < text.length && /[\s]/.test(text[ws])) ws++;

      if (ws > endPunct && ws < text.length) {
        const nextChar = text[ws];
        if (/[A-Z\d"'\u201C\u2018]/.test(nextChar)) {
          positions.push(ws);
        }
      }

      i = endPunct;
      continue;
    }

    i++;
  }

  return positions;
}
