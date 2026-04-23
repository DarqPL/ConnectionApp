import type { Conversation, Message } from "@/types/chat";
import type { User } from "@/types/user";

export const MOCK_CURRENT_USER: User = {
  id: 0,
  username: "guest",
  displayName: "Connection User",
  email: "guest@example.com",
  role: "USER",
  status: "OFFLINE",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=connection-user",
  bio: "ConnectionApp",
  phone: "",
};

export const MOCK_CONVERSATIONS: Conversation[] = [];

export const MOCK_MESSAGES: Record<
  number,
  { items: Message[]; hasMore: boolean; nextCursor?: string | null }
> = {};

export const MOCK_ONLINE_USERS: string[] = [];
