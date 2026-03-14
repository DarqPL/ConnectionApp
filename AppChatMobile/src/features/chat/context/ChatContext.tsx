import React, { createContext, useContext, useState, useCallback } from 'react';
import { Message, Conversation } from '../types';
import { chatService } from '../services/chat.service';

interface ChatContextType {
  conversations: Conversation[];
  currentMessages: Message[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  setCurrentConversation: (conversationId: string | null) => void;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await chatService.getConversations();
      setConversations(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch conversations';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await chatService.getMessages(conversationId);
      setCurrentMessages(data);
      setCurrentConversationId(conversationId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch messages';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      setError(null);
      try {
        const newMessage = await chatService.sendMessage(
          conversationId,
          content
        );
        setCurrentMessages((prev) => [...prev, newMessage]);

        // Update last message in conversation
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  lastMessage: content,
                  lastMessageAt: new Date().toISOString(),
                }
              : conv
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const deleteMessage = useCallback(
    async (conversationId: string, messageId: string) => {
      setError(null);
      try {
        await chatService.deleteMessage(conversationId, messageId);
        setCurrentMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, isDeleted: true }
              : msg
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to delete message';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const setCurrentConversationSafe = useCallback(
    (conversationId: string | null) => {
      setCurrentConversationId(conversationId);
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: ChatContextType = {
    conversations,
    currentMessages,
    currentConversationId,
    isLoading,
    error,
    fetchConversations,
    fetchMessages,
    sendMessage,
    deleteMessage,
    setCurrentConversation: setCurrentConversationSafe,
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
