import api from "@/lib/axios";
import type { Conversation, Message, PageResponse, ConversationRequest } from "@/types/chat";

export const chatService = {
  /**
   * GET /api/conversations?page=0&size=20&sortBy=lastMessageAt&sortDirection=DESC
   * Returns: PageResponse<ConversationResponse>
   */
  async fetchConversations(
    page: number = 0,
    size: number = 20
  ): Promise<PageResponse<Conversation>> {
    const res = await api.get("/conversations", {
      params: { page, size, sortBy: "lastMessageAt", sortDirection: "DESC" },
    });
    return res.data;
  },

  /**
   * GET /api/conversations/{conversationId}
   * Returns: ConversationResponse
   */
  async fetchConversationById(conversationId: number): Promise<Conversation> {
    const res = await api.get(`/conversations/${conversationId}`);
    return res.data;
  },

  /**
   * GET /api/messages/conversation/{conversationId}?page=0&size=50&sortBy=createdAt&sortDirection=DESC
   * Returns: PageResponse<MessageResponse>
   */
  async fetchMessages(
    conversationId: number,
    page: number = 0,
    size: number = 50
  ): Promise<PageResponse<Message>> {
    const res = await api.get(`/messages/conversation/${conversationId}`, {
      params: { page, size, sortBy: "createdAt", sortDirection: "DESC" },
    });
    return res.data;
  },

  /**
   * POST /api/messages
   * Body: MessageRequest { conversationId, content, parentId? }
   * Returns: MessageResponse
   */
  async sendMessage(
    conversationId: number,
    content: string,
    parentId?: number | null
  ): Promise<Message> {
    const res = await api.post("/messages", {
      conversationId,
      content,
      parentId: parentId ?? null,
    });
    return res.data;
  },

  /**
   * PUT /api/messages/{messageId}
   * Body: MessageRequest { content }
   * Returns: MessageResponse
   */
  async editMessage(messageId: string, content: string): Promise<Message> {
    const res = await api.put(`/messages/${messageId}`, { content });
    return res.data;
  },

  /**
   * DELETE /api/messages/{messageId}
   */
  async deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/messages/${messageId}`);
  },

  /**
   * POST /api/conversations
   * Body: ConversationRequest { name, type, participantIds }
   * Returns: ConversationResponse
   */
  async createConversation(request: ConversationRequest): Promise<Conversation> {
    const res = await api.post("/conversations", request);
    return res.data;
  },

  /**
   * GET /api/messages/search?conversationId=X&searchTerm=Y
   * Returns: MessageResponse[]
   */
  async searchMessages(
    conversationId: number,
    searchTerm: string
  ): Promise<Message[]> {
    const res = await api.get("/messages/search", {
      params: { conversationId, searchTerm },
    });
    return res.data;
  },

  /**
   * PUT /api/conversations/{conversationId}/read
   */
  async markAsRead(conversationId: number): Promise<void> {
    await api.put(`/conversations/${conversationId}/read`);
  },
};
