import type { EmbedFn } from './types.js';

/**
 * Compute cosine similarity between two vectors.
 * Returns 0 for zero-norm vectors. Validates equal length.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector length mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const normProduct = Math.sqrt(normA) * Math.sqrt(normB);
  if (normProduct === 0) return 0;

  return dot / normProduct;
}

/**
 * Embed multiple unique texts with concurrency limiting and deduplication.
 *
 * Returns a map from text to embedding vector.
 */
export async function embedTextsWithDedup(
  texts: string[],
  embedFn: EmbedFn,
  concurrency: number,
): Promise<Map<string, number[]>> {
  const uniqueTexts = [...new Set(texts)];
  const results = new Map<string, number[]>();
  const errors = new Map<string, Error>();

  // Process in batches of `concurrency`
  for (let i = 0; i < uniqueTexts.length; i += concurrency) {
    const batch = uniqueTexts.slice(i, i + concurrency);
    const promises = batch.map(async (text) => {
      try {
        const embedding = await embedFn(text);
        results.set(text, embedding);
      } catch (err) {
        errors.set(text, err instanceof Error ? err : new Error(String(err)));
      }
    });
    await Promise.all(promises);
  }

  return results;
}

/**
 * Get the set of errors from an embed operation.
 */
export function getEmbedErrors(
  texts: string[],
  embeddings: Map<string, number[]>,
): string[] {
  return texts.filter(t => !embeddings.has(t));
}
