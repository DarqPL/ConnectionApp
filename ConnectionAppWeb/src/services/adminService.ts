import type {
  AdminUser,
  MessageReport,
  AdminConversation,
  AdminStats,
} from "@/types/admin";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let mockUsers: AdminUser[] = [
  {
    id: 1,
    username: "admin",
    displayName: "Administrator",
    email: "admin@appchat.local",
    role: "ADMIN",
    status: "ONLINE",
    createdAt: "2025-01-01T00:00:00",
  },
  {
    id: 2,
    username: "nguyenvan_a",
    displayName: "Nguyen Van A",
    email: "vana@example.com",
    phone: "0901234567",
    role: "USER",
    status: "ONLINE",
    createdAt: "2025-02-10T08:30:00",
  },
  {
    id: 3,
    username: "tranthi_b",
    displayName: "Tran Thi B",
    email: "thib@example.com",
    phone: "0912345678",
    role: "USER",
    status: "OFFLINE",
    createdAt: "2025-03-05T14:20:00",
  },
  {
    id: 4,
    username: "levanc",
    displayName: "Le Van C",
    email: "vanc@example.com",
    role: "USER",
    status: "LOCKED",
    lockUntil: "2026-06-01T00:00:00",
    lockReason: "POLICY_VIOLATION",
    createdAt: "2025-01-20T10:00:00",
  },
  {
    id: 5,
    username: "phamthi_d",
    displayName: "Pham Thi D",
    email: "thid@example.com",
    phone: "0933456789",
    role: "USER",
    status: "ONLINE",
    createdAt: "2025-04-15T09:00:00",
  },
  {
    id: 6,
    username: "hoangvan_e",
    displayName: "Hoang Van E",
    email: "vane@example.com",
    role: "USER",
    status: "LOCKED",
    lockUntil: "2026-12-31T23:59:59",
    lockReason: "MANUAL_LOCK",
    createdAt: "2025-02-28T16:45:00",
  },
  {
    id: 7,
    username: "dangthi_f",
    displayName: "Dang Thi F",
    email: "thif@example.com",
    phone: "0944567890",
    role: "USER",
    status: "ONLINE",
    createdAt: "2025-05-01T11:30:00",
  },
  {
    id: 8,
    username: "vominh_g",
    displayName: "Vo Minh G",
    email: "minhg@example.com",
    role: "USER",
    status: "OFFLINE",
    createdAt: "2025-03-22T07:15:00",
  },
];

const mockReports: MessageReport[] = [
  {
    id: 1,
    reporterId: 3,
    reporterName: "Tran Thi B",
    reportedUserId: 4,
    reportedUserName: "Le Van C",
    messageId: "msg-001",
    messageContent: "Nội dung tin nhắn vi phạm chính sách cộng đồng...",
    conversationId: 10,
    conversationName: "Group Chat IT",
    reason: "Spam",
    status: "PENDING",
    createdAt: "2026-05-10T10:30:00",
  },
  {
    id: 2,
    reporterId: 5,
    reporterName: "Pham Thi D",
    reportedUserId: 6,
    reportedUserName: "Hoang Van E",
    messageId: "msg-002",
    messageContent: "Tin nhắn có nội dung không phù hợp...",
    conversationId: 11,
    conversationName: "Private Chat",
    reason: "Harassment",
    status: "PENDING",
    createdAt: "2026-05-11T14:00:00",
  },
  {
    id: 3,
    reporterId: 2,
    reporterName: "Nguyen Van A",
    reportedUserId: 4,
    reportedUserName: "Le Van C",
    messageId: "msg-003",
    messageContent: "Nội dung quảng cáo không được phép...",
    conversationId: 10,
    conversationName: "Group Chat IT",
    reason: "Inappropriate content",
    status: "RESOLVED",
    createdAt: "2026-05-08T09:00:00",
    resolvedAt: "2026-05-09T10:00:00",
  },
  {
    id: 4,
    reporterId: 7,
    reporterName: "Dang Thi F",
    reportedUserId: 8,
    reportedUserName: "Vo Minh G",
    messageId: "msg-004",
    messageContent: "Tin nhắn chứa thông tin sai lệch...",
    conversationId: 12,
    conversationName: "Study Group",
    reason: "Misinformation",
    status: "DISMISSED",
    createdAt: "2026-05-07T16:30:00",
    resolvedAt: "2026-05-08T08:00:00",
  },
  {
    id: 5,
    reporterId: 3,
    reporterName: "Tran Thi B",
    reportedUserId: 6,
    reportedUserName: "Hoang Van E",
    messageId: "msg-005",
    messageContent: "Nội dung đe dọa người dùng khác...",
    conversationId: 13,
    conversationName: "Group Chat Gaming",
    reason: "Threats",
    status: "PENDING",
    createdAt: "2026-05-12T08:15:00",
  },
];

let mockConversations: AdminConversation[] = [
  {
    id: 10,
    name: "Group Chat IT",
    type: "GROUP",
    participantCount: 15,
    creatorName: "Nguyen Van A",
    createdAt: "2025-03-01T10:00:00",
    status: "ACTIVE",
    lastActivity: "2026-05-12T09:30:00",
  },
  {
    id: 11,
    name: "Private Chat",
    type: "PRIVATE",
    participantCount: 2,
    createdAt: "2025-04-10T14:00:00",
    status: "ACTIVE",
    lastActivity: "2026-05-11T18:00:00",
  },
  {
    id: 12,
    name: "Study Group",
    type: "GROUP",
    participantCount: 8,
    creatorName: "Tran Thi B",
    createdAt: "2025-02-15T09:00:00",
    status: "ACTIVE",
    lastActivity: "2026-05-10T20:00:00",
  },
  {
    id: 13,
    name: "Group Chat Gaming",
    type: "GROUP",
    participantCount: 20,
    creatorName: "Hoang Van E",
    createdAt: "2025-05-20T16:00:00",
    status: "LOCKED",
    lastActivity: "2026-05-12T07:00:00",
  },
  {
    id: 14,
    name: "Private Chat 2",
    type: "PRIVATE",
    participantCount: 2,
    createdAt: "2025-06-01T11:00:00",
    status: "ACTIVE",
    lastActivity: "2026-05-09T15:30:00",
  },
  {
    id: 15,
    name: "Project Alpha",
    type: "GROUP",
    participantCount: 5,
    creatorName: "Pham Thi D",
    createdAt: "2025-07-10T08:00:00",
    status: "ACTIVE",
    lastActivity: "2026-05-12T10:00:00",
  },
];

function getMockStats(): AdminStats {
  const totalUsers = mockUsers.length;
  const activeUsers = mockUsers.filter((u) => u.status === "ONLINE").length;
  const lockedUsers = mockUsers.filter((u) => u.status === "LOCKED").length;
  const totalConversations = mockConversations.length;
  const totalReports = mockReports.length;
  const pendingReports = mockReports.filter(
    (r) => r.status === "PENDING",
  ).length;
  return {
    totalUsers,
    activeUsers,
    lockedUsers,
    totalConversations,
    totalReports,
    pendingReports,
  };
}

export const adminService = {
  async getStats(): Promise<AdminStats> {
    await delay(300);
    return getMockStats();
  },

  async getUsers(params?: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: AdminUser[]; total: number }> {
    await delay(400);
    let filtered = [...mockUsers];
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    if (params?.status) {
      filtered = filtered.filter((u) => u.status === params.status);
    }
    if (params?.role) {
      filtered = filtered.filter((u) => u.role === params.role);
    }
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const start = (page - 1) * limit;
    return {
      users: filtered.slice(start, start + limit),
      total: filtered.length,
    };
  },

  async updateUserStatus(
    userId: number,
    status: string,
  ): Promise<{ message: string }> {
    await delay(300);
    const user = mockUsers.find((u) => u.id === userId);
    if (user) {
      user.status = status;
      if (status === "LOCKED") {
        user.lockUntil = "2027-01-01T00:00:00";
        user.lockReason = "MANUAL_LOCK";
      } else {
        user.lockUntil = undefined;
        user.lockReason = undefined;
      }
    }
    return { message: `User status updated to ${status}` };
  },

  async updateUserRole(
    userId: number,
    role: string,
  ): Promise<{ message: string }> {
    await delay(300);
    const user = mockUsers.find((u) => u.id === userId);
    if (user) user.role = role;
    return { message: `User role updated to ${role}` };
  },

  async deleteUser(userId: number): Promise<{ message: string }> {
    await delay(300);
    mockUsers = mockUsers.filter((u) => u.id !== userId);
    return { message: "User deleted successfully" };
  },

  async getReports(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ reports: MessageReport[]; total: number }> {
    await delay(400);
    let filtered = [...mockReports];
    if (params?.status) {
      filtered = filtered.filter((r) => r.status === params.status);
    }
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const start = (page - 1) * limit;
    return {
      reports: filtered.slice(start, start + limit),
      total: filtered.length,
    };
  },

  async resolveReport(
    reportId: number,
    action: "RESOLVED" | "DISMISSED",
  ): Promise<{ message: string }> {
    await delay(300);
    const report = mockReports.find((r) => r.id === reportId);
    if (report) {
      report.status = action;
      report.resolvedAt = new Date().toISOString();
    }
    return { message: `Report ${action.toLowerCase()} successfully` };
  },

  async getConversations(params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ conversations: AdminConversation[]; total: number }> {
    await delay(400);
    let filtered = [...mockConversations];
    if (params?.type) {
      filtered = filtered.filter((c) => c.type === params.type);
    }
    if (params?.status) {
      filtered = filtered.filter((c) => c.status === params.status);
    }
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const start = (page - 1) * limit;
    return {
      conversations: filtered.slice(start, start + limit),
      total: filtered.length,
    };
  },

  async lockConversation(
    conversationId: number,
  ): Promise<{ message: string }> {
    await delay(300);
    const convo = mockConversations.find((c) => c.id === conversationId);
    if (convo) convo.status = "LOCKED";
    return { message: "Conversation locked" };
  },

  async deleteConversation(
    conversationId: number,
  ): Promise<{ message: string }> {
    await delay(300);
    mockConversations = mockConversations.filter(
      (c) => c.id !== conversationId,
    );
    return { message: "Conversation deleted" };
  },
};
