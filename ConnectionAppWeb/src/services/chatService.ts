import api from "@/lib/axios";
import type {
  Attachment,
  AttachmentType,
  Conversation,
  ConversationRequest,
  Message,
  MessageRequest,
  PageResponse,
  PollRequest,
  Reminder,
  ReminderRequest,
} from "@/types/chat";

interface UploadedObjectResponse {
  objectKey: string;
  imageUrl: string;
  contentType?: string;
  size?: number;
}

export type AiRewriteAction = "TRANSLATE" | "SUGGEST_REPLY" | "REWRITE_STYLE";

export interface AiRewriteRequest {
  conversationId: number;
  draftContent: string;
  action: AiRewriteAction;
  targetLanguage?: "EN" | "VI";
}

export interface AiRewriteResponse {
  conversationId: number;
  action: AiRewriteAction;
  rewrittenText?: string | null;
  suggestions?: string[];
  targetLanguage?: "EN" | "VI" | null;
}

const resolveAttachmentType = (
  mimeType?: string,
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

export const chatService = {
  /**
   * GET /api/conversations?page=0&size=20&sortBy=lastMessageAt&sortDirection=DESC
   * Returns: PageResponse<ConversationResponse>
   */
  async fetchConversations(
    page: number = 0,
    size: number = 20,
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

  async resolveGroupInvite(inviteToken: string): Promise<Conversation> {
    const res = await api.get(`/conversations/invite/${inviteToken}`);
    return res.data;
  },

  async joinGroupByInviteToken(inviteToken: string): Promise<Conversation> {
    const res = await api.post(`/conversations/invite/${inviteToken}/join`);
    return res.data;
  },

  /**
   * GET /api/messages/conversation/{conversationId}?page=0&size=50&sortBy=createdAt&sortDirection=DESC
   * Returns: PageResponse<MessageResponse>
   */
  async fetchMessages(
    conversationId: number,
    page: number = 0,
    size: number = 50,
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
    parentId?: string | null,
    attachments?: Attachment[],
    poll?: PollRequest | null,
  ): Promise<Message> {
    const payload: MessageRequest = {
      conversationId,
      content,
      parentId: parentId ?? null,
      attachments: attachments ?? [],
      poll: poll ?? null,
    };

    const res = await api.post("/messages", payload);
    return res.data;
  },

  async uploadAttachment(file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "messages");

    const res = await api.post("/images", formData);
    const data = res.data as UploadedObjectResponse;

    return {
      fileUrl: data.imageUrl,
      type: resolveAttachmentType(data.contentType || file.type, file.name),
      originalFileName: file.name,
    };
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
   * PUT /api/messages/{messageId}/recall
   * Returns: MessageResponse
   */
  async recallMessage(messageId: string): Promise<Message> {
    const res = await api.put(`/messages/${messageId}/recall`);
    return res.data;
  },

  /**
   * POST /api/conversations
   * Body: ConversationRequest { name, type, participantIds }
   * Returns: ConversationResponse
   */
  async createConversation(
    request: ConversationRequest,
  ): Promise<Conversation> {
    const res = await api.post("/conversations", request);
    return res.data;
  },

  /**
   * GET /api/messages/search?conversationId=X&searchTerm=Y
   * Returns: MessageResponse[]
   */
  async searchMessages(
    conversationId: number,
    searchTerm: string,
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

  /**
   * DELETE /api/conversations/{conversationId}/members/{userId}
   * Leave a group or remove a member
   */
  async leaveGroup(conversationId: number, userId: number): Promise<void> {
    await api.delete(`/conversations/${conversationId}/members/${userId}`);
  },

  /**
   * PUT /api/conversations/{conversationId}
   * Body: { name?, description?, avatarUrl? }
   */
  async updateConversation(
    conversationId: number,
    payload?: { name?: string; description?: string | null; avatarUrl?: string },
    legacyName?: string,
    legacyAvatarUrl?: string
  ): Promise<Conversation> {

    // Fallback cho trường hợp vẫn đang gọi theo cách cũ: updateConversation(id, name, avatarUrl)
    const bodyPayload = payload || {};
    if (legacyName !== undefined) bodyPayload.name = legacyName;
    if (legacyAvatarUrl !== undefined) bodyPayload.avatarUrl = legacyAvatarUrl;

    const res = await api.put(`/conversations/${conversationId}`, bodyPayload);
    return res.data;
  },

  /**
   * PUT /api/conversations/{conversationId}/avatar
   * Body: FormData (multipart/form-data)
   */
  async updateConversationAvatar(
    conversationId: number,
    formData: FormData,
  ): Promise<Conversation> {
    const res = await api.put(`/conversations/${conversationId}/avatar`, formData);
    return res.data;
  },

  async renameConversation(
    conversationId: number,
    name: string,
  ): Promise<Conversation> {
    return this.updateConversation(conversationId, { name });
  },

  /**
   * PUT /api/conversations/{conversationId}/members/{memberId}/role
   * Transfer ownership to another member
   */
  async updateMemberRole(
    conversationId: number,
    memberId: number,
    role: string,
  ): Promise<void> {
    await api.put(`/conversations/${conversationId}/members/${memberId}/role`, {
      role,
    });
  },

  /**
   * POST /api/conversations/{conversationId}/members/{memberId}
   * Add a member to conversation
   */
  async addMemberToGroup(
    conversationId: number,
    memberId: number,
  ): Promise<void> {
    await api.post(`/conversations/${conversationId}/members/${memberId}`);
  },

  async aiRewriteDraft(payload: AiRewriteRequest): Promise<AiRewriteResponse> {
    const res = await api.post("/messages/ai-rewrite", payload);
    return res.data;
  },
  async votePoll(messageId: string, optionIds: string[]): Promise<Message> {
    const res = await api.post(`/messages/${messageId}/vote`, null, {
      params: { optionIds: optionIds.join(",") },
    });
    return res.data;
  },
  async closePoll(messageId: string): Promise<Message> {
    const res = await api.put(`/messages/${messageId}/poll/close`);
    return res.data;
  },
  async reactMessage(
    messageId: string,
    reactionCode: string,
  ): Promise<Message> {
    const res = await api.post(`/messages/${messageId}/reaction`, {
      reactionCode,
    });
    return res.data;
  },
  async removeReaction(messageId: string): Promise<Message> {
    const res = await api.delete(`/messages/${messageId}/reaction`);
    return res.data;
  },
  async pinMessage(
    conversationId: number,
    messageId: string,
  ): Promise<Message> {
    const res = await api.post(`/messages/${messageId}/pin`, null, {
      params: { conversationId },
    });
    return res.data;
  },
  async unpinMessage(conversationId: number, messageId: string): Promise<void> {
    await api.delete(`/messages/${messageId}/unpin`, {
      params: { conversationId },
    });
  },
  async fetchReminders(conversationId: number): Promise<Reminder[]> {
    const res = await api.get(`/reminders/conversation/${conversationId}`);
    return res.data;
  },
  async createReminder(payload: ReminderRequest): Promise<Reminder> {
    const res = await api.post("/reminders", payload);
    return res.data;
  },
  async deleteReminder(reminderId: string | number): Promise<void> {
    await api.delete(`/reminders/${reminderId}`);
  },
  async joinReminder(reminderId: string): Promise<Reminder> {
    const res = await api.post(`/reminders/${reminderId}/join`);
    return res.data;
  },
  async declineReminder(reminderId: string): Promise<Reminder> {
    const res = await api.post(`/reminders/${reminderId}/decline`);
    return res.data;
  },

  // Group settings
  async getGroupSettings(conversationId: number) {
    const res = await api.get(`/conversations/${conversationId}/settings`);
    return res.data;
  },
  async updateGroupSettings(conversationId: number, settings: {
    allowMemberEditInfo?: boolean;
    allowMemberCreateNotes?: boolean;
    allowMemberCreatePolls?: boolean;
    allowMemberSendMessage?: boolean;
    approvalMode?: boolean;
    markAdminMessages?: boolean;
    allowNewMembersReadHistory?: boolean;
    allowLinkJoin?: boolean;
  }) {
    const res = await api.put(`/conversations/${conversationId}/settings`, settings);
    return res.data;
  },
  async refreshInviteToken(conversationId: number) {
    const res = await api.post(`/conversations/${conversationId}/invite-token/refresh`);
    return res.data;
  },
  async disbandGroup(conversationId: number) {
    await api.post(`/conversations/${conversationId}/disband`);
  },
  async getBlockedMembers(conversationId: number) {
    const res = await api.get(`/conversations/${conversationId}/blocked-members`);
    return res.data;
  },
  async blockMember(conversationId: number, memberId: number) {
    await api.post(`/conversations/${conversationId}/blocked-members`, { memberId });
  },
  async unblockMember(conversationId: number, memberId: number) {
    await api.delete(`/conversations/${conversationId}/blocked-members/${memberId}`);
  },
  async getPendingMembers(conversationId: number) {
    const res = await api.get(`/conversations/${conversationId}/pending-members`);
    return res.data;
  },
  async approvePendingMember(conversationId: number, memberId: number) {
    await api.post(`/conversations/${conversationId}/pending-members/${memberId}/approve`);
  },
  async rejectPendingMember(conversationId: number, memberId: number) {
    await api.post(`/conversations/${conversationId}/pending-members/${memberId}/reject`);
  },
  async addCoOwners(conversationId: number, memberIds: number[]) {
    await api.post(`/conversations/${conversationId}/co-owners`, memberIds);
  },
  async removeCoOwner(conversationId: number, memberId: number) {
    await api.delete(`/conversations/${conversationId}/co-owners/${memberId}`);
  },
};