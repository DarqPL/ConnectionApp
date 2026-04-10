import { userService } from "@/services/userService";
import type { UserState } from "@/types/store";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { toast } from "sonner";
import { useChatStore } from "./useChatStore";
import type { User } from "@/types/user";

export const useUserStore = create<UserState>(() => ({
  updateProfile: async (profileData: Partial<User>) => {
    try {
      const updatedUser = await userService.updateProfile(profileData);

      const { setUser } = useAuthStore.getState();
      setUser(updatedUser);

      // Refresh conversations to update display names / avatars
      useChatStore.getState().fetchConversations();

      toast.success("Cập nhật thông tin thành công!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Cập nhật thông tin không thành công!");
    }
  },
}));
