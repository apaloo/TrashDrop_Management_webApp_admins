// One password rule for sign-up and password reset.
//
// The rule: at least 8 characters, and either 12 or more characters or a mix
// of at least two of capital letters, numbers and symbols. A password built on
// a common word ("password1", "Trashdrop2026!") or on the person's own name or
// email is refused whatever its length.

export const MIN_PASSWORD_LENGTH = 8;
const LONG_PASSWORD_LENGTH = 12;

// Compared after removing numbers and symbols, in lower case
const COMMON_WORDS = [
  'password', 'passw', 'pass', 'qwerty', 'qwertyuiop', 'asdf', 'asdfgh', 'zxcvbn',
  'abc', 'abcd', 'abcdef', 'letmein', 'welcome', 'admin', 'administrator', 'login',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'football', 'master', 'secret',
  'trashdrop', 'trashdrops', 'trash', 'ghana', 'accra', 'kumasi', 'changeme', 'test', 'user',
];

/** 0-4: one point each for length, capitals, numbers and symbols */
export const passwordScore = (password = '') =>
  (password.length >= MIN_PASSWORD_LENGTH ? 1 : 0)
  + (/[A-Z]/.test(password) ? 1 : 0)
  + (/[0-9]/.test(password) ? 1 : 0)
  + (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

/**
 * What is wrong with a password, or null if it is fine.
 * `personal` is the person's own details (email, first and last name).
 */
export const passwordProblem = (password = '', personal = {}) => {
  if (!password) return 'Password is required';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

  const lower = password.toLowerCase();
  const lettersOnly = lower.replace(/[^a-z]/g, '');
  if (!lettersOnly || /^(.)\1+$/.test(lower) || COMMON_WORDS.includes(lettersOnly)) {
    return 'That password is too easy to guess. Avoid common words like "password" and simple number runs.';
  }

  const emailName = String(personal.email || '').toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '');
  const names = [emailName, personal.firstName, personal.lastName]
    .map(n => String(n || '').toLowerCase().trim())
    .filter(n => n.length >= 4);
  if (names.some(n => lower.includes(n))) {
    return "Don't use your name or email address in your password.";
  }

  const mix = passwordScore(password) - 1; // capitals, numbers, symbols
  if (password.length < LONG_PASSWORD_LENGTH && mix < 2) {
    return 'Use 12 or more characters, or mix in at least two of: capital letters, numbers, symbols.';
  }
  return null;
};
