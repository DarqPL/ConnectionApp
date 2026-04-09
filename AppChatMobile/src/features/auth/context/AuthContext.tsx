import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { authService, User } from "../services/auth.service";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  apiBaseUrl: string;
  isHydrating: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (
    firstName: string,
    lastName: string,
    username: string,
    email: string,
    password: string,
    otp: string,
  ) => Promise<void>;
  sendSignupOtp: (username: string, email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string,
  ) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  setApiBaseUrl: (url: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(
    authService.getApiBaseUrl(),
  );
  const [isHydrating, setIsHydrating] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      setIsHydrating(true);
      try {
        const token = await authService.initializeSession();
        setAccessToken(token);
        setApiBaseUrlState(authService.getApiBaseUrl());

        if (token) {
          const profile = await authService.fetchMe();
          setUser(profile);
        }
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsHydrating(false);
      }
    };

    bootstrap();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signIn(username, password);
      const profile = await authService.fetchMe();
      setUser(profile);
      setAccessToken(authService.getAccessToken());
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Đăng nhập thất bại";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendSignupOtp = useCallback(async (username: string, email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.sendSignupOtp(username, email);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Gửi OTP thất bại";
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
      password: string,
      otp: string,
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.signUp(
          firstName,
          lastName,
          username,
          email,
          password,
          otp,
        );
        await authService.signIn(username, password);
        const profile = await authService.fetchMe();
        setUser(profile);
        setAccessToken(authService.getAccessToken());
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Đăng ký thất bại";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const forgotPassword = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(email);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Gửi yêu cầu thất bại";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(
    async (email: string, otp: string, newPassword: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.resetPassword(email, otp, newPassword);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Đặt lại mật khẩu thất bại";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.changePassword(oldPassword, newPassword);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Đổi mật khẩu thất bại";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const updateUserProfile = useCallback(async (data: Partial<User>) => {
    const { userService } = await import("../../chat/services/user.service");
    const updatedUser = await userService.updateProfile(data);
    setUser(updatedUser);
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signOut();
      setUser(null);
      setAccessToken(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Đăng xuất thất bại";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setApiBaseUrl = useCallback(async (url: string) => {
    await authService.setApiBaseUrl(url);
    setApiBaseUrlState(authService.getApiBaseUrl());
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    accessToken,
    apiBaseUrl,
    isHydrating,
    isLoading,
    isAuthenticated: user !== null && !!accessToken,
    error,
    signIn,
    signUp,
    sendSignupOtp,
    forgotPassword,
    resetPassword,
    changePassword,
    setApiBaseUrl,
    signOut,
    updateUserProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
