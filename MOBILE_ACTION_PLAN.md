# 📋 MOBILE APP COMPLETION ACTION PLAN

## Phase 1: Essential Features (Do First)
Status: 🔴 NOT STARTED

### 1.1 Enhance ChatContext with Full Features
```
Needed:
- Add messageInput state (for form handling)
- Add replyTo state (for message replies)
- Add selectedMessages state (for multi-select delete)
- Add isOnline, typingUsers tracking
- Add optimistic updates for messages
```

### 1.2 Add WebSocket Service for Real-Time
```typescript
// Need to create: src/features/chat/services/socket.service.ts
- Connect on app start
- Listen for: new messages, message deleted, user typing, user online/offline
- Auto-reconnect on disconnect
- Emit: message sent, user is typing, user going online/offline
```

### 1.3 Improve Message Rendering
```
- Show message sender avatar
- Show message timestamp
- Show "is typing..." indicator
- Show message read status
- Long-press to delete/edit/reply
```

### 1.4 Add Message Reply UI
```
- Show reply bubble with parent message
- Enable tap-to-scroll-to-parent
- Show parent sender name + content
```

---

## Phase 2: UI/UX Polish
Status: 🔴 NOT STARTED

### 2.1 Add Loading States
```
- SkeletonLoader for message list
- Shimmer effect while loading
- Loading indicator in input
```

### 2.2 Add Toast Notifications
```typescript
// Install: npm install react-native-toast-message
- Show toast on message send
- Show toast on avatar update
- Show errors as toasts
```

### 2.3 Add Animations
```
- Fade in new messages
- Slide in new conversations
- Scale avatar upload progress
```

---

## Phase 3: Advanced Features
Status: 🔴 NOT STARTED

### 3.1 Message Reactions
```
- Add emoji picker
- Store reactions in DB
- Sync via WebSocket
```

### 3.2 Message Search
```
- Add search query input
- Call search API
- Highlight matches
```

### 3.3 Offline Mode
```
- Queue messages when offline
- Sync when back online
- Show offline indicator
```

---

## 🎯 QUICK WINS (Start Here!)

### 1. Fix Avatar Upload (DONE ✅)
- ✅ Already working on mobile with S3

### 2. Add Real-Time WebSocket
**File to create:** `src/features/chat/services/socket.service.ts`
```typescript
export class SocketService {
  private socket: WebSocket | null = null;

  connect(userId: number) {
    const wsUrl = authService.getWebSocketUrl();
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      this.send({ type: 'USER_ONLINE', userId });
    };
    
    this.socket.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      
      if (type === 'NEW_MESSAGE') {
        // Emit to ChatContext
      } else if (type === 'USER_TYPING') {
        // Show typing indicator
      } else if (type === 'MESSAGE_DELETED') {
        // Remove from messages
      }
    };
  }

  disconnect() {
    this.socket?.close();
  }

  send(data: any) {
    this.socket?.send(JSON.stringify(data));
  }
}
```

### 3. Enhanced ChatContext
**File to update:** `src/features/chat/context/ChatContext.tsx`
```typescript
export const ChatProvider = ({ children }) => {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  // Add these methods:
  - replyToMessage(msg: Message)
  - cancelReply()
  - handleTypingIndicator(isTyping: boolean)
  - handleUserTyping(userId: number)
};
```

### 4. Message UI Enhancements
**File to update:** `src/features/chat/screens/ChatRoomScreen.tsx`
```
- Add message avatar/name
- Add timestamp
- Add long-press menu (delete/edit/reply)
- Add typing indicator
- Add message seen status
- Show read receipts
```

---

## 🔧 IMPLEMENTATION ORDER

1. **Week 1: WebSocket Setup**
   - Create socket.service.ts
   - Connect on ChatRoomScreen mount
   - Handle real-time messages

2. **Week 2: UI Enhancements**
   - Add message avatars
   - Add message menu (long-press)
   - Add reply UI
   - Add typing indicator

3. **Week 3: Polish**
   - Add toast notifications
   - Add loading animations
   - Add offline queue
   - Fix edge cases

---

## 💡 CODE EXAMPLES

### Example 1: WebSocket Integration
```typescript
// In ChatRoomScreen.tsx
useEffect(() => {
  const socket = socketService;
  socket.connect(user!.id);
  
  const unsubscribe = socket.onMessage((data) => {
    if (data.type === 'NEW_MESSAGE') {
      addMessage(data.conversationId, data.message);
    }
  });
  
  return () => {
    unsubscribe();
    socket.disconnect();
  };
}, [user]);
```

### Example 2: Message Long-Press Menu
```typescript
<Message
  onLongPress={() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Reply', 'Edit', 'Delete'],
        destructiveButtonIndex: 3,
      },
      (index) => {
        if (index === 1) setReplyTo(message);
        if (index === 2) editMessage(message);
        if (index === 3) deleteMessage(message);
      }
    );
  }}
/>
```

---

## 📦 Dependencies to Add
```bash
npm install react-native-toast-message    # Toast notifications
npm install react-native-action-sheet     # Long-press menus
npm install react-native-gesture-handler  # Swipe gestures
npm install lottie-react-native           # Animations
npm install expo-haptics                  # Vibration feedback
```

---

## ✅ CHECKLIST

### Mobile Features Parity
- [x] Authentication (Sign in/up/forgot password)
- [x] View conversations
- [x] Send messages
- [x] Upload avatar to S3
- [x] User profile
- [ ] Real-time messages (WebSocket)
- [ ] Message replies
- [ ] Message reactions
- [ ] Message editing
- [ ] Read receipts  
- [ ] Typing indicators
- [ ] Online/offline status
- [ ] Search messages
- [ ] Search conversations
- [ ] Offline queue
- [ ] File attachments

---

## 🚀 READY TO IMPLEMENT?

Start with these 3 files:
1. **socket.service.ts** - Real-time support
2. **Enhanced ChatContext** - Better state
3. **ChatRoomScreen UI** - Better UX

Each takes ~1-2 hours to implement!

---

Status: 📍 Ready to implement
Last Updated: April 16, 2026
