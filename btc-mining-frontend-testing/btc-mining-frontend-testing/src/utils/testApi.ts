/**
 * API Testing Utilities
 * Functions to test API connectivity and endpoints
 */

import { API_BASE_URL, API_ENDPOINTS, apiRequest } from '../config/api';

// Test API connectivity
export const testApiConnectivity = async (): Promise<{
  success: boolean;
  message: string;
  url: string;
}> => {
  try {
    
    // Try to fetch health endpoint
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.HEALTH}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000, // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `API is reachable. Server: ${data.message || 'Running'}`,
        url: API_BASE_URL,
      };
    } else {
      return {
        success: false,
        message: `API returned status: ${response.status}`,
        url: API_BASE_URL,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Connection failed: ${error.message || 'Network error'}`,
      url: API_BASE_URL,
    };
  }
};

// Test user registration
export const testUserRegistration = async (testData: {
  name: string;
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> => {
  try {
    
    const data = await apiRequest(API_ENDPOINTS.REGISTER, {
      method: 'POST',
      body: JSON.stringify(testData),
    });

    return {
      success: true,
      message: 'Registration successful',
      data,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Registration failed',
    };
  }
};

// Test user login
export const testUserLogin = async (credentials: {
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> => {
  try {
    
    const data = await apiRequest(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    return {
      success: true,
      message: 'Login successful',
      data,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Login failed',
    };
  }
};

// Get current API configuration info
export const getApiInfo = () => {
  return {
    baseUrl: API_BASE_URL,
    endpoints: API_ENDPOINTS,
    isProduction: API_BASE_URL.includes('vercel.app'),
    isLocal: API_BASE_URL.includes('localhost') || API_BASE_URL.includes('192.168'),
  };
};

export default {
  testApiConnectivity,
  testUserRegistration,
  testUserLogin,
  getApiInfo,
};
