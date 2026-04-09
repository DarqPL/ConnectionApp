import { authService } from "../../auth/services/auth.service";
import { User } from "../../auth/services/auth.service";

export class UserService {
  async searchUsers(query: string): Promise<User[]> {
    const response = await authService.authFetch(`/users/search?query=${query}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Không thể tìm kiếm người dùng");
    }

    return await response.json();
  }

  async updateProfile(profileData: Partial<User>): Promise<User> {
    const response = await authService.authFetch("/users/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error("Không thể cập nhật thông tin");
    }

    return await response.json();
  }
}

export const userService = new UserService();
