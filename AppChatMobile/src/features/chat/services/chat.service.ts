import { authService } from "../../auth/services/auth.service";
import type { Conversation, Message, PageResponse } from "../types";

export class ChatService {
  private async parseError(
    response: Response,
    fallback: string,
  ): Promise<Error> {
    try {
      const data = await response.json();
      const message = data?.message || data?.error || fallback;
      return new Error(message);
    } catch {
      return new Error(fallback);
    }
  }

  async getConversations(page = 0, size = 20): Promise<Conversation[]> {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
      sortBy: "lastMessageAt",
      sortDirection: "DESC",
    });

    const response = await authService.authFetch(
      `/conversations?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw await this.parseError(
        response,
        "Không tải được danh sách cuộc trò chuyện",
      );
    }

    const data = (await response.json()) as PageResponse<Conversation>;
    return data.content ?? [];
  }

  async getMessages(
    conversationId: number,
    page = 0,
    size = 50,
  ): Promise<Message[]> {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
      sortBy: "createdAt",
      sortDirection: "DESC",
    });

    const response = await authService.authFetch(
      `/messages/conversation/${conversationId}?${query.toString()}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Không tải được tin nhắn");
    }

    const data = (await response.json()) as PageResponse<Message>;
    return (data.content ?? []).slice().reverse();
  }

  async sendMessage(conversationId: number, content: string): Promise<Message> {
    const response = await authService.authFetch("/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        content,
        parentId: null,
      }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Gửi tin nhắn thất bại");
    }

    return (await response.json()) as Message;
  }

  async deleteMessage(messageId: string): Promise<void> {
    const response = await authService.authFetch(
      `/messages/${messageId}/recall`,
      {
        method: "PUT",
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Thu hồi tin nhắn thất bại");
    }
  }

  async markAsRead(conversationId: number): Promise<void> {
    const response = await authService.authFetch(
      `/conversations/${conversationId}/read`,
      {
        method: "PUT",
      },
    );

    if (!response.ok) {
      throw await this.parseError(
        response,
        "Không thể cập nhật trạng thái đã đọc",
      );
    }
  }
}

export const chatService = new ChatService();
