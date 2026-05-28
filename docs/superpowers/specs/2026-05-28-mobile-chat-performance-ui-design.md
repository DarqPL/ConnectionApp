# Mobile Chat Performance & UI Redesign Spec

**Date:** 2026-05-28
**Scope:** ConnectionAppMobile - ChatInput component + ChatRoomScreen performance

---

## Purpose

Fix slow mobile chat UX and redesign the chat input bar to be more compact by moving secondary functions into a dropdown menu.

---

## Problem Statement

1. **Performance:** Mobile chat is noticeably slow compared to web. ChatInput re-renders unnecessarily, FlatList callbacks break memoization.
2. **UI:** Chat input bar has too many inline buttons (image, attach, emoji, poll, reminder, AI, mic/send), making the text input field too narrow.

---

## Design

### 1. ChatInput UI Layout

**New button arrangement (left to right):**

```
[📷] [😊] [⬆️] [  Soạn tin nhắn...  ] [📤]
```

| Button | Location | Action |
|--------|----------|--------|
| Image (📷) | Outside bar | Pick images from library |
| Emoji (😊) | Outside bar | Open emoji picker |
| Expand (⬆️) | Outside bar | Toggle dropdown, dismiss keyboard |
| Send (📤) | Outside bar | Send message (or mic icon when empty) |
| Attach (📎) | Inside dropdown | Pick documents/files |
| Poll (📊) | Inside dropdown | Open poll creator |
| Reminder (⏰) | Inside dropdown | Open reminder creator |
| AI (✨) | Inside dropdown | Open AI rewrite menu |

**Dropdown behavior:**
- Renders as a conditional view above the input bar (not a Modal)
- Grid layout 2x2 with icon + label for each function
- Expand button icon rotates: ⬆️ (chevron-up) → ⬇️ (chevron-down)
- `Keyboard.dismiss()` called before toggling dropdown open
- Selecting any function closes the dropdown, then calls the corresponding callback
- Dropdown auto-closes when keyboard opens (handled by existing Keyboard events)

**Props unchanged** - ChatInput receives the same props. Dropdown callbacks reuse existing `onOpenPollCreator`, `onOpenReminderCreator`, and internal AI menu handler.

### 2. Performance Optimizations

#### ChatInput.tsx
- Wrap with `React.memo(ChatInput)` with custom equality check
- Convert all handlers to `useCallback`:
  - `pickImages`, `pickDocuments`, `removeFile`
  - `handleSend`, `handleOpenEmojiPicker`, `openAiMenu`
  - `handleTextChange`, `runAiRewrite`, `handleSuggestionSelect`
  - `appendFiles` (inner function, stabilize via useCallback)

#### ChatRoomScreen.tsx
- Extract `renderItem` into a stable `useCallback`:
  ```ts
  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble ... callbacks ... />
  ), [highlightedMsgId, conversationId, currentParticipants, ...stable deps]);
  ```
- FlatList tuning:
  - `windowSize`: 10 → 7
  - `initialNumToRender`: 20 → 15
  - Keep `removeClippedSubviews`, `maxToRenderPerBatch: 12`
  - Add `updateCellsBatchingPeriod: 80`

#### MessageBubble.tsx
- Already has `React.memo` ✓
- Will benefit from stable callbacks after ChatRoomScreen fix

#### ChatContext.tsx
- No changes needed - already uses refs correctly for socket handlers

### 3. Data Flow

```
User taps ⬆️
  → Keyboard.dismiss()
  → isExpanded = !isExpanded
  → Dropdown renders above input bar (conditional, no Modal)

User taps "Attach" in dropdown
  → isExpanded = false
  → pickDocuments() called (existing logic)

User taps "Poll"
  → isExpanded = false
  → onOpenPollCreator?.() called (existing logic)

User taps "Reminder"
  → isExpanded = false
  → onOpenReminderCreator?.() called (existing logic)

User taps "AI"
  → isExpanded = false
  → openAiMenu() called (existing Modal logic)
```

### 4. Error Handling

No new error handling. Existing Alert-based error handling for:
- File size limits
- AI rewrite failures
- Poll/reminder creation errors
All remain unchanged.

---

## Files Changed

| File | Changes |
|------|---------|
| `ChatInput.tsx` | UI redesign, dropdown, React.memo, useCallback handlers |
| `ChatRoomScreen.tsx` | Stable renderItem callback, FlatList tuning |
| `MessageBubble.tsx` | No changes (already memo'd) |
| `ChatContext.tsx` | No changes |

---

## Testing

Manual testing on Android device:
1. Chat input bar shows 5 items: image, emoji, expand arrow, text input, send
2. Dropdown opens/closes correctly with keyboard dismissal
3. All 4 dropdown functions work (attach, poll, reminder, AI)
4. Message list scrolls smoothly with 100+ messages
5. No visible re-render flicker when typing or receiving messages

---

## Risks

- **Low:** React.memo may prevent needed re-renders if props change unexpectedly. Mitigated by careful dependency review.
- **Low:** Dropdown conditional render may cause layout shift. Mitigated by fixed height dropdown view.
