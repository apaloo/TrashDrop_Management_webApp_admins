import { inviteUrl, whatsappUrl, isInviteToken, rememberInvite, pendingInvite, forgetInvite } from '../teamInvite';

const token = 'a'.repeat(32) + '0123456789abcdef0123456789abcdef';

beforeEach(() => localStorage.clear());

it('builds the link and the WhatsApp message', () => {
  expect(inviteUrl(token, 'https://trashdrops.com')).toBe(`https://trashdrops.com/join/${token}`);
  expect(whatsappUrl('Clean Accra', 'https://x/join/t'))
    .toBe(`https://wa.me/?text=${encodeURIComponent('Join Clean Accra on TrashDrop: https://x/join/t')}`);
});

it('only remembers real invite tokens, until forgotten', () => {
  expect(isInviteToken(token)).toBe(true);
  expect(isInviteToken('../../etc')).toBe(false);
  expect(isInviteToken(token.toUpperCase())).toBe(false);
  rememberInvite('not-a-token');
  expect(pendingInvite()).toBeNull();
  rememberInvite(token);
  expect(pendingInvite()).toBe(token);
  forgetInvite();
  expect(pendingInvite()).toBeNull();
});
