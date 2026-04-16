import { friendService } from "@/services/friendService";
import type { FriendState } from "@/types/store";
import { create } from "zustand";

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  loading: false,
  pendingRequests: [],

  sendFriendRequest: async (receiverId) => {
    try {
      set({ loading: true });
      await friendService.sendFriendRequest(receiverId);
    } catch (error) {
      console.error("Error sending friend request:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  acceptFriendRequest: async (requesterId) => {
    try {
      set({ loading: true });
      await friendService.acceptFriendRequest(requesterId);

      // Remove from pending list
      set((state) => ({
        pendingRequests: state.pendingRequests.filter(
          (r) => r.friendId !== requesterId
        ),
      }));

      // Refresh friends list
      const friends = await friendService.getFriends();
      set({ friends });
    } catch (error) {
      console.error("Error accepting friend request:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  rejectFriendRequest: async (requesterId) => {
    try {
      set({ loading: true });
      await friendService.rejectFriendRequest(requesterId);

      set((state) => ({
        pendingRequests: state.pendingRequests.filter(
          (r) => r.friendId !== requesterId
        ),
      }));
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  getFriends: async () => {
    try {
      set({ loading: true });
      const friends = await friendService.getFriends();
      set({ friends });
    } catch (error) {
      console.error("Error loading friends:", error);
      set({ friends: [] });
    } finally {
      set({ loading: false });
    }
  },

  getPendingRequests: async () => {
    try {
      set({ loading: true });
      const pendingRequests = await friendService.getPendingRequests();
      set({ pendingRequests });
    } catch (error) {
      console.error("Error loading pending requests:", error);
      set({ pendingRequests: [] });
    } finally {
      set({ loading: false });
    }
  },

  checkFriendship: async (otherUserId) => {
    try {
      return await friendService.checkFriendship(otherUserId);
    } catch (error) {
      console.error("Error checking friendship:", error);
      return false;
    }
  },

  addPendingRequest: (newRequest) => {
    set((state) => {
      // Check if request already exists to avoid duplicates
      const exists = state.pendingRequests.some(
        (r) => r.friendId === newRequest.friendId
      );
      if (exists) return state;
      
      return {
        pendingRequests: [newRequest, ...state.pendingRequests],
      };
    });
  },

  removePendingRequest: (friendId) => {
    set((state) => ({
      pendingRequests: state.pendingRequests.filter(
        (r) => r.friendId !== friendId
      ),
    }));
  },
}));
