import { describe, it, expect } from 'vitest';
import {
  isAbbreviation,
  compileAbbreviations,
  BUILT_IN_ABBREVIATIONS,
} from '../../sentence/abbreviations.js';

describe('BUILT_IN_ABBREVIATIONS', () => {
  it('contains title abbreviations', () => {
    expect(BUILT_IN_ABBREVIATIONS.has('mr')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('mrs')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('dr')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('prof')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('jr')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('sr')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('rev')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('gen')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('sgt')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('col')).toBe(true);
  });

  it('contains geographic abbreviations', () => {
    expect(BUILT_IN_ABBREVIATIONS.has('st')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('ave')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('blvd')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('inc')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('ltd')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('corp')).toBe(true);
  });

  it('contains latin/academic abbreviations', () => {
    expect(BUILT_IN_ABBREVIATIONS.has('etc')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('al')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('vs')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('cf')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('ibid')).toBe(true);
  });

  it('contains month abbreviations', () => {
    expect(BUILT_IN_ABBREVIATIONS.has('jan')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('feb')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('mar')).toBe(true);
    expect(BUILT_IN_ABBREVIATIONS.has('dec')).toBe(true);
  });

  it('contains single letters A-Z', () => {
    for (let i = 65; i <= 90; i++) {
      expect(BUILT_IN_ABBREVIATIONS.has(String.fromCharCode(i).toLowerCase())).toBe(true);
    }
  });
});

describe('isAbbreviation', () => {
  it('matches built-in abbreviations case-insensitively', () => {
    expect(isAbbreviation('Dr')).toBe(true);
    expect(isAbbreviation('dr')).toBe(true);
    expect(isAbbreviation('DR')).toBe(true);
    expect(isAbbreviation('Mr')).toBe(true);
    expect(isAbbreviation('etc')).toBe(true);
  });

  it('rejects non-abbreviation tokens', () => {
    expect(isAbbreviation('the')).toBe(false);
    expect(isAbbreviation('hello')).toBe(false);
    expect(isAbbreviation('world')).toBe(false);
  });

  it('matches custom abbreviations', () => {
    const custom = compileAbbreviations(['API', 'SDK']);
    expect(isAbbreviation('API', custom)).toBe(true);
    expect(isAbbreviation('api', custom)).toBe(true);
    expect(isAbbreviation('SDK', custom)).toBe(true);
    expect(isAbbreviation('sdk', custom)).toBe(true);
  });

  it('custom abbreviations merge with built-in', () => {
    const custom = compileAbbreviations(['API']);
    expect(isAbbreviation('Dr', custom)).toBe(true); // built-in still works
    expect(isAbbreviation('API', custom)).toBe(true); // custom works too
  });

  it('single letter abbreviations work', () => {
    expect(isAbbreviation('A')).toBe(true);
    expect(isAbbreviation('J')).toBe(true);
    expect(isAbbreviation('Z')).toBe(true);
  });
});

describe('compileAbbreviations', () => {
  it('creates a set from an array', () => {
    const result = compileAbbreviations(['API', 'SDK', 'HTTP']);
    expect(result.has('api')).toBe(true);
    expect(result.has('sdk')).toBe(true);
    expect(result.has('http')).toBe(true);
  });

  it('converts to lowercase', () => {
    const result = compileAbbreviations(['MyAbbr']);
    expect(result.has('myabbr')).toBe(true);
    expect(result.has('MyAbbr')).toBe(false);
  });

  it('handles empty array', () => {
    const result = compileAbbreviations([]);
    expect(result.size).toBe(0);
  });
});
