import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { getProfile } from '../api/user';

export interface Role {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface Classification {
  id: string;
  name: string;
  type?: string;
  level?: number;
}

export interface Location {
  id: string;
  name: string;
  code?: string;
  type?: string;
  level?: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar?: string;
  department_id?: string;
  location_id?: string;
  is_active: boolean;
  is_super_admin: boolean;
  permissions?: string[];
  roles?: Role[];
  classifications?: Classification[];
  locations?: Location[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (roleCode: string) => boolean;
  isLoggingOut: boolean;
  requiresBiometric: boolean;
  setRequiresBiometric: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [requiresBiometric, setRequiresBiometric] = useState(false);

  const loadUser = useCallback(async (isAutoLogin = false) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const response = await getProfile();
      if (response.success && response.data) {
        setUser(response.data);
        if (isAutoLogin) {
          setRequiresBiometric(true);
        }
      } else {
        // Token might be invalid, clear it
        await SecureStore.deleteItemAsync('authToken');
        await SecureStore.deleteItemAsync('refreshToken');
        setUser(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser(true);
  }, [loadUser]);

  const login = useCallback(async (token: string, refreshToken?: string) => {
    await SecureStore.setItemAsync('authToken', token);
    if (refreshToken) {
      await SecureStore.setItemAsync('refreshToken', refreshToken);
    }
    setRequiresBiometric(false);
    await loadUser(false);
  }, [loadUser]);

  const logout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      // Import setLoggingOut here to avoid circular dependency
      router.replace('/login');
      const { setLoggingOut } = await import('../api/client');

      // Set flag FIRST to block any new requests from other components
      setLoggingOut(true);

      // Clear local tokens BEFORE setting user to null
      // This ensures any triggered API calls will be rejected due to no token
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('refreshToken');

      // Navigate to login BEFORE setting user to null
      // This unmounts components before they can react to user change

      // Small delay to allow navigation to start
      await new Promise(resolve => setTimeout(resolve, 300));

      // Now set user to null
      setUser(null);
      setRequiresBiometric(false);

      // Reset flag after navigation completes
      setTimeout(() => {
        setLoggingOut(false);
        setIsLoggingOut(false);
      }, 1000);
    } catch (error) {
      // If import fails, just clear tokens and navigate
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('refreshToken');
      router.replace('/login');
      setUser(null);
      setIsLoggingOut(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    if (!user.permissions) return false;
    return user.permissions.includes(permission) || user.permissions.includes('*');
  }, [user]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    return permissions.some(perm => hasPermission(perm));
  }, [user, hasPermission]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    return permissions.every(perm => hasPermission(perm));
  }, [user, hasPermission]);

  const hasRole = useCallback((roleCode: string): boolean => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    if (!user.roles) return false;
    return user.roles.some(role => role.code === roleCode && role.is_active);
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isLoggingOut,
    requiresBiometric,
    setRequiresBiometric,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
