import { describe, it, expect } from 'vitest';
import { computeQualityScore } from '../quality.js';

describe('computeQualityScore', () => {
  it('produces high score (>= 0.9) for clean boundary', () => {
    const score = computeQualityScore({
      tailFragment: '',
      tailFragmentSize: 0,
      headFragment: '',
      headFragmentSize: 0,
      averageSentenceLength: 20,
      isSentenceBoundary: true,
      isParagraphBoundary: true,
      isMidWord: false,
    });
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('produces moderate score for mid-sentence boundary', () => {
    const score = computeQualityScore({
      tailFragment: 'the token is',
      tailFragmentSize: 3,
      headFragment: 'stored securely',
      headFragmentSize: 4,
      averageSentenceLength: 20,
      isSentenceBoundary: false,
      isParagraphBoundary: false,
      isMidWord: false,
    });
    expect(score).toBeLessThan(0.9);
    expect(score).toBeGreaterThan(0.2);
  });

  it('clamps to max 0.1 for mid-word split', () => {
    const score = computeQualityScore({
      tailFragment: 'authen',
      tailFragmentSize: 2,
      headFragment: 'tication',
      headFragmentSize: 2,
      averageSentenceLength: 20,
      isSentenceBoundary: false,
      isParagraphBoundary: false,
      isMidWord: true,
    });
    expect(score).toBeLessThanOrEqual(0.1);
  });

  it('clamps to max 0.35 when tail fragment > 75% of average sentence', () => {
    const score = computeQualityScore({
      tailFragment: 'very long fragment that exceeds threshold',
      tailFragmentSize: 16,
      headFragment: 'continuation',
      headFragmentSize: 3,
      averageSentenceLength: 20,
      isSentenceBoundary: false,
      isParagraphBoundary: false,
      isMidWord: false,
    });
    expect(score).toBeLessThanOrEqual(0.35);
  });

  it('produces high score for paragraph boundary', () => {
    const score = computeQualityScore({
      tailFragment: '',
      tailFragmentSize: 0,
      headFragment: '',
      headFragmentSize: 0,
      averageSentenceLength: 20,
      isSentenceBoundary: true,
      isParagraphBoundary: true,
      isMidWord: false,
    });
    expect(score).toBeGreaterThan(0.85);
  });

  it('produces score in [0, 1] range', () => {
    const inputs = [
      { tailFragmentSize: 0, headFragmentSize: 0, isSentenceBoundary: true, isParagraphBoundary: true },
      { tailFragmentSize: 10, headFragmentSize: 5, isSentenceBoundary: false, isParagraphBoundary: false },
      { tailFragmentSize: 100, headFragmentSize: 0, isSentenceBoundary: false, isParagraphBoundary: false },
    ];

    for (const inp of inputs) {
      const score = computeQualityScore({
        tailFragment: '',
        ...inp,
        headFragment: '',
        averageSentenceLength: 20,
        isMidWord: false,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('zero-length fragments with sentence boundary produce high score', () => {
    const score = computeQualityScore({
      tailFragment: '',
      tailFragmentSize: 0,
      headFragment: '',
      headFragmentSize: 0,
      averageSentenceLength: 20,
      isSentenceBoundary: true,
      isParagraphBoundary: false,
      isMidWord: false,
    });
    expect(score).toBeGreaterThan(0.8);
  });

  it('head start alignment contributes: mid-sentence head lowers score', () => {
    const withCleanHead = computeQualityScore({
      tailFragment: '',
      tailFragmentSize: 0,
      headFragment: '',
      headFragmentSize: 0,
      averageSentenceLength: 20,
      isSentenceBoundary: true,
      isParagraphBoundary: false,
      isMidWord: false,
    });

    const withMidHead = computeQualityScore({
      tailFragment: '',
      tailFragmentSize: 0,
      headFragment: 'continuation text',
      headFragmentSize: 4,
      averageSentenceLength: 20,
      isSentenceBoundary: true,
      isParagraphBoundary: false,
      isMidWord: false,
    });

    expect(withCleanHead).toBeGreaterThan(withMidHead);
  });

  it('fragment symmetry affects score', () => {
    // Symmetric fragments
    const symmetric = computeQualityScore({
      tailFragment: 'text one',
      tailFragmentSize: 5,
      headFragment: 'text two',
      headFragmentSize: 5,
      averageSentenceLength: 40,
      isSentenceBoundary: false,
      isParagraphBoundary: false,
      isMidWord: false,
    });

    // Very asymmetric fragments
    const asymmetric = computeQualityScore({
      tailFragment: 'text one',
      tailFragmentSize: 1,
      headFragment: 'very long text continuation here',
      headFragmentSize: 20,
      averageSentenceLength: 40,
      isSentenceBoundary: false,
      isParagraphBoundary: false,
      isMidWord: false,
    });

    // Symmetric gets higher fragment symmetry component
    expect(symmetric).toBeGreaterThanOrEqual(asymmetric);
  });

  it('handles zero average sentence length', () => {
    const score = computeQualityScore({
      tailFragment: '',
      tailFragmentSize: 0,
      headFragment: '',
      headFragmentSize: 0,
      averageSentenceLength: 0,
      isSentenceBoundary: true,
      isParagraphBoundary: false,
      isMidWord: false,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
