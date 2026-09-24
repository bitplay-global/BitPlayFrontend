import { useEffect, useState } from 'react';
import { getSession } from './auth';

export const useAuth = () => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const token = getSession();
      console.log('Session token:', token);
      setAuthenticated(!!token);
    } catch (error) {
      console.warn('Failed to get session:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, authenticated };
};
