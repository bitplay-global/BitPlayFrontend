import Purchases, { 
  PurchasesOffering, 
  PurchasesPackage, 
  CustomerInfo,
  PURCHASES_ERROR_CODE 
} from 'react-native-purchases';

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}

export interface OfferingData {
  identifier: string;
  serverDescription: string;
  packages: PurchasesPackage[];
}

class PurchaseService {
  /**
   * Get current offerings from RevenueCat
   */
  async getOfferings(): Promise<PurchasesOffering[] | null> {
    try {
      const offerings = await Purchases.getOfferings();
      console.log('offerings', offerings)
      return offerings.all ? Object.values(offerings.all) : null;
    } catch (error) {
      console.error('Error getting offerings:', error);
      return null;
    }
  }

  /**
   * Get current customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('Error getting customer info:', error);
      return null;
    }
  }

  /**
   * Purchase a package
   */
  async purchasePackage(purchasePackage: PurchasesPackage): Promise<PurchaseResult> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(purchasePackage);
      return {
        success: true,
        customerInfo,
      };
    } catch (error: any) {
      console.error('Purchase error:', error);
      
      // Handle specific error cases
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return {
          success: false,
          error: 'Purchase was cancelled',
        };
      } else if (error.code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR) {
        return {
          success: false,
          error: 'There was a problem with the store',
        };
      } else if (error.code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
        return {
          success: false,
          error: 'Purchase not allowed',
        };
      } else if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        return {
          success: false,
          error: 'Payment is pending',
        };
      }
      
      return {
        success: false,
        error: error.message || 'Unknown purchase error',
      };
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<PurchaseResult> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return {
        success: true,
        customerInfo,
      };
    } catch (error: any) {
      console.error('Restore purchases error:', error);
      return {
        success: false,
        error: error.message || 'Failed to restore purchases',
      };
    }
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      if (!customerInfo) return false;

      // Check if user has any active entitlements
      const activeEntitlements = customerInfo.entitlements.active;
      return Object.keys(activeEntitlements).length > 0;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Check if user has specific entitlement
   */
  async hasEntitlement(entitlementId: string): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      if (!customerInfo) return false;

      return customerInfo.entitlements.active[entitlementId] !== undefined;
    } catch (error) {
      console.error('Error checking entitlement:', error);
      return false;
    }
  }

  /**
   * Get subscription expiry date
   */
  async getSubscriptionExpiryDate(entitlementId: string): Promise<Date | null> {
    try {
      const customerInfo = await this.getCustomerInfo();
      if (!customerInfo) return null;

      const entitlement = customerInfo.entitlements.active[entitlementId];
      if (!entitlement?.expirationDate) return null;
      
      return new Date(entitlement.expirationDate);
    } catch (error) {
      console.error('Error getting subscription expiry:', error);
      return null;
    }
  }
}

export const purchaseService = new PurchaseService();
export default purchaseService;