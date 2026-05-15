import api from "@/lib/axios";
import type {
  AdminUser,
  MessageReport,
  AdminConversation,
  AdminStats,
} from "@/types/admin";

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export const adminService = {
  async getStats(): Promise<AdminStats> {
    const res = await api.get("/admin/stats");
    return res.data;
  },

  async getUsers(params?: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AdminUser>> {
    const res = await api.get("/admin/users", {
      params: {
        search: params?.search,
        status: params?.status,
        page: (params?.page ?? 1) - 1,
        size: params?.limit ?? 10,
      },
    });
    return {
      items: res.data.users,
      total: res.data.total,
      page: res.data.page,
      size: res.data.size,
    };
  },

  async updateUserRole(
    userId: number,
    role: string,
  ): Promise<{ message: string }> {
    const res = await api.put(`/admin/users/${userId}/role`, { role });
    return res.data;
  },

  async lockUser(userId: number): Promise<{ message: string }> {
    const res = await api.post(`/users/${userId}/lock`);
    return { message: res.data };
  },

  async unlockUser(userId: number): Promise<{ message: string }> {
    const res = await api.post(`/users/${userId}/unlock`);
    return { message: res.data };
  },

  async deleteUser(userId: number): Promise<{ message: string }> {
    const res = await api.delete(`/users/${userId}`);
    return { message: res.data };
  },

  async getReports(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<MessageReport>> {
    return {
      items: [],
      total: 0,
      page: params?.page ?? 0,
      size: params?.limit ?? 10,
    };
  },

  async resolveReport(
    _reportId: number,
    _action: "RESOLVED" | "DISMISSED",
  ): Promise<{ message: string }> {
    return { message: "Report management not yet implemented" };
  },

  async getConversations(params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AdminConversation>> {
    const res = await api.get("/admin/conversations", {
      params: {
        type: params?.type,
        page: (params?.page ?? 1) - 1,
        size: params?.limit ?? 10,
      },
    });
    return {
      items: res.data.conversations,
      total: res.data.total,
      page: res.data.page,
      size: res.data.size,
    };
  },

  async lockConversation(conversationId: number): Promise<{ message: string }> {
    const res = await api.put(`/admin/conversations/${conversationId}/lock`);
    return res.data;
  },

  async unlockConversation(conversationId: number): Promise<{ message: string }> {
    const res = await api.put(`/admin/conversations/${conversationId}/unlock`);
    return res.data;
  },

  async deleteConversation(conversationId: number): Promise<{ message: string }> {
    const res = await api.delete(`/admin/conversations/${conversationId}`);
    return res.data;
  },
};
