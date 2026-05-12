export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  status: string;
  lockUntil?: string;
  lockReason?: string;
  createdAt: string;
}

export interface MessageReport {
  id: number;
  reporterId: number;
  reporterName: string;
  reportedUserId: number;
  reportedUserName: string;
  messageId: string;
  messageContent: string;
  conversationId: number;
  conversationName: string;
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  resolvedAt?: string;
}

export interface AdminConversation {
  id: number;
  name: string;
  type: "PRIVATE" | "GROUP";
  participantCount: number;
  creatorName?: string;
  createdAt: string;
  status: "ACTIVE" | "LOCKED" | "DELETED";
  lastActivity: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  totalConversations: number;
  totalReports: number;
  pendingReports: number;
}
