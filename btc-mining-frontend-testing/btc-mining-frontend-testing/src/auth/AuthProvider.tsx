import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSession, saveSession, clearSession, getUser, logoutApi } from './auth';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  AppleRequestOperation,
  AppleRequestScope,
} from '@invertase/react-native-apple-authentication';
import appleAuth from '@invertase/react-native-apple-authentication';
import { apiRequest, API_ENDPOINTS, setAuthExpiredHandler } from '../config/api';
import { Alert } from 'react-native';

type AuthContextType = {
  authenticated: boolean;
  loading: boolean;
  user: any | null;
  login: (token: string, user: object) => Promise<void>;
  logout: () => void;
  /** `referralCode` is the optional code typed on the signup form. Social
   *  signups previously had no way to pass one, so every Google/Apple user
   *  was created unattributed. */
  loginWithGoogle: (referralCode?: string) => Promise<{ isNewUser: boolean }>;
  loginWithApple: (referralCode?: string) => Promise<{ isNewUser: boolean }>;
  updateUser: (userData: any) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const token = await getSession();
      const userData = await getUser();
      setAuthenticated(!!token);
      setUser(userData);
      setLoading(false);
    };
    checkSession();
  }, []);

  // Any authenticated API call that comes back with an expired/invalid
  // token (see setAuthExpiredHandler in config/api.ts) forces a logout
  // through here, so the root navigator's `authenticated` check swaps back
  // to the login flow instead of leaving the user stuck on a screen that
  // can never load. Routed through a ref so the registered callback always
  // calls the current `logout` closure, not whatever it was on first mount.
  const logoutRef = useRef<() => void>(() => {});
  useEffect(() => {
    logoutRef.current = () => logout();
  });
  useEffect(() => {
    setAuthExpiredHandler(() => logoutRef.current());
    return () => setAuthExpiredHandler(null);
  }, []);

  const login = async (token: string, user: object) => {
    await saveSession(token, user);
    setAuthenticated(true);
    setUser(user);
  };

  const logout = async () => {
    try {
      await logoutApi();
      await auth().signOut();
      await GoogleSignin.signOut();
    } catch (error) {
      console.warn('Server logout failed, clearing session anyway.');
    } finally {
      await clearSession();
      setAuthenticated(false);
      setUser(null);
    }
  };

  /** -------------------
   *  GOOGLE LOGIN
   *  ------------------- */
  const loginWithGoogle = async (referralCode?: string) => {
    try {
      // Ensure Google Play Services are available
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign in and get ID token
      const { data } = await GoogleSignin.signIn();
      const idToken = data?.idToken;
      
      // The signIn() user object carries no access token on either platform
      // (google-signin v15); getTokens() is the way to get one.
      let accessToken: string | null = null;
      try {
        const tokens = await GoogleSignin.getTokens();
        accessToken = tokens?.accessToken || null;
      } catch (tokenError) {
        console.warn('Could not retrieve access token:', tokenError);
        // Fallback to serverAuthCode (though it's not the same as accessToken)
        accessToken = data?.serverAuthCode || null;
      }
      
      if (!idToken) throw new Error('Google Sign-In failed: No ID token returned.');

      // Create Firebase credential
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign in with Firebase
      const userCredential = await auth().signInWithCredential(googleCredential);
      const firebaseUser = userCredential.user;

      // Extract user info from Firebase
      const { uid, displayName, email, photoURL } = firebaseUser;

      // ✅ CRITICAL: Call backend to create/update user in MongoDB
      const backendResponse = await apiRequest(API_ENDPOINTS.SOCIAL_LOGIN, {
        method: 'POST',
        body: JSON.stringify({
          provider: 'google',           // Required: 'google'
          providerId: uid,              // Required: Firebase UID
          name: displayName || '',      // Optional: User's display name
          email: email || '',           // Required: User's email
          photo: photoURL || null,      // Optional: Profile photo URL
          accessToken: accessToken || null, // Optional: Access token
          // Verified server-side; the backend no longer trusts `email` alone.
          idToken: idToken || null,
          firebaseIdToken: await firebaseUser.getIdToken().catch(() => null),
          referral_code: referralCode?.trim().toLowerCase() || '' // Optional: who invited them
        }),
      });

      if (!backendResponse.success) {
        throw new Error(backendResponse.message || 'Backend authentication failed');
      }

      // ✅ CRITICAL: Use MongoDB _id from backend, NOT Firebase UID
      const mongoUserId = backendResponse.user.id; // This is the MongoDB ObjectId
      const backendToken = backendResponse.token;   // JWT token for backend API calls

      // Prepare user data with MongoDB ID
      const userData = {
        id: mongoUserId,                    // ✅ MongoDB ObjectId
        name: backendResponse.user.name || displayName || '',
        email: backendResponse.user.email || email || '',
        photo: backendResponse.user.photo || photoURL || null,
        provider: 'google',
        referralCode: backendResponse.user.referralCode || null,
        emailVerified: backendResponse.user.emailVerified !== false,
        isActive: backendResponse.user.isActive !== false,
        createdAt: backendResponse.user.createdAt || null,
        // Keep Firebase UID for reference (if needed for Firebase operations)
        firebaseUid: uid,
      };

      // ✅ Store backend JWT token and MongoDB user data
      await saveSession(backendToken, userData);
      setAuthenticated(true);
      setUser(userData);

      console.log('✅ Google login successful!');
      console.log('MongoDB User ID:', mongoUserId);
      console.log('Firebase UID (for reference):', uid);

      // Reported by the backend when THIS call created the account. The Login
      // screen has no referral field, so a user invited by a friend who taps
      // "Login with Google" would otherwise be permanently unattributable --
      // callers use this to offer the referral prompt.
      return { isNewUser: backendResponse.isNewUser === true };
    } catch (error: any) {
      console.error('Google login failed:', error);
      
      // Sign out from Firebase on error
      try {
        await auth().signOut();
        await GoogleSignin.signOut();
      } catch (signOutError) {
        console.warn('Error during sign out:', signOutError);
      }

      // Show user-friendly error message
      const errorMessage = error.message || 'Google sign-in failed. Please try again.';
      Alert.alert('Sign-In Error', errorMessage, [{ text: 'OK' }]);
      
      throw error; // Re-throw to allow caller to handle
    }
  };

  /** -------------------
   *  APPLE LOGIN
   *  ------------------- */
  const loginWithApple = async (referralCode?: string) => {
    try {
      const appleAuthResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      if (!appleAuthResponse.identityToken) {
        throw new Error('Apple Sign-In failed: No identity token.');
      }

      // Extract user info from Apple response
      const { user: appleUserId, identityToken, nonce, fullName, email } = appleAuthResponse;
      const displayName = fullName 
        ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() 
        : '';

      // Create a Firebase credential with the token
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);

      // Sign in with Firebase
      const userCredential = await auth().signInWithCredential(appleCredential);
      const firebaseUser = userCredential.user;

      // Get Firebase UID (which will be the Apple user ID after first sign-in)
      const uid = firebaseUser.uid;

      // Determine email - Apple may not provide email on subsequent logins
      // Firebase should have it stored from first sign-in
      const userEmail = email || firebaseUser.email;
      if (!userEmail) {
        throw new Error('Email is required. Please ensure you grant email access during Apple Sign-In.');
      }

      // ✅ CRITICAL: Call backend to create/update user in MongoDB
      const backendResponse = await apiRequest(API_ENDPOINTS.SOCIAL_LOGIN, {
        method: 'POST',
        body: JSON.stringify({
          provider: 'apple',            // Required: 'apple'
          providerId: appleUserId || uid, // Required: Apple user ID or Firebase UID
          name: displayName || '',       // Optional: User's display name
          email: userEmail,              // Required: User's email
          photo: null,                   // Apple doesn't provide photo
          accessToken: identityToken || null, // Optional: Identity token
          // Verified server-side; the backend no longer trusts `email` alone.
          firebaseIdToken: await firebaseUser.getIdToken().catch(() => null),
          referral_code: referralCode?.trim().toLowerCase() || '' // Optional: who invited them
        }),
      });

      if (!backendResponse.success) {
        throw new Error(backendResponse.message || 'Backend authentication failed');
      }

      // ✅ CRITICAL: Use MongoDB _id from backend, NOT Apple user ID or Firebase UID
      const mongoUserId = backendResponse.user.id; // This is the MongoDB ObjectId
      const backendToken = backendResponse.token;   // JWT token for backend API calls

      // Prepare user data with MongoDB ID
      const userData = {
        id: mongoUserId,                    // ✅ MongoDB ObjectId
        name: backendResponse.user.name || displayName || '',
        email: backendResponse.user.email || userEmail,
        photo: backendResponse.user.photo || null,
        provider: 'apple',
        referralCode: backendResponse.user.referralCode || null,
        emailVerified: backendResponse.user.emailVerified !== false,
        isActive: backendResponse.user.isActive !== false,
        createdAt: backendResponse.user.createdAt || null,
        // Keep Apple/Firebase UID for reference (if needed for Firebase operations)
        firebaseUid: uid,
        appleUserId: appleUserId || uid,
      };

      // ✅ Store backend JWT token and MongoDB user data
      await saveSession(backendToken, userData);
      setAuthenticated(true);
      setUser(userData);

      console.log('✅ Apple login successful!');
      console.log('MongoDB User ID:', mongoUserId);
      console.log('Apple User ID (for reference):', appleUserId || uid);

      return { isNewUser: backendResponse.isNewUser === true };
    } catch (error: any) {
      console.error('Apple login failed:', error);
      
      // Sign out from Firebase on error
      try {
        await auth().signOut();
      } catch (signOutError) {
        console.warn('Error during sign out:', signOutError);
      }

      // Show user-friendly error message
      const errorMessage = error.message || 'Apple sign-in failed. Please try again.';
      Alert.alert('Sign-In Error', errorMessage, [{ text: 'OK' }]);
      
      throw error; // Re-throw to allow caller to handle
    }
  };

  /** -------------------
   *  UPDATE USER
   *  ------------------- */
  const updateUser = async (userData: any) => {
    try {
      const token = await getSession();
      if (token) {
        // Update user in state and storage
        const updatedUser = { ...user, ...userData };
        await saveSession(token, updatedUser);
        setUser(updatedUser);
      }
    } catch (error: any) {
      console.error('Update user failed:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ authenticated, loading, user, login, logout, loginWithGoogle, loginWithApple, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};