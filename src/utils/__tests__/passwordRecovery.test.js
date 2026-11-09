import { isRecoveryLink, rememberRecovery, forgetRecovery, hasRememberedRecovery } from '../passwordRecovery';

const at = (pathname, search = '', hash = '') => ({ pathname, search, hash });

describe('isRecoveryLink', () => {
  test('recognises the ?code= link that PKCE sign-in sends', () => {
    expect(isRecoveryLink(at('/reset-password', '?code=abc'))).toBe(true);
  });

  test('recognises the older #type=recovery link', () => {
    expect(isRecoveryLink(at('/reset-password', '', '#access_token=x&type=recovery'))).toBe(true);
  });

  test('a code on any other page is not a reset', () => {
    expect(isRecoveryLink(at('/dashboard', '?code=abc'))).toBe(false);
    expect(isRecoveryLink(at('/', '?code=abc'))).toBe(false);
  });

  test('the reset page with no link is not a reset', () => {
    expect(isRecoveryLink(at('/reset-password'))).toBe(false);
  });
});

test('remembers a reset for the tab until it is finished', () => {
  forgetRecovery();
  expect(hasRememberedRecovery()).toBe(false);
  rememberRecovery();
  expect(hasRememberedRecovery()).toBe(true);
  forgetRecovery();
  expect(hasRememberedRecovery()).toBe(false);
});
