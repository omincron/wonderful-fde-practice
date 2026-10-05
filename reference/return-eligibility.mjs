// Compare only after your own attempt.
export function returnEligibility(order,policy) {
 if(!order||!policy||!Number.isFinite(policy.returnWindowDays)||policy.returnWindowDays<0)return 'invalid_data';
 if(order.status!=='delivered')return 'not_delivered';
 if(!Number.isFinite(order.deliveredDaysAgo)||order.deliveredDaysAgo<0)return 'invalid_data';
 return order.deliveredDaysAgo<=policy.returnWindowDays?'review_eligible':'outside_window';
}
