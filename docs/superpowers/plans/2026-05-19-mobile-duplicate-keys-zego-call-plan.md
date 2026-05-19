# Mobile Duplicate Message Keys + Zego Call Init Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix duplicate message keys in mobile chat and initialize Zego call kit on user login.

**Architecture:** Two independent fixes in a single file (`ChatContext.tsx`). Issue 1 adds dedup guards to `sendMessage` and `retrySendMessage` fallback paths. Issue 2 adds a `useEffect` that watches `user` and `isAuthenticated` to init/uninit Zego.

**Tech Stack:** React Native, Expo, TypeScript, Zego UIKit Prebuilt Call RN

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx` | Modify | Add dedup guards in `sendMessage`/`retrySendMessage`, add Zego init `useEffect` |

All changes are in one file. Two independent sections that can be applied separately.

---

### Task 1: Fix duplicate message keys in `sendMessage`

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx:1266-1284`

- [ ] **Step 1: Add dedup guard to `sendMessage` fallback branch**

In `ChatContext.tsx`, find the `sendMessage` function's `setCurrentMessages` fallback (around line 1283). Replace the current fallback block:

```typescript
          return [...prev, messageWithStatus];
```

With:

```typescript
          const alreadyExists = prev.some((m) => m.id === newMsg.id);
          if (alreadyExists) {
            return prev.map((m) =>
              m.id === newMsg.id ? messageWithStatus : m,
            );
          }
          return [...prev, messageWithStatus];
```

The full `setCurrentMessages` block in `sendMessage` should now look like:

```typescript
        setCurrentMessages((prev) => {
          const indexByTemp = prev.findIndex(
            (m) => m.id === tempId || m.tempId === tempId,
          );
          if (indexByTemp !== -1) {
            return prev.map((m) =>
              m.id === tempId || m.tempId === tempId ? messageWithStatus : m,
            );
          }

          const indexById = prev.findIndex((m) => m.id === newMsg.id);
          if (indexById !== -1) {
            return prev.map((m) =>
              m.id === newMsg.id ? messageWithStatus : m,
            );
          }

          const alreadyExists = prev.some((m) => m.id === newMsg.id);
          if (alreadyExists) {
            return prev.map((m) =>
              m.id === newMsg.id ? messageWithStatus : m,
            );
          }
          return [...prev, messageWithStatus];
        });
```

- [ ] **Step 2: Verify the change**

Open `ChatContext.tsx` and confirm the `sendMessage` `setCurrentMessages` block matches the code above. No other code in this step.

---

### Task 2: Fix duplicate message keys in `retrySendMessage`

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx:1390-1408`

- [ ] **Step 1: Add dedup guard to `retrySendMessage` fallback branch**

In `ChatContext.tsx`, find the `retrySendMessage` function's `setCurrentMessages` fallback (around line 1407). Replace the current fallback block:

```typescript
          return [...prev, messageWithStatus];
```

With:

```typescript
          const alreadyExists = prev.some((m) => m.id === newMsg.id);
          if (alreadyExists) {
            return prev.map((m) =>
              m.id === newMsg.id ? messageWithStatus : m,
            );
          }
          return [...prev, messageWithStatus];
```

The full `setCurrentMessages` block in `retrySendMessage` should now look like:

```typescript
        setCurrentMessages((prev) => {
          const indexByTemp = prev.findIndex(
            (m) => m.id === tempId || m.tempId === tempId,
          );
          if (indexByTemp !== -1) {
            return prev.map((m) =>
              m.id === tempId || m.tempId === tempId ? messageWithStatus : m,
            );
          }

          const indexById = prev.findIndex((m) => m.id === newMsg.id);
          if (indexById !== -1) {
            return prev.map((m) =>
              m.id === newMsg.id ? messageWithStatus : m,
            );
          }

          const alreadyExists = prev.some((m) => m.id === newMsg.id);
          if (alreadyExists) {
            return prev.map((m) =>
              m.id === newMsg.id ? messageWithStatus : m,
            );
          }
          return [...prev, messageWithStatus];
        });
```

- [ ] **Step 2: Verify the change**

Open `ChatContext.tsx` and confirm the `retrySendMessage` `setCurrentMessages` block matches the code above.

---

### Task 3: Add Zego call init via `useEffect`

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx:1-17` (imports)
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx:138-141` (after existing useEffect blocks)

- [ ] **Step 1: Add Zego imports**

At the top of `ChatContext.tsx`, add a new import line after the existing imports (after line 16):

```typescript
import {
  initZegoCallKit,
  uninitZegoCallKit,
  isZegoRuntimeAvailable,
} from "../services/zegoCallKit";
```

The import section at the top should now include:

```typescript
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";
import type { Attachment, Message, Conversation } from "../types";
import { chatService } from "../services/chat.service";
import { chatSocketService } from "../services/socket.service";
import type { TypingPayload } from "../services/socket.service";
import { callService, type CallSession } from "../services/call.service";
import { useAuth } from "../../auth/context/AuthContext";
import { authService } from "../../auth/services/auth.service";
import {
  initZegoCallKit,
  uninitZegoCallKit,
  isZegoRuntimeAvailable,
} from "../services/zegoCallKit";
```

- [ ] **Step 2: Add Zego init `useEffect`**

After the existing `useEffect` blocks that set refs (around line 140, after the `appStateRef` useEffect), add this new `useEffect`:

```typescript
  // ─── Zego CallKit init/uninit on user change ───
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

Place it right after this block:

```typescript
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);
```

So the sequence of useEffects at the top of ChatProvider becomes:
1. `currentConversationRef` sync
2. `userIdRef` sync
3. `appStateRef` sync
4. **NEW:** Zego init/uninit

- [ ] **Step 3: Verify imports and useEffect**

Open `ChatContext.tsx` and confirm:
1. The Zego imports are present at the top
2. The Zego `useEffect` is present after the ref-sync useEffects
3. No TypeScript errors (the `User` type is already imported via `auth.service` and `useAuth` returns it)

---

### Task 4: Final verification

**Files:**
- `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx`

- [ ] **Step 1: Check TypeScript compilation**

Run from the mobile app directory:

```bash
cd ConnectionAppMobile/AppChatMobile
npx tsc --noEmit
```

Expected: No new errors related to the changes. Pre-existing errors may exist but there should be no new ones about `initZegoCallKit`, `uninitZegoCallKit`, `isZegoRuntimeAvailable`, or the dedup logic.

- [ ] **Step 2: Verify all changes are correct**

Review the final `ChatContext.tsx`:
1. `sendMessage` has the `alreadyExists` dedup guard before the fallback append
2. `retrySendMessage` has the same `alreadyExists` dedup guard
3. Zego imports are at the top
4. Zego `useEffect` watches `[user?.id, isAuthenticated]` and calls init/uninit appropriately
