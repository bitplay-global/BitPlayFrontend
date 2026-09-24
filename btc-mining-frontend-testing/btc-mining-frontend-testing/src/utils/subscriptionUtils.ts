import { purchaseService } from '../services/purchaseService';

/**
 * Utility functions for subscription management
 */

// Common entitlement IDs - update these based on your RevenueCat configuration
export const ENTITLEMENTS = {
  PREMIUM: 'premium',
  PRO: 'pro',
  UNLIMITED: 'unlimited',
} as const;

// Common package types
export const PACKAGE_TYPES = {
  WEEKLY: '$rc_weekly',
  MONTHLY: '$rc_monthly',
  TWO_MONTH: '$rc_two_month',
  THREE_MONTH: '$rc_three_month',
  SIX_MONTH: '$rc_six_month',
  ANNUAL: '$rc_annual',
  LIFETIME: '$rc_lifetime',
} as const;

/**
 * Check if user has premium access
 */
export const hasPremiumAccess = async (): Promise<boolean> => {
  try {
    return await purchaseService.hasEntitlement(ENTITLEMENTS.PREMIUM);
  } catch (error) {
    return false;
  }
};

/**
 * Check if user has any active subscription
 */
export const hasAnySubscription = async (): Promise<boolean> => {
  try {
    return await purchaseService.hasActiveSubscription();
  } catch (error) {
    return false;
  }
};

/**
 * Get subscription expiry date for premium
 */
export const getPremiumExpiryDate = async (): Promise<Date | null> => {
  try {
    return await purchaseService.getSubscriptionExpiryDate(ENTITLEMENTS.PREMIUM);
  } catch (error) {
    return null;
  }
};

/**
 * Get days until subscription expires
 */
export const getDaysUntilExpiry = async (entitlementId: string = ENTITLEMENTS.PREMIUM): Promise<number | null> => {
  try {
    const expiryDate = await purchaseService.getSubscriptionExpiryDate(entitlementId);
    if (!expiryDate) return null;

    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    return null;
  }
};

/**
 * Check if subscription is about to expire (within specified days)
 */
export const isSubscriptionExpiringSoon = async (
  daysThreshold: number = 7,
  entitlementId: string = ENTITLEMENTS.PREMIUM
): Promise<boolean> => {
  try {
    const daysUntilExpiry = await getDaysUntilExpiry(entitlementId);
    if (daysUntilExpiry === null) return false;
    
    return daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
  } catch (error) {
    return false;
  }
};

/**
 * Format subscription status for display
 */
export const getSubscriptionStatus = async (): Promise<{
  hasSubscription: boolean;
  expiryDate: Date | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
}> => {
  try {
    const [hasSubscription, expiryDate, daysUntilExpiry, isExpiringSoon] = await Promise.all([
      hasAnySubscription(),
      getPremiumExpiryDate(),
      getDaysUntilExpiry(),
      isSubscriptionExpiringSoon(),
    ]);

    return {
      hasSubscription,
      expiryDate,
      daysUntilExpiry,
      isExpiringSoon,
    };
  } catch (error) {
    return {
      hasSubscription: false,
      expiryDate: null,
      daysUntilExpiry: null,
      isExpiringSoon: false,
    };
  }
};

/**
 * Show upgrade prompt based on subscription status
 */
export const shouldShowUpgradePrompt = async (): Promise<boolean> => {
  try {
    const hasSubscription = await hasAnySubscription();
    return !hasSubscription;
  } catch (error) {
    return true; // Show upgrade prompt on error to be safe
  }
};

/**
 * Get recommended package based on user behavior (can be customized)
 */
export const getRecommendedPackage = async () => {
  try {
    const offerings = await purchaseService.getOfferings();
    if (!offerings || offerings.length === 0) return null;

    // Return the first package of the first offering as default
    // You can customize this logic based on user behavior, analytics, etc.
    const firstOffering = offerings[0];
    if (firstOffering.availablePackages.length === 0) return null;

    // Prefer annual package if available, otherwise return first package
    const annualPackage = firstOffering.availablePackages.find(
      pkg => pkg.identifier.includes('annual') || pkg.identifier.includes('yearly')
    );
    
    return annualPackage || firstOffering.availablePackages[0];
  } catch (error) {
    return null;
  }
};