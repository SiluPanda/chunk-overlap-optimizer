import { describe, it, expect } from 'vitest';
import { defaultTokenCounter, resolveTokenCounter } from '../token-counter.js';

describe('defaultTokenCounter', () => {
  it('returns Math.ceil(text.length / 4) for various inputs', () => {
    expect(defaultTokenCounter('')).toBe(0);
    expect(defaultTokenCounter('a')).toBe(1);
    expect(defaultTokenCounter('ab')).toBe(1);
    expect(defaultTokenCounter('abc')).toBe(1);
    expect(defaultTokenCounter('abcd')).toBe(1);
    expect(defaultTokenCounter('abcde')).toBe(2);
  });

  it('handles empty string', () => {
    expect(defaultTokenCounter('')).toBe(0);
  });

  it('handles short text', () => {
    expect(defaultTokenCounter('Hi')).toBe(1);
  });

  it('handles long text', () => {
    const text = 'a'.repeat(100);
    expect(defaultTokenCounter(text)).toBe(25);
  });

  it('rounds up for non-divisible lengths', () => {
    expect(defaultTokenCounter('hello')).toBe(2); // 5/4 = 1.25, ceil = 2
    expect(defaultTokenCounter('hello world')).toBe(3); // 11/4 = 2.75, ceil = 3
  });
});

describe('resolveTokenCounter', () => {
  it('returns default counter when none provided', () => {
    const counter = resolveTokenCounter();
    expect(counter('test')).toBe(1);
  });

  it('returns default counter when undefined provided', () => {
    const counter = resolveTokenCounter(undefined);
    expect(counter('test')).toBe(1);
  });

  it('returns custom counter when provided', () => {
    const custom = (text: string) => text.split(' ').length;
    const counter = resolveTokenCounter(custom);
    expect(counter('hello world')).toBe(2);
  });
});
