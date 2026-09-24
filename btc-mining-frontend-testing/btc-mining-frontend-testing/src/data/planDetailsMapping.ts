/**
 * Plan Details Mapping
 * Maps subscription plan hashrates to their corresponding details
 * This data is used to display APR, Offer, Free computing power, Gain, and Price information
 */

export interface PlanDetails {
    hashrate: number; // in GH/s
    apr: string; // Annual Percentage Rate
    offer: string; // Special offer text
    freeComputingPower: string; // Free computing power percentage
    // Gain is calculated dynamically: currentPower - selectedHashrate
  }
  
  /**
   * Plan details mapping based on hashrate
   * Values are derived from the app's business logic
   */
  export const PLAN_DETAILS_MAP: Record<number, PlanDetails> = {
    // 100.0 GH/s
    100: {
      hashrate: 100,
      apr: '70.25%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+5.0%',
    },
    
    // 200.0 GH/s
    200: {
      hashrate: 200,
      apr: '75.67%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+10.0%',
    },
    
    // 410.0 GH/s
    410: {
      hashrate: 410,
      apr: '80.50%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+15.0%',
    },
    
    // 1.1 TH/s = 1100 GH/s
    1100: {
      hashrate: 1100,
      apr: '83.35%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+25.0%',
    },
    
    // 2.3 TH/s = 2300 GH/s
    2300: {
      hashrate: 2300,
      apr: '87.55%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+35.0%',
    },
    
    // 3.5 TH/s = 3500 GH/s
    3500: {
      hashrate: 3500,
      apr: '88.40%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+40.0%',
    },
    
    // 4.7 TH/s = 4700 GH/s
    4700: {
      hashrate: 4700,
      apr: '89.01%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+45.0%',
    },
    
    // 10.0 GH/s (from last image)
    10: {
      hashrate: 10,
      apr: '65.50%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+2.0%',
    },
    
    // 1000 TH/s = 1000000 GH/s (from images)
    1000000: {
      hashrate: 1000000,
      apr: '95.00%',
      offer: 'Buy 1,Get 1 free',
      freeComputingPower: '+50.0%',
    },
  };
  
  /**
   * Get plan details by hashrate
   * @param hashrate - The hashrate in the unit stored in the plan (GH/s or TH/s)
   * @param unit - The unit of measurement ('GH/s' or 'TH/s')
   * @returns PlanDetails object with APR, offer, and free computing power info
   */
  export const getPlanDetails = (hashrate: number, unit: string): PlanDetails => {
    // Convert to GH/s if unit is TH/s
    let hashrateInGH = hashrate;
    if (unit === 'TH/s' || unit === 'Th/s' || unit === 'TH') {
      hashrateInGH = hashrate * 1000; // Convert TH to GH
    }
  
    // Try to find exact match
    if (PLAN_DETAILS_MAP[hashrateInGH]) {
      return PLAN_DETAILS_MAP[hashrateInGH];
    }
  
    // If no exact match, find the closest hashrate
    const availableHashrates = Object.keys(PLAN_DETAILS_MAP).map(Number);
    const closest = availableHashrates.reduce((prev, curr) => {
      return Math.abs(curr - hashrateInGH) < Math.abs(prev - hashrateInGH) ? curr : prev;
    });
  
    console.log(`No exact match for ${hashrateInGH} GH/s, using closest: ${closest} GH/s`);
    return PLAN_DETAILS_MAP[closest];
  };
  
  /**
   * Format gain display text
   * @param currentPower - Current mining power
   * @param selectedHashrate - Selected plan hashrate
   * @param selectedUnit - Selected plan unit
   * @returns Formatted gain string (e.g., "100.0 - 200.0 GH/s" or "1.1 - 2.3 TH/s")
   */
  export const formatGain = (
    currentPower: number,
    selectedHashrate: number,
    selectedUnit: string
  ): string => {
    // If selected plan is in TH/s and hashrate is >= 1000 GH/s, display in TH/s
    if (selectedUnit.includes('TH') || selectedUnit.includes('Th')) {
      const currentInTH = (currentPower / 1000).toFixed(1);
      const selectedInTH = selectedHashrate.toFixed(1);
      return `${currentInTH} - ${selectedInTH} TH/s`;
    }
    
    // Otherwise display in GH/s
    return `${currentPower.toFixed(1)} - ${selectedHashrate.toFixed(1)} GH/s`;
  };
  
  /**
   * Default plan details for fallback
   */
  export const DEFAULT_PLAN_DETAILS: PlanDetails = {
    hashrate: 0,
    apr: '70.00%',
    offer: 'Buy 1,Get 1 free',
    freeComputingPower: '+5.0%',
  };
  
