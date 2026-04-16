import { authService } from "../../auth/services/auth.service";

export interface BlockStatus {
  blocked: boolean;
  blockedByMe: boolean;
  blockedByOther: boolean;
}

export class FriendService {
  async sendFriendRequest(receiverId: number): Promise<void> {
    const response = await authService.authFetch(
      `/friends/request/${receiverId}`,
      {
        method: "POST",
      },
    );
    if (!response.ok) throw new Error("Gửi lời mời kết bạn thất bại");
  }

  async acceptFriendRequest(requesterId: number): Promise<void> {
    const response = await authService.authFetch(
      `/friends/accept/${requesterId}`,
      {
        method: "POST",
      },
    );
    if (!response.ok) throw new Error("Chấp nhận kết bạn thất bại");
  }

  async rejectFriendRequest(requesterId: number): Promise<void> {
    const response = await authService.authFetch(
      `/friends/reject/${requesterId}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) throw new Error("Từ chối kết bạn thất bại");
  }

  async checkFriendship(otherUserId: number): Promise<boolean> {
    const response = await authService.authFetch(
      `/friends/check/${otherUserId}`,
      {
        method: "GET",
      },
    );
    return response.ok ? await response.json() : false;
  }

  async checkIsSending(otherUserId: number): Promise<boolean> {
    const response = await authService.authFetch(
      `/friends/check/isSending/${otherUserId}`,
      {
        method: "GET",
      },
    );
    return response.ok ? await response.json() : false;
  }

  async checkIsReceived(otherUserId: number): Promise<boolean> {
    const response = await authService.authFetch(
      `/friends/check/isReceived/${otherUserId}`,
      {
        method: "GET",
      },
    );
    return response.ok ? await response.json() : false;
  }

  async cancelFriendRequest(otherUserId: number): Promise<void> {
    const response = await authService.authFetch(
      `/friends/cancel/${otherUserId}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) throw new Error("Hủy lời mời thất bại");
  }

  async unfriend(otherUserId: number): Promise<void> {
    const response = await authService.authFetch(
      `/friends/unfriend/${otherUserId}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) throw new Error("Hủy kết bạn thất bại");
  }

  async getFriends(): Promise<any[]> {
    const response = await authService.authFetch("/friends", {
      method: "GET",
    });
    if (!response.ok) throw new Error("Không tải được danh sách bạn bè");
    return await response.json();
  }

  async blockUser(blockedUserId: number): Promise<void> {
    const response = await authService.authFetch(
      `/friends/block/${blockedUserId}`,
      {
        method: "POST",
      },
    );
    if (!response.ok) throw new Error("Chặn người dùng thất bại");
  }

  async unblockUser(blockedUserId: number): Promise<void> {
    const response = await authService.authFetch(
      `/friends/block/${blockedUserId}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) throw new Error("Bỏ chặn người dùng thất bại");
  }

  async getBlockStatus(otherUserId: number): Promise<BlockStatus> {
    const response = await authService.authFetch(
      `/friends/block/status/${otherUserId}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error("Không tải được trạng thái chặn");
    }

    return await response.json();
  }
}

export const friendService = new FriendService();
