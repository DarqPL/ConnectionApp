import type {
  Attachment,
  Conversation,
  Message,
  Participant,
  PollRequest,
  ReminderRequest,
} from "./chat";
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
  ) => Promise<void>;
  sendSignupOtp: (email: string, username?: string) => Promise<void>;
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
  typingByConversation: Record<number, TypingUser[]>;
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
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  reset: () => void;

  setActiveConversation: (id: number | null) => void;
  fetchConversations: (page?: number) => Promise<void>;
  fetchMessages: (conversationId?: number) => Promise<void>;
  sendMessage: (
    conversationId: number,
    content: string,
    parentId?: string | null,
    attachments?: Attachment[],
    poll?: PollRequest | null,
  ) => Promise<void>;
  retrySendMessage: (
    conversationId: number,
    tempMessageId: string,
  ) => Promise<void>;
  votePoll: (messageId: string, optionIds: string[]) => Promise<void>;
  closePoll: (messageId: string) => Promise<void>;
  reactMessage: (
    conversationId: number,
    messageId: string,
    reactionCode: string | null,
  ) => Promise<void>;
  pinMessage: (conversationId: number, messageId: string) => Promise<void>;
  unpinMessage: (conversationId: number, messageId: string) => Promise<void>;
  fetchConversationById: (conversationId: number) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  recallMessage: (conversationId: number, messageId: string) => Promise<void>;
  deleteMessage: (conversationId: number, messageId: string) => Promise<void>;
  removeMessage: (conversationId: number, messageId: string) => void;
  updateConversation: (
    conversation: Partial<Conversation> & { id: number },
  ) => void;
  updateConversationParticipants: (
    conversationId: number,
    participants: Participant[],
  ) => void;
  upsertTypingUser: (typingUser: TypingUser) => void;
  removeTypingUser: (conversationId: number, userId: number) => void;
  clearTypingUsers: (conversationId: number) => void;
  clearAllTypingUsers: () => void;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: string,
    name: string,
    participantIds: number[],
  ) => Promise<void>;
  removeConversation: (conversationId: number) => void;
  createReminder: (request: ReminderRequest) => Promise<void>;
  deleteReminder: (messageId: string) => Promise<void>;
}

export interface TypingUser {
  conversationId: number;
  userId: number;
  displayName: string;
  typedAt?: string;
}

export interface SocketState {
  client: unknown | null;
  connectSocket: (userId: number) => void;
  disconnectSocket: () => void;
  notifyTyping: (conversationId: number) => void;
  notifyStoppedTyping: (conversationId: number) => void;
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
  addPendingRequest: (newRequest: Friend) => void;
  removePendingRequest: (friendId: number) => void;
}

export interface UserState {
  user?: User | null;
  updateProfile: (profile: Partial<User>) => Promise<void>;
  updateAvatarUrl: (formData: FormData) => Promise<User>;
}
