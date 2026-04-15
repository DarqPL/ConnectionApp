# 🚀 15-MINUTE QUICK START

## What's Done ✅
- Web avatar upload → S3 (fixed)
- Mobile avatar upload → S3 (fixed)
- Mobile signup (fixed)
- Real-time WebSocket service (created)
- All API services ready
- All stores ready

## What's Next ⚠️
- Connect WebSocket to chat screens (30 mins)
- Improve message UI - avatars, timestamps (1 hour)
- Add typing indicators (30 mins)

---

## Start Here

### Step 1: Copy Socket Service (Already Done)
✅ File exists: `ConnectionAppMobile/AppChatMobile/src/features/chat/services/socket-service.ts`

### Step 2: Run the App (5 mins)
```bash
cd ConnectionAppMobile/AppChatMobile
npm install  # If needed
npx expo start

# Then pick:
# "a" for Android
# "i" for iOS
```

### Step 3: Test Current Features (5 mins)
- [ ] Login
- [ ] Send message
- [ ] Update avatar
- [ ] Update profile

### Step 4: Add Real-Time (30 mins) ⚡
**Follow:** `WEBSOCKET_INTEGRATION.md`

1. Update `ChatContext.tsx` → Add socket connection
2. Update `ChatRoomScreen.tsx` → Use real-time features
3. Update `MessageItem.tsx` → Show avatars + timestamps
4. Update `MessageInput.tsx` → Add typing indicator

**Code snippets provided in integration guide!**

---

## Files to Edit

### Essential (Required for real-time)
```
src/features/chat/context/ChatContext.tsx       (Add socket listeners)
src/features/chat/screens/ChatRoomScreen.tsx    (Use socket events)
src/features/chat/components/MessageItem.tsx    (Show avatar + timestamp)
src/features/chat/components/MessageInput.tsx   (Add typing indicator)
```

### Optional (UI Polish)
```
src/features/chat/components/ChatCard.tsx       (Show preview)
src/features/chat/components/EmojiPicker.tsx    (Add reactions)
src/screens/ProfileScreen.tsx                   (Better avatar display)
```

---

## Copy-Paste Ready Code

### In ChatContext.tsx (Add Socket Support)
```typescript
// At top
import { socketService } from '../services/socket-service';

// In ChatProvider component
useEffect(() => {
  if (!user?.id) return;
  
  socketService.connect(user.id).then(() => {
    socketService.on('NEW_MESSAGE', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    
    socketService.on('USER_TYPING', (data) => {
      setTypingUsers(prev => 
        prev.includes(data.userId) ? prev : [...prev, data.userId]
      );
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(id => id !== data.userId));
      }, 3000);
    });
  });
  
  return () => socketService.disconnect();
}, [user?.id]);
```

### In ChatRoomScreen.tsx (Use Socket Events)
```typescript
// When sending message
const handleSend = () => {
  const msg = { conversationId, content, replyToId: replyTo?.id };
  
  socketService.send({ event: 'message', data: msg });
  await chatService.sendMessage(conversationId, content, replyTo?.id);
};

// Show typing indicator
{typingUsers.length > 0 && (
  <Text>Người khác đang nhập...</Text>
)}
```

### In MessageItem.tsx (Show Avatar)
```typescript
<View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
  <Image
    source={{ uri: message.senderInfo?.avatarUrl }}
    style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8 }}
  />
  <View style={{ flex: 1 }}>
    <Text style={{ fontWeight: '600', fontSize: 12 }}>
      {message.senderInfo?.displayName}
    </Text>
    <Text>{message.content}</Text>
    <Text style={{ fontSize: 11, color: '#999' }}>
      {new Date(message.createdAt).toLocaleTimeString()}
    </Text>
  </View>
</View>
```

---

## Debugging

### Check if Socket Connected
```typescript
// In ChatRoomScreen
const { isSocketConnected } = useChat();
console.log('Socket connected:', isSocketConnected);

// See realtime status
<Text>{isSocketConnected ? '🟢 Online' : '🔴 Offline'}</Text>
```

### Check Messages Are Received
```typescript
socketService.on('NEW_MESSAGE', (msg) => {
  console.log('📨 New message:', msg);
});
```

### Check Typing Indicator
```typescript
socketService.on('USER_TYPING', (data) => {
  console.log('✏️ User typing:', data); 
});
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Messages not syncing in real-time | Make sure `ChatContext` has socket listeners |
| WebSocket connection fails | Check backend is running + CORS enabled |
| Typing indicator not showing | Verify `addTypingUser()` is called in socket listener |
| Avatar not showing | Check image URL is valid (log `message.senderInfo.avatarUrl`) |
| Timestamp formatting wrong | Check ISO format from backend |

---

## Next After Real-Time Works

### Phase 2 (1 hour)
- [ ] Add message long-press menu (delete, edit, reply)
- [ ] Add emoji reactions
- [ ] Add read receipts

### Phase 3 (1 hour)
- [ ] Add offline message queue
- [ ] Add push notifications
- [ ] Add profile picture updates to all messages

---

## Structure Overview

```
ConnectionAppMobile/
├── AppChatMobile/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/              ✅ Done
│   │   │   └── chat/
│   │   │       ├── context/
│   │   │       │   └── ChatContext.tsx      👈 Update here
│   │   │       ├── screens/
│   │   │       │   └── ChatRoomScreen.tsx   👈 Update here
│   │   │       ├── components/
│   │   │       │   ├── MessageItem.tsx      👈 Update here
│   │   │       │   └── MessageInput.tsx     👈 Update here
│   │   │       └── services/
│   │   │           └── socket-service.ts    ✅ Ready!
│   │   └── screens/
│   │       └── ProfileScreen.tsx            ✅ Done
│   └── package.json
```

---

## Success Criteria

After following this guide, you should have:
- ✅ Real-time messages (appear instantly on both devices)
- ✅ Typing indicator (shows when someone typing)
- ✅ Message avatars (show sender photo)
- ✅ Timestamps (show when message sent)
- ✅ Online/offline status
- ✅ Auto-reconnect on disconnect

**Time required:** 2-3 hours total

---

## Questions?

Check these files in order:
1. **WEBSOCKET_INTEGRATION.md** - Detailed code walkthrough
2. **MOBILE_SETUP_GUIDE.md** - Complete feature guide
3. **MOBILE_ACTION_PLAN.md** - Priority roadmap
4. **socket-service.ts** - Socket implementation

---

## TL;DR

1. Open `ChatContext.tsx`
2. Add socket connection in useEffect
3. Listen for `NEW_MESSAGE` events
4. Update state with new messages
5. Show sender avatar in `MessageItem.tsx`
6. Display typing indicator from `typingUsers` state
7. Test on 2 devices

**Done!** 🎉
