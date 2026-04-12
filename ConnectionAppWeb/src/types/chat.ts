/**
 * ConversationUserResponse from backend
 */
export interface Participant {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: string; // OWNER, CO_OWNER, MEMBER
  joinedAt: string;
  unreadCounts: number;
}

/**
 * ConversationResponse from backend
 */
export interface Conversation {
  id: number;
  name: string;
  avatarUrl?: string | null;
  type: string; // PRIVATE, GROUP
  lastMessageAt: string | null;
  lastMessageContent: string | null;
  activate: boolean;
  createdById: number | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string | null;
  participants: Participant[];
  unreadCount: number;
}

/**
 * PageResponse<T> from backend
 */
export interface PageResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * MessageResponse from backend
 */
export interface Message {
  id: string;
  conversationId: number;
  senderInfo: SenderInfo;
  content: string | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string | null;
  parentId: string | null;
  isDeleted: boolean;
  recalledAt: string | null;
  replyInfo: ReplyInfo | null;
  isOwn?: boolean; // computed on frontend
}

export interface SenderInfo {
  senderId: number;
  displayName: string;
  avatarUrl?: string | null;
}

export type AttachmentType = "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO" | "FILE";

export interface Attachment {
  fileUrl: string;
  type: AttachmentType;
}

export interface ReplyInfo {
  parentId: string;
  parentContent: string | null;
  parentSenderName: string;
}

/**
 * MessageRequest to backend
 */
export interface MessageRequest {
  conversationId: number;
  content: string;
  parentId?: string | null;
  attachments?: Attachment[];
}

/**
 * ConversationRequest to backend
 */
export interface ConversationRequest {
  name: string;
  type: string; // PRIVATE, GROUP
  participantIds: number[];
}
