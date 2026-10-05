import test from 'node:test';
import assert from 'node:assert/strict';
import { returnEligibility } from '../src/return-eligibility.mjs';
const p = { returnWindowDays: 14 };
for (const [days, expected] of [
  [7, 'review_eligible'],
  [14, 'review_eligible'],
  [15, 'outside_window'],
  [null, 'invalid_data'],
  [-1, 'invalid_data'],
])
  test(`days ${days}`, () =>
    assert.equal(returnEligibility({ status: 'delivered', deliveredDaysAgo: days }, p), expected));
test('not delivered', () =>
  assert.equal(
    returnEligibility({ status: 'shipped', deliveredDaysAgo: null }, p),
    'not_delivered',
  ));
test('missing policy', () =>
  assert.equal(
    returnEligibility({ status: 'delivered', deliveredDaysAgo: 7 }, {}),
    'invalid_data',
  ));
