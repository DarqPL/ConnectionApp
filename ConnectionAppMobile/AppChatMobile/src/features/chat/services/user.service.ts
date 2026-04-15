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

  async updateAvatar(formData: FormData): Promise<User> {
    try {
      console.log("[UserService] Uploading avatar with FormData");
      console.log("[UserService] FormData type:", typeof formData);
      console.log("[UserService] Is FormData instance:", formData instanceof FormData);
      
      const response = await authService.authFetch("/users/profile/avatar", {
        method: "PUT",
        body: formData,
      });

      console.log("[UserService] Upload response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log("[UserService] Error response body:", errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || "Lỗi không xác định" };
        }
        
        throw new Error(errorData.message || "Không thể cập nhật ảnh đại diện");
      }

      const result = await response.json();
      console.log("[UserService] Upload successful, result:", result);
      return result;
    } catch (err) {
      console.error("[UserService] Avatar upload error:", err);
      throw err;
    }
  }
}

export const userService = new UserService();
