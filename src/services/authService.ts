import api from "@/lib/axios";

export const authService = {
  /**
   * POST /api/auth/signup
   * Body: { username, password, email, firstName, lastName }
   * Returns: UserResponse { id, username, role, status }
   */
  signUp: async (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string
  ) => {
    const res = await api.post("/auth/signup", {
      username,
      password,
      email,
      firstName,
      lastName,
    });
    return res.data;
  },

  /**
   * POST /api/auth/signin
   * Body: { username, password }
   * Returns: LoginResponse { accessToken, refreshToken }
   */
  signIn: async (username: string, password: string) => {
    const res = await api.post("/auth/signin", {
      username,
      password,
    });
    return res.data; // { accessToken, refreshToken }
  },

  /**
   * Sign out: just clear tokens locally.
   * Backend doesn't have a signout endpoint (stateless JWT).
   */
  signOut: async () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },

  /**
   * GET /api/users/profile
   * Returns: UserProfileResponse
   */
  fetchMe: async () => {
    const res = await api.get("/users/profile");
    return res.data; // UserProfileResponse directly
  },

  /**
   * POST /api/auth/refresh
   * Body: { refreshToken }
   * Returns: { accessToken }
   */
  refresh: async (refreshToken: string) => {
    const res = await api.post("/auth/refresh", {
      refreshToken,
    });
    return res.data.accessToken;
  },

  /**
   * POST /api/auth/forgot-password
   * Body: { email }
   * Gửi OTP về email để đặt lại mật khẩu
   */
  forgotPassword: async (email: string) => {
    const res = await api.post("/auth/forgot-password", { email });
    return res.data;
  },

  /**
   * POST /api/auth/verify-otp
   * Body: { email, otp }
   * Xác minh mã OTP
   */
  verifyOtp: async (email: string, otp: string) => {
    const res = await api.post("/auth/verify-otp", { email, otp });
    return res.data;
  },

  /**
   * POST /api/auth/reset-password
   * Body: { email, otp, newPassword }
   * Đặt lại mật khẩu mới
   */
  resetPassword: async (email: string, otp: string, newPassword: string) => {
    const res = await api.post("/auth/reset-password", { email, otp, newPassword });
    return res.data;
  },
};