import { Message, Conversation } from '../types';

// API Base URL - configure this based on your backend
const API_BASE_URL = 'https://your-api.com/api';

export class ChatService {
  private userId: string = '';

  setUserId(userId: string) {
    this.userId = userId;
  }

  // Get all conversations for current user
  async getConversations(): Promise<Conversation[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.userId}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch conversations');
      return await response.json();
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // Return mock data for demo
      return this.getMockConversations();
    }
  }

  // Get messages for a specific conversation
  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.userId}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch messages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return this.getMockMessages();
    }
  }

  // Send a message
  async sendMessage(conversationId: string, content: string): Promise<Message> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.userId}`,
          },
          body: JSON.stringify({
            content,
            senderId: this.userId,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send message');
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      // Return mock message for demo
      return {
        id: Date.now().toString(),
        conversationId,
        senderId: this.userId,
        content,
        createdAt: new Date().toISOString(),
        isDeleted: false,
      };
    }
  }

  // Create a new conversation
  async createConversation(name: string, participantId: string): Promise<Conversation> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.userId}`,
        },
        body: JSON.stringify({
          name,
          participantId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create conversation');
      return await response.json();
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Delete a message
  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.userId}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete message');
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Mock data for demo/offline mode
  private getMockConversations(): Conversation[] {
    return [
      {
        id: '1',
        name: 'Hội Bạn Thân 💖',
        avatarUrl: 'https://i.pravatar.cc/150?img=1',
        lastMessage: 'Cuối tuần đi cà phê không?',
        lastMessageAt: new Date(Date.now() - 86400000).toISOString(),
        unreadCount: 0,
      },
      {
        id: '2',
        name: 'Trần Thị Bình',
        avatarUrl: 'https://i.pravatar.cc/150?img=2',
        lastMessage: 'Anh ơi bài tập khó quá 🥲',
        lastMessageAt: new Date(Date.now() - 82800000).toISOString(),
        unreadCount: 2,
      },
    ];
  }

  private getMockMessages(): Message[] {
    return [
      {
        id: '1',
        conversationId: '2',
        senderId: 'user-2',
        content: 'Anh ơi bài tập khó quá 🥲',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        isDeleted: false,
      },
      {
        id: '2',
        conversationId: '2',
        senderId: 'current-user',
        content: 'Bài nào khó thế?',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        isDeleted: false,
      },
      {
        id: '3',
        conversationId: '2',
        senderId: 'user-2',
        content: 'Bài số 5 là khó nhất',
        createdAt: new Date(Date.now() - 600000).toISOString(),
        isDeleted: false,
      },
    ];
  }
}

export const chatService = new ChatService();
