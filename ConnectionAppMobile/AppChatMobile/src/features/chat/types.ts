export interface Participant {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: string;
  joinedAt: string;
  unreadCounts: number;
}

export interface Conversation {
  id: number;
  name: string;
  avatarUrl?: string | null;
  type: string;
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

export interface SenderInfo {
  senderId: number;
  displayName: string;
  avatarUrl?: string | null;
}

export type AttachmentType = "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO" | "FILE";

export interface Attachment {
  fileUrl: string;
  type: AttachmentType;
  originalFileName?: string | null;
}

export interface ReplyInfo {
  parentId: string;
  parentContent: string | null;
  parentSenderName: string;
}

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
  replyInfo?: ReplyInfo | null;
}

export interface PageResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Friend {
  id: number;
  friendId: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status: string;
  isRequester: boolean;
}
