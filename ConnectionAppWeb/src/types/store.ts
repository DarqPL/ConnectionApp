import type { Attachment, Conversation, Message } from "./chat";
import type { Friend, User } from "./user";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;

  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearState: () => void;
  signUp: (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string,
    otp: string,
  ) => Promise<void>;
  sendSignupOtp: (email: string, username: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    number,
    {
      items: Message[];
      hasMore: boolean;
      page: number;
    }
  >;
  activeConversationId: number | null;
  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  reset: () => void;

  setActiveConversation: (id: number | null) => void;
  fetchConversations: (page?: number) => Promise<void>;
  fetchMessages: (conversationId?: number) => Promise<void>;
  sendMessage: (
    conversationId: number,
    content: string,
    parentId?: string | null,
    attachments?: Attachment[],
  ) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  recallMessage: (conversationId: number, messageId: string) => Promise<void>;
  updateConversation: (
    conversation: Partial<Conversation> & { id: number },
  ) => void;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: string,
    name: string,
    participantIds: number[],
  ) => Promise<void>;
}

export interface SocketState {
  client: unknown | null;
  onlineUsers: string[];
  connectSocket: (userId: number) => void;
  disconnectSocket: () => void;
}

export interface FriendState {
  friends: Friend[];
  loading: boolean;
  pendingRequests: Friend[];
  sendFriendRequest: (receiverId: number) => Promise<void>;
  acceptFriendRequest: (requesterId: number) => Promise<void>;
  rejectFriendRequest: (requesterId: number) => Promise<void>;
  getFriends: () => Promise<void>;
  getPendingRequests: () => Promise<void>;
  checkFriendship: (otherUserId: number) => Promise<boolean>;
}

export interface UserState {
  updateProfile: (profile: Partial<User>) => Promise<void>;
}
