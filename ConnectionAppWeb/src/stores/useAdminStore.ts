import { create } from "zustand";
import { adminService } from "@/services/adminService";
import type {
  AdminUser,
  MessageReport,
  AdminConversation,
  AdminStats,
} from "@/types/admin";

interface AdminState {
  stats: AdminStats | null;
  users: AdminUser[];
  userTotal: number;
  userPage: number;
  reports: MessageReport[];
  reportTotal: number;
  conversations: AdminConversation[];
  conversationTotal: number;
  conversationPage: number;
  loading: boolean;

  fetchStats: () => Promise<void>;
  fetchUsers: (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  fetchReports: (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  fetchConversations: (params?: {
    type?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;

  lockUser: (userId: number) => Promise<void>;
  unlockUser: (userId: number) => Promise<void>;
  updateUserRole: (userId: number, role: string) => Promise<void>;
  deleteUser: (userId: number) => Promise<void>;

  resolveReport: (
    reportId: number,
    action: "RESOLVED" | "DISMISSED",
  ) => Promise<void>;

  lockConversation: (conversationId: number) => Promise<void>;
  unlockConversation: (conversationId: number) => Promise<void>;
  deleteConversation: (conversationId: number) => Promise<void>;
}

export const useAdminStore = create<AdminState>()((set, get) => ({
  stats: null,
  users: [],
  userTotal: 0,
  userPage: 0,
  reports: [],
  reportTotal: 0,
  conversations: [],
  conversationTotal: 0,
  conversationPage: 0,
  loading: false,

  fetchStats: async () => {
    try {
      const stats = await adminService.getStats();
      set({ stats });
    } catch {
      // silent fail for stats
    }
  },

  fetchUsers: async (params) => {
    set({ loading: true });
    try {
      const { items, total, page } = await adminService.getUsers(params);
      set({ users: items, userTotal: total, userPage: page });
    } finally {
      set({ loading: false });
    }
  },

  fetchReports: async (params) => {
    set({ loading: true });
    try {
      const { items, total } = await adminService.getReports(params);
      set({ reports: items, reportTotal: total });
    } finally {
      set({ loading: false });
    }
  },

  fetchConversations: async (params) => {
    set({ loading: true });
    try {
      const { items, total, page } = await adminService.getConversations(params);
      set({ conversations: items, conversationTotal: total, conversationPage: page });
    } finally {
      set({ loading: false });
    }
  },

  lockUser: async (userId) => {
    await adminService.lockUser(userId);
    await get().fetchUsers();
    await get().fetchStats();
  },

  unlockUser: async (userId) => {
    await adminService.unlockUser(userId);
    await get().fetchUsers();
    await get().fetchStats();
  },

  updateUserRole: async (userId, role) => {
    await adminService.updateUserRole(userId, role);
    await get().fetchUsers();
  },

  deleteUser: async (userId) => {
    await adminService.deleteUser(userId);
    await get().fetchUsers();
    await get().fetchStats();
  },

  resolveReport: async (reportId, action) => {
    await adminService.resolveReport(reportId, action);
    await get().fetchReports();
    await get().fetchStats();
  },

  lockConversation: async (conversationId) => {
    await adminService.lockConversation(conversationId);
    await get().fetchConversations();
  },

  unlockConversation: async (conversationId) => {
    await adminService.unlockConversation(conversationId);
    await get().fetchConversations();
  },

  deleteConversation: async (conversationId) => {
    await adminService.deleteConversation(conversationId);
    await get().fetchConversations();
    await get().fetchStats();
  },
}));
