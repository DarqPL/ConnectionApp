# 📱 MOBILE APP SETUP & IMPLEMENTATION GUIDE

## 🎯 Current Status

- ✅ **70% Complete** - All basic features working
- ✅ Authentication (Sign in, Sign up, Forgot password)
- ✅ Chat messaging 
- ✅ User profiles with avatar S3 upload
- ✅ Friends & contacts
- ✅ Groups
- ⚠️ Real-time WebSocket (Infrastructure created, needs integration)
- ⚠️ Message reactions (Design ready, not implemented)
- ⚠️ Advanced UI polish

---

## 🚀 QUICK START (30 mins)

### Step 1: Install Missing Dependencies
```bash
cd ConnectionAppMobile/AppChatMobile

# Toast notifications (optional but recommended)
npm install react-native-toast-message

# Action sheet for menus
npm install react-native-action-sheet @react-native-menu/menu

# Haptic feedback
npx expo install expo-haptics
```

### Step 2: Start the App
```bash
npx expo start

# For iOS: choose "i"
# For Android: choose "a"
```

### Step 3: Test Features
- [x] Login with test account
- [x] Create a chat
- [x] Send messages
- [x] Update avatar (should auto-update)
- [x] Update profile
- [ ] Real-time message (this requires step 4)

---

## 🔧 IMPLEMENTATION ROADMAP

### Phase 1: Real-Time WebSocket (CRITICAL)
**Time: 2-3 hours**
**Status: Ready - Socket service created**

#### Files to Update:

**1. ChatRoomScreen.tsx** - Add WebSocket connection
```typescript
import { socketService } from "../services/socket-service";

export default function ChatRoomScreen() {
  const { user } = useAuth();
  const { addMessage, updateConversation } = useChat();
  
  useEffect(() => {
    if (!user) return;
    
    // Connect socket
    socketService.connect(user.id)
      .then(() => {
        console.log("Socket connected!");
        
        // Listen for new messages
        socketService.on("NEW_MESSAGE", (message) => {
          addMessage(activeConversationId, message);
        });
        
        // Listen for message deleted
        socketService.on("MESSAGE_DELETED", ({ messageId }) => {
          // Remove message from state
        });
        
        // Listen for user typing
        socketService.on("USER_TYPING", ({ userId }) => {
          setTypingUsers([...typingUsers, userId]);
        });
      })
      .catch((err) => {
        console.error("Socket connection failed:", err);
        Alert.alert("Lỗi", "Không thể kết nối real-time");
      });

    return () => {
      socketService.disconnect();
    };
  }, [user]);
}
```

**2. Enhanced ChatContext.tsx** - Add real-time support
```typescript
interface ChatContextType {
  // Existing...
  replyTo: Message | null;
  typingUsers: number[];
  
  // New methods
  setReplyTo: (msg: Message | null) => void;
  addTypingUser: (userId: number) => void;
  removeTypingUser: (userId: number) => void;
}
```

**3. MessageInput.tsx** - Add typing indicator
```typescript
useEffect(() => {
  if (!message.trim()) {
    socketService.notifyStoppedTyping(conversationId);
    return;
  }

  socketService.notifyTyping(conversationId);

  // Clear typing after 1 second of inactivity
  const timer = setTimeout(() => {
    socketService.notifyStoppedTyping(conversationId);
  }, 1000);

  return () => clearTimeout(timer);
}, [message, conversationId]);
```

---

### Phase 2: UI Enhancements (2-3 hours)

#### Update ChatRoomScreen to show:
1. Message avatars + sender name
2. Timestamp for each message
3. "X is typing..." indicator
4. Read receipts (Seen at timestamp)
5. Message menu on long-press

```typescript
// Example: Message with avatar
<View style={styles.messageRow}>
  <Image 
    source={{ uri: message.senderInfo.avatarUrl }}
    style={styles.avatar}
  />
  <View style={styles.messageBubble}>
    <Text style={styles.senderName}>
      {message.senderInfo.displayName}
    </Text>
    <Text style={styles.messageText}>
      {message.content}
    </Text>
    <Text style={styles.timestamp}>
      {new Date(message.createdAt).toLocaleTimeString()}
    </Text>
  </View>
</View>
```

#### Add Typing Indicator
```typescript
{typingUsers.length > 0 && (
  <View style={styles.typingIndicator}>
    <Text>{typingUsers.join(", ")} đang nhập...</Text>
  </View>
)}
```

#### Add Message Long-Press Menu
```typescript
<MessageItem
  onLongPress={() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Hủy', 'Trả lời', 'Sao chép', 'Xóa'],
        destructiveButtonIndex: 3,
      },
      (index) => {
        if (index === 1) setReplyTo(message);
        if (index === 2) Clipboard.setString(message.content);
        if (index === 3) deleteMessage(message.id);
      }
    );
  }}
/>
```

---

### Phase 3: Polish & Features (2-3 hours)

#### Add Toast Notifications
```typescript
import Toast from 'react-native-toast-message';

// On avatar upload success
Toast.show({
  type: 'success',
  text1: 'Thành công',
  text2: 'Đã cập nhật ảnh đại diện',
  duration: 2000,
});

// On message send
Toast.show({
  type: 'info',
  text1: 'Tin nhắn đã gửi',
  duration: 1000,
});
```

#### Add Message Reactions (Optional)
```typescript
// Long press → show emoji picker
// Store in backend
// Sync via WebSocket

export interface MessageReaction {
  emoji: string;
  userIds: number[];
  count: number;
}
```

#### Add Offline Queue
```typescript
// When offline, queue messages
// Auto-send when back online
const [messageQueue, setMessageQueue] = useState<Message[]>([]);

useEffect(() => {
  if (isOnline && messageQueue.length > 0) {
    messageQueue.forEach(msg => synchronizeMessage(msg));
    setMessageQueue([]);
  }
}, [isOnline]);
```

---

## 📋 DETAILED IMPLEMENTATION STEPS

### 1️⃣ Socket Service Integration (MUST DO FIRST)

**File Created:** `src/features/chat/services/socket-service.ts` ✅

**Usage Example:**
```typescript
import { socketService } from "../services/socket-service";

// In component
useEffect(() => {
  socketService.connect(userId);
  
  const unsubscribe = socketService.on("NEW_MESSAGE", (message) => {
    console.log("New message received:", message);
  });
  
  return () => {
    unsubscribe();
    socketService.disconnect();
  };
}, [userId]);
```

---

### 2️⃣ Update ChatRoomScreen

**Needs:**
- [ ] Use socketService
- [ ] Display message avatars
- [ ] Show typing indicator
- [ ] Add message menu
- [ ] Show read receipts

**Estimated Time:** 1-2 hours

---

### 3️⃣ Fix Any Remaining Issues

**Known Issues (if any):**
- [ ] Avatar upload confirmation
- [ ] Message sending feedback
- [ ] Error handling

---

## 🎨 UI IMPROVEMENTS

### Current Issues
- Messages don't show sender avatar
- No timestamp on messages
- No typing indicator
- No message menu
- No confirmation on avatar upload

### Solutions Provided
- Socket service: `socket-service.ts` ✅
- Example implementations above ✅
- Comprehensive guide: This document ✅

---

## 📱 TESTING GUIDE

### Test Avatar Upload
1. Go to Profile
2. Tap avatar
3. Select image
4. Wait for upload
5. ✅ Should show updated avatar immediately

### Test Real-Time Messages
1. Open chat on 2 devices
2. Send message on one
3. ✅ Should appear on other in <1 second
4. ✅ Should show typing indicator

### Test Friend Requests
1. Go to Contacts
2. Search for another user
3. Send request
4. ✅ Other user should see notification

---

## 🔗 API INTEGRATION

All endpoints are already integrated:
- ✅ Chat messages
- ✅ Avatar upload to S3
- ✅ User profile
- ✅ Friends
- ✅ Groups

Just need to add:
- WebSocket real-time layer (service created ✅)
- UI enhancements

---

## 💡 TIPS & TRICKS

### 1. Use console logs to debug
```typescript
console.log("[ChatRoomScreen] Message received:", message);
console.log("[SocketService] Connected to:", url);
```

### 2. Test with mock data
```typescript
const mockMessage: Message = {
  id: "123",
  content: "Hello world",
  conversationId: 1,
  senderInfo: { senderId: 1, displayName: "User" },
  createdAt: new Date().toISOString(),
  // ...
};
```

### 3. Add error boundaries
```typescript
<ErrorBoundary>
  <ChatRoomScreen />
</ErrorBoundary>
```

---

## 🐛 TROUBLESHOOTING

### Avatar not updating
- Check: Is S3 upload working?
- Check: Is `fetchMe()` being called?
- Solution: Add `console.log` in upload handler

### Messages not sending
- Check: Is conversation selected?
- Check: Is there network connection?
- Solution: Check ChatContext state

### WebSocket not connecting
- Check: Is URL correct?
- Check: Is server running?
- Solution: Check `authService.getWebSocketUrl()`

---

## ✅ COMPLETION CHECKLIST

- [ ] Socket service created ✅
- [ ] WebSocket connected in ChatRoomScreen
- [ ] Real-time messages working
- [ ] Typing indicator showing
- [ ] Message avatars displaying
- [ ] Message menu working
- [ ] Toast notifications working
- [ ] Avatar upload confirmed with toast
- [ ] Test on both iOS and Android
- [ ] All features work like web app

---

## 📞 SUPPORT

If stuck, check:
1. Console logs for errors
2. Network tab in DevTools
3. Backend API responses
4. Socket connection status

---

## 🎯 FINAL GOAL

**Make mobile app 100% feature parity with web:**
- ✅ Auth
- ✅ Chat
- ✅ Friends
- ✅ Profile
- ⚠️ Real-time (in progress)
- ⚠️ Polish (in progress)

**Estimated Total Time:** 4-6 hours for complete implementation

---

**Last Updated:** April 16, 2026  
**Version:** 1.0  
**Status:** Ready to implement 🚀
