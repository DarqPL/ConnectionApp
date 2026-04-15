import { userService } from "@/services/userService";
import type { UserState } from "@/types/store";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { toast } from "sonner";
import { useChatStore } from "./useChatStore";
import type { User } from "@/types/user";

export interface UserStoreType extends UserState {
  user: User | null;
}

export const useUserStore = create<UserStoreType>((set) => ({
  user: null,

  updateProfile: async (profileData: Partial<User>) => {
    try {
      const updatedUser = await userService.updateProfile(profileData);

      const { setUser } = useAuthStore.getState();
      setUser(updatedUser);

      // Update local user state in useUserStore
      set({ user: updatedUser });

      // Refresh conversations to update display names / avatars
      useChatStore.getState().fetchConversations();

      toast.success("Cập nhật thông tin thành công!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Cập nhật thông tin không thành công!");
      throw error;
    }
  },

  updateAvatarUrl: async (formData: FormData) => {
    try {
      const updatedUser = await userService.updateAvatar(formData);

      const { setUser } = useAuthStore.getState();
      setUser(updatedUser);

      // Update local user state in useUserStore
      set({ user: updatedUser });

      // Force refetch user data to ensure UI is synced
      // Add cache busting by using fetchMe which will re-fetch fresh data
      await useAuthStore.getState().fetchMe();

      // Refresh conversations to update avatars
      useChatStore.getState().fetchConversations();

      toast.success("Cập nhật ảnh đại diện thành công!");
      return updatedUser;
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật ảnh đại diện!");
      throw error;
    }
  },
}));