// Learning exercise: implement the read-only business rule using order + policy.
// Allowed results: review_eligible, outside_window, not_delivered, invalid_data.
// Eligibility NEVER means that a refund has been approved or executed.
const KNOWN_STATUSES = ['processing', 'shipped', 'delivered'];

// A day count is valid only if it is a whole number of 0 or more (rejects null, -1, '7', NaN, 7.5).
const isValidDays = (value) => Number.isInteger(value) && value >= 0;

export function returnEligibility(order, policy) {
  // 1. The order must exist and have a status we recognise. Unknown statuses are not guessed.
  if (!order || !KNOWN_STATUSES.includes(order.status)) return 'invalid_data';

  // 2. Without a valid return window we cannot judge any request, so stop here.
  if (!policy || !isValidDays(policy.returnWindowDays)) return 'invalid_data';

  // 3. Only delivered orders can be reviewed for a return.
  if (order.status !== 'delivered') return 'not_delivered';

  // 4. Delivered orders need a valid day count; the window boundary is inclusive (14 is still eligible).
  if (!isValidDays(order.deliveredDaysAgo)) return 'invalid_data';
  return order.deliveredDaysAgo <= policy.returnWindowDays ? 'review_eligible' : 'outside_window';
}
