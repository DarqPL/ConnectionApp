import api from "@/lib/axios";
import type { Friend } from "@/types/user";

export interface BlockStatus {
  blocked: boolean;
  blockedByMe: boolean;
  blockedByOther: boolean;
}

export const friendService = {
  /**
   * POST /api/friends/request/{receiverId}
   * Returns: FriendResponse
   */
  async sendFriendRequest(receiverId: number): Promise<Friend> {
    const res = await api.post(`/friends/request/${receiverId}`);
    return res.data;
  },

  /**
   * POST /api/friends/accept/{requesterId}
   * Returns: FriendResponse
   */
  async acceptFriendRequest(requesterId: number): Promise<Friend> {
    const res = await api.post(`/friends/accept/${requesterId}`);
    return res.data;
  },

  /**
   * DELETE /api/friends/reject/{requesterId}
   */
  async rejectFriendRequest(requesterId: number): Promise<void> {
    await api.delete(`/friends/reject/${requesterId}`);
  },

  /**
   * GET /api/friends
   * Returns: FriendResponse[]
   */
  async getFriends(): Promise<Friend[]> {
    const res = await api.get("/friends");
    return res.data;
  },

  /**
   * GET /api/friends/pending
   * Returns: FriendResponse[]
   */
  async getPendingRequests(): Promise<Friend[]> {
    const res = await api.get("/friends/pending");
    return res.data;
  },

  /**
   * GET /api/friends/check/{otherUserId}
   * Returns: boolean
   */
  async checkFriendship(otherUserId: number): Promise<boolean> {
    const res = await api.get(`/friends/check/${otherUserId}`);
    return res.data;
  },

  /**
   * GET /api/friends/check/isSending/{otherUserId}
   * Returns: boolean
   */
  async checkIsSending(otherUserId: number): Promise<boolean> {
    const res = await api.get(`/friends/check/isSending/${otherUserId}`);
    return res.data;
  },

  /**
   * GET /api/friends/check/isReceived/{otherUserId}
   * Returns: boolean
   */
  async checkIsReceived(otherUserId: number): Promise<boolean> {
    const res = await api.get(`/friends/check/isReceived/${otherUserId}`);
    return res.data;
  },

  /**
   * DELETE /api/friends/cancel/{otherUserId}
   * Hủy lời mời đã gửi
   */
  async cancelFriendRequest(otherUserId: number): Promise<void> {
    await api.delete(`/friends/cancel/${otherUserId}`);
  },

  /**
   * DELETE /api/friends/unfriend/{otherUserId}
   * Hủy kết bạn
   */
  async unfriend(otherUserId: number): Promise<void> {
    await api.delete(`/friends/unfriend/${otherUserId}`);
  },

  /**
   * POST /api/friends/block/{blockedUserId}
   */
  async blockUser(blockedUserId: number): Promise<void> {
    await api.post(`/friends/block/${blockedUserId}`);
  },

  /**
   * DELETE /api/friends/block/{blockedUserId}
   */
  async unblockUser(blockedUserId: number): Promise<void> {
    await api.delete(`/friends/block/${blockedUserId}`);
  },

  /**
   * GET /api/friends/block/status/{otherUserId}
   */
  async getBlockStatus(otherUserId: number): Promise<BlockStatus> {
    const res = await api.get(`/friends/block/status/${otherUserId}`);
    return res.data;
  },
};
