import api from "@/lib/axios";

export const authService = {
  /**
   * POST /api/auth/signup
   * Body: { username, password, email, firstName, lastName }
   * Backend kiểm tra trạng thái "email đã xác minh" thay vì OTP.
   * Returns: UserResponse { id, username, role, status }
   */
  signUp: async (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string,
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
   * POST /api/auth/signup/send-otp
   * Body: { email, username? }
   * Gửi OTP để xác nhận đăng ký (username là optional trong luồng mới)
   */
  sendSignupOtp: async (email: string, username?: string) => {
    const body: Record<string, string> = { email };
    if (username && username.trim()) body.username = username;
    const res = await api.post("/auth/signup/send-otp", body);
    return res.data;
  },

  /**
   * POST /api/auth/signin
   * Body: { username, password }
   * Returns: LoginResponse { accessToken }
   * (Assumes refreshToken is handled via HttpOnly Cookie by the backend)
   */
  signIn: async (username: string, password: string) => {
    const res = await api.post("/auth/signin", {
      username,
      password,
      platform: "WEB",
    });
    return res.data;
  },

  /**
   * POST /api/auth/logout
   * Revokes current refresh token cookie on server.
   */
  signOut: async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("accessToken");
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
   * Uses HttpOnly refresh token cookie
   * Returns: { accessToken }
   */
  refresh: async () => {
    const res = await api.post("/auth/refresh");
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
    const res = await api.post("/auth/reset-password", {
      email,
      otp,
      newPassword,
    });
    return res.data;
  },
};
