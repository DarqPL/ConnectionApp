import React, { createContext, useContext, useState, useCallback } from 'react';
import { authService, User, AuthResponse } from '../services/auth.service';
import { chatService } from '../../chat/services/chat.service';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (
    firstName: string,
    lastName: string,
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response: AuthResponse = await authService.signIn(
        username,
        password
      );
      setUser(response.user);
      chatService.setUserId(response.user.id);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Sign in failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(
    async (
      firstName: string,
      lastName: string,
      username: string,
      email: string,
      password: string
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const response: AuthResponse = await authService.signUp(
          firstName,
          lastName,
          username,
          email,
          password
        );
        setUser(response.user);
        chatService.setUserId(response.user.id);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Sign up failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signOut();
      setUser(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Sign out failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
