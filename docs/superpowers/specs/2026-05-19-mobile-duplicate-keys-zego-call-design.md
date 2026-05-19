# Design: Mobile Duplicate Message Keys + Zego Call Init

**Date:** 2026-05-19
**Status:** Draft

## Overview

Two independent fixes for the mobile app (Expo/React Native):

1. **Duplicate message keys** — React Native FlatList warns about duplicate keys when the sender's own messages appear twice in the chat list.
2. **Zego call init** — `initZegoCallKit()` is defined but never called, so mobile-mobile and mobile-web calls fail while web-web works.

---

## Issue 1: Duplicate Message Keys

### Problem

When a user sends a message on mobile, the message can appear twice in the chat list. Both copies share the same MongoDB `id`, causing React Native's FlatList to emit a duplicate key warning.

### Root Cause

Two `setCurrentMessages` calls race:

1. **WebSocket broadcast** arrives first → `onIncomingMessage` finds the optimistic message (status=SENDING), replaces it with the server version (status=SENT, id=serverId).
2. **REST API response** arrives second → `sendMessage` tries to find the optimistic by `tempId` (not found, already consumed) → tries to find by `newMsg.id` (not found, because WebSocket used a different reference) → falls through to `return [...prev, messageWithStatus]` → **appends a duplicate**.

The same pattern exists in `retrySendMessage`.

### Fix

In the fallback append path of both `sendMessage` and `retrySendMessage`, add a final dedup check before appending:

```typescript
// Before: return [...prev, messageWithStatus];
// After:
const indexByServerId = prev.findIndex((m) => m.id === newMsg.id);
if (indexByServerId !== -1) {
  return prev.map((m) =>
    m.id === newMsg.id ? messageWithStatus : m,
  );
}
return [...prev, messageWithStatus];
```

This ensures that if the WebSocket already delivered the message, the REST response updates its status instead of appending a second copy.

### Files Changed

- `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx`
  - `sendMessage` fallback branch (~line 1283)
  - `retrySendMessage` fallback branch (~line 1407)

---

## Issue 2: Zego Call Init via useEffect

### Problem

`initZegoCallKit(user)` in `zegoCallKit.ts` is defined but never called. Without initialization, Zego's native calling UI and push notification system are not registered, so calls fail on mobile.

### Design

Use a `useEffect` in `ChatProvider` that watches the `user` object from `useAuth()`:

```typescript
useEffect(() => {
  if (!user || !isAuthenticated) {
    uninitZegoCallKit();
    return;
  }

  if (!isZegoRuntimeAvailable()) {
    return;
  }

  initZegoCallKit(user).catch((err) => {
    console.warn("[ZEGO] Init failed (non-blocking):", err);
  });

  return () => {
    uninitZegoCallKit();
  };
}, [user?.id, isAuthenticated]);
```

### Why this works

- **Login** → `user` changes from null to user object → effect runs → `initZegoCallKit(user)` → Zego ready
- **Logout** → `user` becomes null or `isAuthenticated` becomes false → cleanup runs → `uninitZegoCallKit()` → Zego cleaned up
- **Token refresh** → `user` unchanged → effect doesn't re-run → no unnecessary re-init
- **Account switch** → `user.id` changes → cleanup old, init new
- **StrictMode double-invocation** → `initZegoCallKit` deduplicates via `initKey` + `currentInitPromise` → safe

### Why not manual calls in login/logout?

- Manual calls require remembering to add them in every auth path (login, app restore, session resume, token refresh with new user data)
- `useEffect` is declarative — single source of truth tied to `user` state
- Cleanup function handles logout automatically

### Safety: What if user is not logged in or token expired?

- The effect guards on `user && isAuthenticated` — never calls `initZegoCallKit` without a valid user
- `initZegoCallKit` itself guards on `isZegoRuntimeAvailable()` — returns early in Expo Go or web runtime
- If `initZegoCallKit` throws (e.g., missing config, network error), it's caught and logged as a warning — doesn't block the app
- The `initKey` dedup in `initZegoCallKit` prevents double-init for the same user

### Files Changed

- `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx`
  - Add `useEffect` with Zego init logic
  - Import `initZegoCallKit`, `uninitZegoCallKit`, `isZegoRuntimeAvailable` from `zegoCallKit.ts`

---

## Testing

### Issue 1
- Send a message on mobile → verify it appears exactly once
- Send rapid messages → verify no duplicates
- Send message with poor network (slow REST, fast WS) → verify no duplicates
- Retry a failed message → verify no duplicates

### Issue 2
- Login → verify Zego init succeeds (check console log)
- Initiate a call from mobile to web → verify call connects
- Initiate a call from mobile to mobile → verify call connects
- Receive a call on mobile from web → verify incoming call UI appears
- Logout → verify Zego uninit runs without error
- Login with different account → verify Zego re-inits with new user ID
