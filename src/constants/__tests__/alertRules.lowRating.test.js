// The low-rating alert rule (household repository issue #186; owner 2026-11-13)
import { ALERT_RULES, ALERT_TYPES } from '../alerts';
import { normalizeViewRow } from '../../utils/pickupRequestUtils';

test('the rule is listed with its threshold and an alert type staff can filter on', () => {
  const rule = ALERT_RULES.find((r) => r.key === 'low_rating');
  expect(rule).toMatchObject({ type: 'low_rating', params: [{ key: 'max_stars', min: 1, max: 4 }] });
  expect(ALERT_TYPES.find((t) => t.key === 'low_rating')).toMatchObject({ entity: 'pickup_request' });
});

test("every rule's alert type exists", () => {
  ALERT_RULES.forEach((r) => expect(ALERT_TYPES.some((t) => t.key === r.type)).toBe(true));
});

test('the request view row carries the rating, when it was given and the comment', () => {
  const row = normalizeViewRow({ id: 'b1', source: 'digital_bins', status: 'disposed', customer_rating: '2', rated_at: '2026-11-13T10:00:00Z', rating_comment: 'Late' });
  expect(row).toMatchObject({ customerRating: 2, ratedAt: '2026-11-13T10:00:00Z', ratingComment: 'Late' });
  expect(normalizeViewRow({ id: 'b2', source: 'digital_bins' })).toMatchObject({ customerRating: null, ratedAt: null, ratingComment: null });
});
