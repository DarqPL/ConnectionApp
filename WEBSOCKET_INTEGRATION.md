# 🔌 WEBSOCKET INTEGRATION GUIDE

## Overview

This guide shows how to integrate the Socket Service into your mobile app for real-time features.

---

## Step 1: Copy Socket Service

**File location:** `ConnectionAppMobile/AppChatMobile/src/features/chat/services/socket-service.ts`

The socket service is already created. It provides:
- ✅ `connect(userId)` - Connect to WebSocket
- ✅ `send(data)` - Send messages
- ✅ `on(event, handler)` - Listen to events
- ✅ `disconnect()` - Close connection
- ✅ Auto-reconnect with exponential backoff

---

## Step 2: Update ChatContext

**File:** `src/features/chat/context/ChatContext.tsx`

Add these to the context:

```typescript
import { socketService } from '../services/socket-service';

export interface ChatContextType {
  // Existing code...
  
  // NEW: Real-time features
  replyTo: Message | null;
  setReplyTo: (msg: Message | null) => void;
  
  typingUsers: number[];
  addTypingUser: (userId: number) => void;
  removeTypingUser: (userId: number) => void;
  
  isSocketConnected: boolean;
}

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  // Existing state...
  
  // NEW: Real-time state
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // NEW: Connect socket when user logs in
  useEffect(() => {
    const user = authContext?.user;
    if (!user) return;

    console.log('[ChatContext] Connecting socket for user:', user.id);
    
    socketService
      .connect(user.id)
      .then(() => {
        console.log('[ChatContext] Socket connected');
        setIsSocketConnected(true);

        // Listen for NEW_MESSAGE
        socketService.on('NEW_MESSAGE', (message: any) => {
          console.log('[ChatContext] Received new message:', message);
          setMessages(prev => [...prev, message]);
        });

        // Listen for MESSAGE_EDITED
        socketService.on('MESSAGE_EDITED', (data: any) => {
          console.log('[ChatContext] Message edited:', data);
          setMessages(prev =>
            prev.map(m =>
              m.id === data.messageId ? { ...m, content: data.content } : m
            )
          );
        });

        // Listen for MESSAGE_DELETED
        socketService.on('MESSAGE_DELETED', (data: any) => {
          console.log('[ChatContext] Message deleted:', data);
          setMessages(prev => prev.filter(m => m.id !== data.messageId));
        });

        // Listen for USER_TYPING
        socketService.on('USER_TYPING', (data: any) => {
          console.log('[ChatContext] User typing:', data);
          setTypingUsers(prev => {
            if (!prev.includes(data.userId)) {
              return [...prev, data.userId];
            }
            return prev;
          });

          // Auto-remove after 3 seconds
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(id => id !== data.userId));
          }, 3000);
        });

        // Listen for USER_STOPPED_TYPING
        socketService.on('USER_STOPPED_TYPING', (data: any) => {
          console.log('[ChatContext] User stopped typing:', data);
          setTypingUsers(prev => prev.filter(id => id !== data.userId));
        });
      })
      .catch(err => {
        console.error('[ChatContext] Socket connection failed:', err);
        setIsSocketConnected(false);
      });

    return () => {
      console.log('[ChatContext] Disconnecting socket');
      socketService.disconnect();
      setIsSocketConnected(false);
    };
  }, [authContext?.user]);

  const addTypingUser = (userId: number) => {
    setTypingUsers(prev => {
      if (!prev.includes(userId)) {
        return [...prev, userId];
      }
      return prev;
    });
  };

  const removeTypingUser = (userId: number) => {
    setTypingUsers(prev => prev.filter(id => id !== userId));
  };

  const value: ChatContextType = {
    // Existing...
    conversations,
    messages,
    loading,
    error,
    
    // NEW:
    replyTo,
    setReplyTo,
    typingUsers,
    addTypingUser,
    removeTypingUser,
    isSocketConnected,
    
    // Methods...
    fetchConversations,
    fetchMessages,
    addMessage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
```

---

## Step 3: Update ChatRoomScreen

**File:** `src/features/chat/screens/ChatRoomScreen.tsx`

Update to use real-time features:

```typescript
import { useChat } from '../context/ChatContext';
import { socketService } from '../services/socket-service';

export default function ChatRoomScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ChatRoom'>>();
  const { conversationId } = route.params;

  const {
    messages,
    addMessage,
    typingUsers,
    replyTo,
    setReplyTo,
    isSocketConnected,
  } = useChat();

  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle typing indicator
  useEffect(() => {
    if (!isSocketConnected) return;

    if (newMessage.trim()) {
      if (!isTyping) {
        socketService.notifyTyping(conversationId);
        setIsTyping(true);
      }
    } else {
      if (isTyping) {
        socketService.notifyStoppedTyping(conversationId);
        setIsTyping(false);
      }
    }
  }, [newMessage, isSocketConnected, conversationId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isSocketConnected) return;

    try {
      const messageData = {
        conversationId,
        content: newMessage,
        replyToId: replyTo?.id || null,
      };

      // Send through socket (real-time)
      socketService.send({
        event: 'message',
        data: messageData,
      });

      // Also send through API for persistence
      await chatService.sendMessage(conversationId, newMessage, replyTo?.id);

      setNewMessage('');
      setReplyTo(null);
      setIsTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <ChatWindowHeader
        conversationId={conversationId}
        isSocketConnected={isSocketConnected}
      />

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map(message => (
          <MessageItem
            key={message.id}
            message={message}
            onReply={() => setReplyTo(message)}
            onDelete={(id) => {
              // Delete message
              chatService.deleteMessage(id);
            }}
          />
        ))}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>
              {typingUsers.length === 1 ? 'Người khác' : 'Mọi người'} đang nhập...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Reply Preview */}
      {replyTo && (
        <View style={styles.replyPreview}>
          <View>
            <Text style={styles.replyLabel}>Trả lời</Text>
            <Text style={styles.replyContent}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={styles.replyClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Message Input */}
      <MessageInput
        message={newMessage}
        onChangeText={setNewMessage}
        onSend={handleSendMessage}
        disabled={!isSocketConnected}
      />

      {/* Connection Status */}
      {!isSocketConnected && (
        <View style={styles.connectionWarning}>
          <Text>Đang kết nối...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messageList: {
    flex: 1,
    padding: 16,
  },
  typingIndicator: {
    paddingVertical: 8,
  },
  typingText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  replyPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  replyLabel: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  replyContent: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  replyClose: {
    fontSize: 16,
    color: '#666',
  },
  connectionWarning: {
    backgroundColor: '#FFA500',
    padding: 8,
    alignItems: 'center',
  },
});
```

---

## Step 4: Update MessageInput Component

**File:** `src/features/chat/components/MessageInput.tsx`

```typescript
export interface MessageInputProps {
  message: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export default function MessageInput({
  message,
  onChangeText,
  onSend,
  disabled = false,
}: MessageInputProps) {
  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        placeholder="Nhập tin nhắn..."
        value={message}
        onChangeText={onChangeText}
        multiline
        editable={!disabled}
      />
      <TouchableOpacity
        style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={disabled || !message.trim()}
      >
        <Text style={styles.sendIcon}>➤</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    maxHeight: 100,
  },
  inputDisabled: {
    backgroundColor: '#e0e0e0',
    color: '#999',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendIcon: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
});
```

---

## Step 5: Update MessageItem Component

**File:** `src/features/chat/components/MessageItem.tsx`

Add avatar display and timestamp:

```typescript
import { View, Text, Image, TouchableOpacity } from 'react-native';

export interface MessageItemProps {
  message: any; // Message type
  onReply?: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newContent: string) => void;
}

export default function MessageItem({
  message,
  onReply,
  onDelete,
}: MessageItemProps) {
  const isSent = message.senderId === currentUserId; // Get from context

  return (
    <View style={[styles.container, isSent && styles.sentContainer]}>
      {!isSent && (
        <Image
          source={{ uri: message.senderInfo?.avatarUrl }}
          style={styles.avatar}
        />
      )}

      <View style={[styles.messageBubble, isSent && styles.sentBubble]}>
        {!isSent && (
          <Text style={styles.senderName}>
            {message.senderInfo?.displayName}
          </Text>
        )}

        {message.replyTo && (
          <View style={styles.replyBox}>
            <Text style={styles.replyName}>
              {message.replyTo.senderInfo?.displayName}
            </Text>
            <Text style={styles.replyContent} numberOfLines={2}>
              {message.replyTo.content}
            </Text>
          </View>
        )}

        <Text style={[styles.content, isSent && styles.sentContent]}>
          {message.content}
        </Text>

        <Text style={styles.timestamp}>
          {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {isSent && (
        <View style={styles.statusIcon}>
          {message.status === 'read' && <Text>✓✓</Text>}
          {message.status === 'sent' && <Text>✓</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  sentContainer: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 12,
  },
  sentBubble: {
    backgroundColor: '#007AFF',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  replyBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  replyName: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  replyContent: {
    fontSize: 12,
    color: '#333',
    marginTop: 2,
  },
  content: {
    fontSize: 14,
    color: '#333',
  },
  sentContent: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  statusIcon: {
    marginLeft: 4,
  },
});
```

---

## Testing

### Test Real-Time Messages

1. **Open 2 terminals:**
   ```bash
   # Terminal 1: Device 1
   npx expo start
   # Press "a" for Android or "i" for iOS
   
   # Terminal 2: Device 2
   npx expo start --tunnel
   # Scan QR code
   ```

2. **Login on both devices with different accounts**

3. **Send message on device 1:**
   - ✅ Should appear on device 2 within 1 second
   - ✅ Should show sender avatar
   - ✅ Should show timestamp

4. **Check typing indicator:**
   - Type on device 1
   - ✅ Should show "Người khác đang nhập..." on device 2
   - ✅ Should disappear after 3 seconds if no activity

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Messages not syncing | Check if socket is connected: `console.log(isSocketConnected)` |
| Typing indicator not showing | Verify user ID is passed to socket connection |
| Avatar not displaying | Check image URL is valid and accessible |
| Timestamps wrong | Verify backend is sending correct ISO format |

---

## Performance Tips

1. **Virtual list for many messages:**
   ```typescript
   import { FlatList } from 'react-native';
   
   <FlatList
     data={messages}
     keyExtractor={(m) => m.id}
     renderItem={({ item }) => <MessageItem message={item} />}
     inverted // Show latest at bottom
   />
   ```

2. **Debounce typing indicator:**
   ```typescript
   const typingTimeout = useRef<NodeJS.Timeout>();
   
   useEffect(() => {
     clearTimeout(typingTimeout.current);
     socketService.notifyTyping(conversationId);
     
     typingTimeout.current = setTimeout(() => {
       socketService.notifyStoppedTyping(conversationId);
     }, 1000);
   }, [newMessage]);
   ```

3. **Image caching:**
   ```typescript
   import { Image } from 'react-native';
   
   Image.prefetch(avatarUrl); // Pre-load avatar
   ```

---

**You're all set!** 🎉  
Your app now has real-time features like WhatsApp/Telegram.

