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
  ) => Promise<void>;
  sendSignupOtp: (email: string, username?: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string,
  ) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  requestDeleteOtp: () => Promise<void>;
  confirmDeleteAccount: (otp: string) => Promise<void>;
  deleteAccount: (otp: string) => Promise<void>;
  lockAccount: () => Promise<void>;
  requestManualUnlockOtp: (usernameOrEmail: string, email: string) => Promise<void>;
  verifyManualUnlockOtp: (usernameOrEmail: string, email: string, otp: string) => Promise<void>;
  setApiBaseUrl: (url: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  updateAvatar: (formData: FormData) => Promise<void>;
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

  useEffect(() => {
    authService.setUnauthorizedHandler(() => {
      setUser(null);
      setAccessToken(null);
    });

    return () => {
      authService.setUnauthorizedHandler(null);
    };
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

  const sendSignupOtp = useCallback(
    async (email: string, username?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.sendSignupOtp(username || "", email);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Gửi OTP thất bại";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    async (
      firstName: string,
      lastName: string,
      username: string,
      email: string,
      password: string,
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
        );
        // After signup, clear any error. User navigates to SignIn manually.
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

  const requestDeleteOtp = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.requestDeleteOtp();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Gửi OTP thất bại";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.verifyOtp(email, otp);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Xác minh OTP thất bại";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmDeleteAccount = useCallback(async (otp: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.confirmDeleteAccount(otp);
      setUser(null);
      setAccessToken(null);
      // signOut will clear the token and notify handlers
      await authService.signOut();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Xóa tài khoản thất bại";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteAccount = useCallback(
    async (otp: string) => {
      await confirmDeleteAccount(otp);
    },
    [confirmDeleteAccount],
  );

  const lockAccount = useCallback(async () => {
    if (!user?.id) {
      throw new Error("Không tìm thấy tài khoản người dùng");
    }
    setIsLoading(true);
    setError(null);
    try {
      await authService.lockAccount(user.id);
      await authService.signOut();
      setUser(null);
      setAccessToken(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Khoá tài khoản thất bại";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const requestManualUnlockOtp = useCallback(
    async (usernameOrEmail: string, email: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.requestManualUnlockOtp(usernameOrEmail, email);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Gửi OTP thất bại";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const verifyManualUnlockOtp = useCallback(
    async (usernameOrEmail: string, email: string, otp: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.verifyManualUnlockOtp(usernameOrEmail, email, otp);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Xác minh OTP thất bại";
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

  const updateAvatar = useCallback(async (formData: FormData) => {
    const { userService } = await import("../../chat/services/user.service");
    try {
      const updatedUser = await userService.updateAvatar(formData);
      setUser(updatedUser);

      // Force refetch to ensure avatar update is synced
      await authService.fetchMe().then((freshUser) => {
        setUser(freshUser);
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Cập nhật ảnh đại diện thất bại";
      setError(errorMessage);
      throw err;
    }
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
    verifyOtp,
    requestDeleteOtp,
    confirmDeleteAccount,
    deleteAccount,
    lockAccount,
    requestManualUnlockOtp,
    verifyManualUnlockOtp,
    setApiBaseUrl,
    signOut,
    updateUserProfile,
    updateAvatar,
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
