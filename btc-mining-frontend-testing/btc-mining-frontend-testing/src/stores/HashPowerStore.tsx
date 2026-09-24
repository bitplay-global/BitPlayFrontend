import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getObjectFromStorage } from "../config/storage";
import { getHomeCacheKey, isValidHomeCache } from "../config/homeCache";

type HashPowerContextType = {
  hashPower: number;
  setHashPower: (val: number) => void;
  addHashPower: (val: number) => void;
  resetHashPower: () => void;
  /** From API `mining_details.purchasedHashpower`; >0 means user may exceed free cap. */
  purchasedHashpowerGh: number;
  setPurchasedHashpowerGh: (val: number) => void;
  /** null = not yet known, true = mining is active, false = mining is not active */
  isMiningActive: boolean | null;
  setIsMiningActive: (val: boolean | null) => void;
};

const HashPowerContext = createContext<HashPowerContextType | undefined>(undefined);

export const HashPowerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hashPower, setHashPowerState] = useState(0);
  const [purchasedHashpowerGh, setPurchasedHashpowerGhState] = useState(0);
  const [isMiningActive, setIsMiningActiveState] = useState<boolean | null>(null);
  const { user } = useAuth();

  // Reset hashpower on logout, or seed it from this user's last-known cached
  // value on login/account-switch (HomeScreen persists this cache on every
  // successful fetch) so the header doesn't flash 0 Gh/s while
  // USERMININGDETAILS is still loading. Deliberately NOT left to HomeScreen
  // itself to restore -- this effect runs on every user?.id change regardless
  // of which screen is mounted, and as the ancestor provider it always fires
  // after any descendant's own effects in the same commit, so a restore
  // attempted from HomeScreen would just get clobbered back to 0 here.
  useEffect(() => {
    if (!user) {
      setHashPowerState(0);
      setPurchasedHashpowerGhState(0);
      setIsMiningActiveState(null);
      return;
    }
    const cached = getObjectFromStorage(getHomeCacheKey(user.id));
    setHashPowerState(isValidHomeCache(cached) ? cached.hashPower : 0);
    setPurchasedHashpowerGhState(isValidHomeCache(cached) ? cached.purchasedHashpowerGh : 0);
    // Mining-active state is intentionally left null (unknown) even with a
    // cache hit -- it's a status that must be confirmed by the server before
    // any mining-dependent UI treats it as true, unlike the numeric displays.
    setIsMiningActiveState(null);
  }, [user?.id]);

  const setHashPower = (val: number) => setHashPowerState(val);
  const addHashPower = (val: number) => setHashPowerState((prev) => prev + val);

  const resetHashPower = () => {
    setHashPowerState(0);
  };

  const setPurchasedHashpowerGh = (val: number) => {
    const n = typeof val === 'number' && Number.isFinite(val) ? val : 0;
    setPurchasedHashpowerGhState(Math.max(0, n));
  };

  const setIsMiningActive = (val: boolean | null) => setIsMiningActiveState(val);

  return (
    <HashPowerContext.Provider
      value={{
        hashPower,
        setHashPower,
        addHashPower,
        resetHashPower,
        purchasedHashpowerGh,
        setPurchasedHashpowerGh,
        isMiningActive,
        setIsMiningActive,
      }}
    >
      {children}
    </HashPowerContext.Provider>
  );
};

export const useHashPower = () => {
  const ctx = useContext(HashPowerContext);
  if (!ctx) throw new Error("useHashPower must be used inside HashPowerProvider");
  return ctx;
};
