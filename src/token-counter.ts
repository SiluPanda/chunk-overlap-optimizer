/**
 * Default approximate token counter.
 * Estimates token count as Math.ceil(text.length / 4).
 */
export function defaultTokenCounter(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Returns the provided token counter, or the default if none was provided.
 */
export function resolveTokenCounter(
  tokenCounter?: (text: string) => number,
): (text: string) => number {
  return tokenCounter ?? defaultTokenCounter;
}
