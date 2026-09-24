// auth.ts
import { saveToStorage, getFromStorage, removeFromStorage, getObjectFromStorage, saveObjectToStorage } from '../config/storage';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS, getMobileSecurityHeaders } from '../config/api';

const TOKEN_KEY = 'accessToken';
const USER_KEY = 'authUser';
const REFERRAL_CODE_KEY = 'userReferralCode';

export const saveSession = async (token: string, user: any) => {
  saveToStorage(TOKEN_KEY, token);
  saveObjectToStorage(USER_KEY, user);

  // Save referral code separately for easy access
  if (user.referralCode) {
    saveToStorage(REFERRAL_CODE_KEY, user.referralCode);
  }
};

export const getUser = () => getObjectFromStorage(USER_KEY);

export const getSession = () => {
  return getFromStorage(TOKEN_KEY);
};

export const getReferralCode = () => getFromStorage(REFERRAL_CODE_KEY);

export const clearSession = () => {
  // Clear auth data
  removeFromStorage(TOKEN_KEY);
  removeFromStorage(USER_KEY);
  removeFromStorage(REFERRAL_CODE_KEY);
  
  // Clear mining state (from HomeScrrenNew.tsx)
  removeFromStorage('btcBalance');
  removeFromStorage('adsWatched');
  removeFromStorage('startTime');
  
  // Clear social auth data (from socialAuth.ts)
  removeFromStorage('userToken');
  removeFromStorage('userData');
  
  console.log('✅ All user data cleared from storage');
};

export const isLoggedIn = () => {
  return !!getFromStorage(TOKEN_KEY);
};

export const logoutApi = async () => {
  const token = await getSession();
  if (!token) return;

  try {
    const res = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.LOGOUT}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...getMobileSecurityHeaders(),
      },
    });

    if (!res.data.success) {
      throw new Error(res.data.message || 'Logout failed');
    }

    return res.data;
  } catch (error) {
    console.error('Logout API error:', error);
    throw error;
  }
};