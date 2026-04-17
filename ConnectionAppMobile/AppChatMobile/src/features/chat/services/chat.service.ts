import { authService } from "../../auth/services/auth.service";
import type {
  Attachment,
  AttachmentType,
  Conversation,
  Message,
  PageResponse,
} from "../types";

interface UploadResponse {
  objectKey: string;
  imageUrl: string;
  contentType?: string;
  size?: number;
}

export class ChatApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "ChatApiError";
    this.code = code;
    this.status = status;
  }
}

const resolveAttachmentType = (
  mimeType?: string | null,
  fileName?: string,
): AttachmentType => {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();

  if (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)
  ) {
    return "IMAGE";
  }
  if (mime.startsWith("video/")) {
    return "VIDEO";
  }
  if (mime.startsWith("audio/")) {
    return "AUDIO";
  }
  if (
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("powerpoint") ||
    mime.startsWith("text/") ||
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf)$/.test(name)
  ) {
    return "DOCUMENT";
  }

  return "FILE";
};

export class ChatService {
  private async parseError(
    response: Response,
    fallback: string,
  ): Promise<Error> {
    try {
      const data = await response.json();
      const message = data?.message || data?.error || fallback;
      return new ChatApiError(message, data?.code, response.status);
    } catch {
      return new ChatApiError(fallback, undefined, response.status);
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

  async sendMessage(
    conversationId: number,
    content: string,
    parentId?: string | null,
    attachments: Attachment[] = [],
  ): Promise<Message> {
    const response = await authService.authFetch("/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        content,
        parentId: parentId ?? null,
        attachments,
      }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Gửi tin nhắn thất bại");
    }

    return (await response.json()) as Message;
  }

  async uploadAttachment(file: {
    uri: string;
    name: string;
    mimeType?: string | null;
  }): Promise<Attachment> {
    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    } as any);
    formData.append("folder", "messages");

    const response = await authService.authFetch("/images", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw await this.parseError(response, "Tải tệp lên thất bại");
    }

    const data = (await response.json()) as UploadResponse;
    return {
      fileUrl: data.imageUrl,
      type: resolveAttachmentType(data.contentType || file.mimeType, file.name),
      originalFileName: file.name,
    };
  }

  async recallMessage(messageId: string): Promise<Message> {
    const response = await authService.authFetch(
      `/messages/${messageId}/recall`,
      {
        method: "PUT",
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Thu hồi tin nhắn thất bại");
    }

    return (await response.json()) as Message;
  }

  async deleteMessage(messageId: string): Promise<void> {
    const response = await authService.authFetch(
      `/messages/${messageId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Xóa tin nhắn thất bại");
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

  async createConversation(
    type: "PRIVATE" | "GROUP",
    name: string,
    participantIds: number[],
  ): Promise<Conversation> {
    const response = await authService.authFetch("/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, name, participantIds }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Không thể tạo hội thoại");
    }

    return (await response.json()) as Conversation;
  }
}

export const chatService = new ChatService();
