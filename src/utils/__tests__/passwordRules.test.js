import { passwordProblem, passwordScore } from '../passwordRules';

const me = { email: 'ama.mensah@example.com', firstName: 'Ama', lastName: 'Mensah' };

describe('passwordProblem', () => {
  it.each([
    ['', 'Password is required'],
    ['Ab1!', /at least 8/],
    ['password1', /too easy to guess/],
    ['Password1!', /too easy to guess/],
    ['Trashdrop2026', /too easy to guess/],
    ['12345678', /too easy to guess/],
    ['aaaaaaaa', /too easy to guess/],
    ['mensah-rocks-2026', /your name or email/],
    ['amamensah99X', /your name or email/],
    ['bluegreenho', /12 or more characters/],
    ['bluegreen7', /mix in at least two/],
  ])('refuses %p', (password, expected) => {
    expect(passwordProblem(password, me)).toMatch(expected);
  });

  it.each(['Blue-house7', 'Kente9cloth', 'bluegreenhouse', 'slow river under the bridge', 'Strong-pass1'])('accepts %p', (password) => {
    expect(passwordProblem(password, me)).toBeNull();
  });

  it('ignores short names, which would refuse too much', () => {
    expect(passwordProblem('Kofi-Ama-77x', { firstName: 'Ama' })).toBeNull();
  });
});

it('passwordScore counts length, capitals, numbers and symbols', () => {
  expect(passwordScore('')).toBe(0);
  expect(passwordScore('password1')).toBe(2);
  expect(passwordScore('Blue-house7')).toBe(4);
});
