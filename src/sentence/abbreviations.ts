const TITLES = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'Rev', 'Gen', 'Sgt',
  'Cpl', 'Pvt', 'Pte', 'Capt', 'Lt', 'Col', 'Maj', 'Brig', 'Adm',
];

const GEOGRAPHIC = [
  'St', 'Ave', 'Blvd', 'Rd', 'Dept', 'Corp', 'Inc', 'Ltd', 'Co', 'Gov',
];

const LATIN_ACADEMIC = [
  'etc', 'al', 'approx', 'vs', 'cf', 'viz', 'e.g', 'i.e', 'op', 'cit', 'ibid',
];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Single uppercase letters (A-Z)
const SINGLE_LETTERS: string[] = [];
for (let i = 65; i <= 90; i++) {
  SINGLE_LETTERS.push(String.fromCharCode(i));
}

/** All built-in abbreviations. */
export const BUILT_IN_ABBREVIATIONS: ReadonlySet<string> = new Set(
  [...TITLES, ...GEOGRAPHIC, ...LATIN_ACADEMIC, ...MONTHS, ...SINGLE_LETTERS]
    .map(a => a.toLowerCase()),
);

/**
 * Check if a token is a known abbreviation.
 * Checks both built-in and optional custom abbreviations.
 */
export function isAbbreviation(
  token: string,
  customAbbreviations?: ReadonlySet<string>,
): boolean {
  const lower = token.toLowerCase();
  if (BUILT_IN_ABBREVIATIONS.has(lower)) return true;
  if (customAbbreviations && customAbbreviations.has(lower)) return true;
  return false;
}

/**
 * Compile a set of custom abbreviations for efficient lookup.
 */
export function compileAbbreviations(abbreviations: string[]): ReadonlySet<string> {
  return new Set(abbreviations.map(a => a.toLowerCase()));
}
