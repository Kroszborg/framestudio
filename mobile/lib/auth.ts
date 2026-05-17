/**
 * Auth client for FrameStudio
 *
 * Optional authentication - the app works fully in guest mode.
 * Auth enables cloud project sync and cross-device access.
 */

import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

let authState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
};

let listeners: ((state: AuthState) => void)[] = [];

function notifyListeners() {
  listeners.forEach((fn) => fn(authState));
}

export function subscribeAuth(listener: (state: AuthState) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}

export function getAuthState(): AuthState {
  return authState;
}

export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    authState = { ...authState, isLoading: true };
    notifyListeners();

    const res = await fetch(`${API_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Sign in failed');
    }

    const data = await res.json();
    authState = {
      user: data.user,
      isAuthenticated: true,
      isLoading: false,
    };
    notifyListeners();
    return { success: true };
  } catch (e: any) {
    authState = { ...authState, isLoading: false };
    notifyListeners();
    return { success: false, error: e.message };
  }
}

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    authState = { ...authState, isLoading: true };
    notifyListeners();

    const res = await fetch(`${API_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Sign up failed');
    }

    const data = await res.json();
    authState = {
      user: data.user,
      isAuthenticated: true,
      isLoading: false,
    };
    notifyListeners();
    return { success: true };
  } catch (e: any) {
    authState = { ...authState, isLoading: false };
    notifyListeners();
    return { success: false, error: e.message };
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/sign-out`, { method: 'POST' });
  } catch {
    // Ignore network errors during sign out
  }
  authState = { user: null, isAuthenticated: false, isLoading: false };
  notifyListeners();
}

export async function checkSession(): Promise<void> {
  try {
    authState = { ...authState, isLoading: true };
    notifyListeners();

    const res = await fetch(`${API_URL}/api/auth/session`);
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        authState = {
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
        };
        notifyListeners();
        return;
      }
    }
  } catch {
    // Not authenticated
  }
  authState = { user: null, isAuthenticated: false, isLoading: false };
  notifyListeners();
}
