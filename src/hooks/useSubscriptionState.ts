import { useMemo } from 'react';
import { differenceInDays, startOfDay } from 'date-fns';
import type { Company } from '@/lib/types';
import { GRACE_DAYS } from '@/lib/plans';

export type SubscriptionState = {
  isReadOnly: boolean;
  isTrial: boolean;
  daysLeft: number;
  reason: 'trial_expired' | 'suspended' | 'expired' | null;
  /** Active subscription ending within 7 days (or in the grace period): days left, else null */
  renewInDays?: number | null;
  subscriptionEndsAt?: string | null;
};

export function useSubscriptionState(companyData: Company | null): SubscriptionState {
  return useMemo(() => {
    if (!companyData) {
      return { isReadOnly: false, isTrial: false, daysLeft: 0, reason: null };
    }

    const status = companyData.status;

    if (status === 'active' || !status) {
      // Paid period: read-only only after the end date + GRACE_DAYS. Without an end date it never expires.
      const endsAt = companyData.subscriptionEndsAt;
      if (endsAt) {
        const end = new Date(endsAt);
        if (!isNaN(end.getTime())) {
          const now = new Date();
          const graceEnd = new Date(end.getTime() + GRACE_DAYS * 86_400_000);
          if (now > graceEnd) return { isReadOnly: true, isTrial: false, daysLeft: 0, reason: 'expired', renewInDays: null, subscriptionEndsAt: endsAt };
          const days = differenceInDays(startOfDay(end), startOfDay(now));
          return { isReadOnly: false, isTrial: false, daysLeft: Math.max(0, days), reason: null, renewInDays: days <= 7 ? days : null, subscriptionEndsAt: endsAt };
        }
      }
      return { isReadOnly: false, isTrial: false, daysLeft: 0, reason: null };
    }

    if (status === 'suspended' || (status as string) === 'inactive') {
      return { isReadOnly: true, isTrial: false, daysLeft: 0, reason: 'suspended' };
    }

    if (status === 'trial') {
      if (!companyData.trialEndsAt) {
        // Fallback if no trial date is set
        return { isReadOnly: false, isTrial: true, daysLeft: 0, reason: null };
      }

      const endDate = new Date(companyData.trialEndsAt);
      const today = new Date();

      if (today > endDate) {
        return { isReadOnly: true, isTrial: false, daysLeft: 0, reason: 'trial_expired' };
      } else {
        const days = differenceInDays(startOfDay(endDate), startOfDay(today));
        return { 
          isReadOnly: false, 
          isTrial: true, 
          daysLeft: Math.max(0, days), 
          reason: null 
        };
      }
    }

    return { isReadOnly: false, isTrial: false, daysLeft: 0, reason: null };
  }, [companyData]);
}
