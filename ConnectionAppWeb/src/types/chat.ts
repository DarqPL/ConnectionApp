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
  description?: string | null;
  avatarUrl?: string | null;
  inviteToken?: string | null;
  type: string;
  lastMessageAt: string | null;
  lastMessageContent: string | null;
  activate: boolean;
  createdById: number | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string | null;
  participants: Participant[];
  pinnedMessages: Message[];
  unreadCount: number;
  allowMemberEditInfo: boolean;
  allowMemberCreateNotes: boolean;
  allowMemberCreatePolls: boolean;
  allowMemberSendMessage: boolean;
  approvalMode: boolean;
  markAdminMessages: boolean;
  allowNewMembersReadHistory: boolean;
  allowLinkJoin: boolean;
  blockedMembers: Participant[];
  pendingMembers: Participant[];
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
  poll: Poll | null;
  reminder?: Reminder | null;
  reactions?: MessageReaction[];
  isOwn?: boolean; // computed on frontend
  status?: "SENDING" | "SENT" | "RECEIVED" | "ERROR";
  tempId?: string;
}

export interface MessageReaction {
  userId: number;
  reactionCode: string;
  reactedAt?: string | null;
}

export interface Poll {
  question: string;
  options: PollOption[];
  multiChoice: boolean;
  allowAddOptions: boolean;
  isAnonymous: boolean;
  closed: boolean;
  expiredAt: string | null;
}

export interface PollOption {
  id: string;
  text: string;
  voterIds: number[];
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
  parentAttachments?: Attachment[] | null;
  parentRecalled?: boolean;
}

/**
 * MessageRequest to backend
 */
export interface MessageRequest {
  conversationId: number;
  content: string;
  parentId?: string | null;
  attachments?: Attachment[];
  poll?: PollRequest | null;
}

export interface PollRequest {
  question: string;
  options: PollOptionRequest[];
  multiChoice: boolean;
  allowAddOptions: boolean;
  isAnonymous: boolean;
  expiredAt?: string | null;
}

export interface PollOptionRequest {
  text: string;
}

export interface PollResponse {
  id: string;
  question: string;
  options: PollOptionResponse[];
  multiChoice: boolean;
  allowAddOptions: boolean;
  isAnonymous: boolean;
  expiredAt: string | null;
  closed: boolean;
}

export interface PollOptionResponse {
  id: string;
  text: string;
  voterIds: number[];
}

export interface ReminderRequest {
  title: string;
  content?: string;
  reminderTime: string;
  conversationId: number;
}

export interface Reminder {
  id: string;
  title: string;
  content?: string;
  reminderTime: string;
  isNotified: boolean;
  notified?: boolean;
  conversationId: number;
  creatorId: number;
  creatorName: string;
  createdAt: string;
  participantIds?: number[];
  declinedIds?: number[];
  messageId?: string;
}

/**
 * ConversationRequest to backend
 */
export interface ConversationRequest {
  name: string;
  type: string; // PRIVATE, GROUP
  participantIds: number[];
}
