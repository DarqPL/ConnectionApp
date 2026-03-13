import api from "@/lib/axios";
import type { User } from "@/types/user";

export const userService = {
  /**
   * GET /api/users/profile
   * Returns: UserProfileResponse
   */
  async getProfile(): Promise<User> {
    const res = await api.get("/users/profile");
    return res.data;
  },

  /**
   * GET /api/users/{userId}
   * Returns: UserProfileResponse
   */
  async getUserById(userId: number): Promise<User> {
    const res = await api.get(`/users/${userId}`);
    return res.data;
  },

  /**
   * GET /api/users/search
   * Returns: UserProfileResponse[]
   */
  async searchUsers(query: string): Promise<User[]> {
    const res = await api.get("/users/search", { params: { query } });
    return res.data;
  },

  /**
   * PUT /api/users/profile
   * Body: UserProfileResponse (partial update)
   * Returns: UserProfileResponse
   */
  async updateProfile(profileData: Partial<User>): Promise<User> {
    const res = await api.put("/users/profile", profileData);
    return res.data;
  },

  /**
   * PUT /api/users/status?status=ONLINE
   */
  async updateStatus(status: string): Promise<void> {
    await api.put("/users/status", null, {
      params: { status },
    });
  },

  /**
   * POST /api/users/change-password?oldPassword=X&newPassword=Y
   * Returns: string message
   */
  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<string> {
    const res = await api.post("/users/change-password", null, {
      params: { oldPassword, newPassword },
    });
    return res.data;
  },
};
