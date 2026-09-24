import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { purchaseService, PurchaseResult } from '../services/purchaseService';

export interface UsePurchasesReturn {
  offerings: PurchasesOffering[] | null;
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  hasActiveSubscription: boolean;
  purchasePackage: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  refreshCustomerInfo: () => Promise<void>;
  hasEntitlement: (entitlementId: string) => boolean;
}

export const usePurchases = (): UsePurchasesReturn => {
  const [offerings, setOfferings] = useState<PurchasesOffering[] | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and fetch data
  useEffect(() => {
    initializePurchases();
  }, []);

  const initializePurchases = async () => {
    try {
      setIsLoading(true);
      
      // Fetch offerings and customer info
      const [offeringsData, customerData] = await Promise.all([
        purchaseService.getOfferings(),
        purchaseService.getCustomerInfo(),
      ]);

      setOfferings(offeringsData);
      setCustomerInfo(customerData);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCustomerInfo = useCallback(async () => {
    try {
      const customerData = await purchaseService.getCustomerInfo();
      setCustomerInfo(customerData);
    } catch (error) {
    }
  }, []);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<PurchaseResult> => {
    try {
      const result = await purchaseService.purchasePackage(pkg);
      
      if (result.success && result.customerInfo) {
        setCustomerInfo(result.customerInfo);
        Alert.alert('Success', 'Purchase completed successfully!');
      } else {
        Alert.alert('Purchase Failed', result.error || 'Unknown error occurred');
      }
      
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: 'Purchase failed',
      };
      Alert.alert('Error', 'Purchase failed. Please try again.');
      return errorResult;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    try {
      const result = await purchaseService.restorePurchases();
      
      if (result.success && result.customerInfo) {
        setCustomerInfo(result.customerInfo);
        Alert.alert('Success', 'Purchases restored successfully!');
      } else {
        Alert.alert('Restore Failed', result.error || 'No purchases to restore');
      }
      
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: 'Restore failed',
      };
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
      return errorResult;
    }
  }, []);

  const hasActiveSubscription = customerInfo ? 
    Object.keys(customerInfo.entitlements.active).length > 0 : false;

  const hasEntitlement = useCallback((entitlementId: string): boolean => {
    return customerInfo?.entitlements.active[entitlementId] !== undefined;
  }, [customerInfo]);

  return {
    offerings,
    customerInfo,
    isLoading,
    hasActiveSubscription,
    purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
    hasEntitlement,
  };
};