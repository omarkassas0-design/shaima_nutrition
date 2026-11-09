import { useClinic } from '@/lib/useClinic';

export function useSubscriptionCheck() {
  const { clinic } = useClinic();

  const isSubscriptionActive = () => {
    if (!clinic) return false;
    if (clinic.subscription_status === 'active') return true;
    if (clinic.subscription_status === 'trial') {
      return !clinic.trial_ends_at || new Date(clinic.trial_ends_at) >= new Date();
    }
    return false;
  };

  const isExpired = () => {
    if (!clinic) return false;
    if (clinic.subscription_status === 'expired' || clinic.subscription_status === 'suspended') return true;
    if (clinic.subscription_status === 'trial' && clinic.trial_ends_at) {
      return new Date(clinic.trial_ends_at) < new Date();
    }
    return false;
  };

  return { isSubscriptionActive, isExpired, clinic };
}