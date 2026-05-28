# Mobile Chat Performance & UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign chat input bar with dropdown for secondary functions and optimize React Native rendering performance.

**Architecture:** ChatInput gets React.memo + useCallback handlers + dropdown UI. ChatRoomScreen gets stable renderItem callback + FlatList tuning. No changes to MessageBubble or ChatContext.

**Tech Stack:** React Native 0.81, Expo 54, TypeScript, React.memo, useCallback

---

### Task 1: Stabilize ChatInput handlers with useCallback

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/components/ChatInput.tsx`

- [ ] **Step 1: Add useCallback import and convert handlers**

Change the import line from:
```ts
import React, { useState, useRef, useEffect } from "react";
```
to:
```ts
import React, { useState, useRef, useEffect, useCallback } from "react";
```

Wrap the following functions with `useCallback`. Each one needs appropriate dependencies:

```ts
// appendFiles - depends on nothing (uses functional setState)
const appendFiles = useCallback((incoming: LocalAttachment[]) => {
    if (incoming.length === 0) return;

    setSelectedFiles((prev) => {
      const available = MAX_FILES - prev.length;
      if (available <= 0) {
        Alert.alert("Thông báo", `Bạn chỉ có thể gửi tối đa ${MAX_FILES} tệp.`);
        return prev;
      }

      const acceptedBySize: LocalAttachment[] = [];
      let rejectedBySize = 0;

      incoming.slice(0, available).forEach((item) => {
        if (item.size && item.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
          rejectedBySize += 1;
          return;
        }
        acceptedBySize.push(item);
      });

      if (incoming.length > available) {
        Alert.alert(
          "Thông báo",
          `Chỉ nhận ${available} tệp do giới hạn ${MAX_FILES} tệp.`,
        );
      }

      if (rejectedBySize > 0) {
        Alert.alert(
          "Dung lượng vượt quá",
          `${rejectedBySize} tệp lớn hơn ${MAX_UPLOAD_FILE_SIZE_LABEL} và đã bị bỏ qua.`,
        );
      }

      return [...prev, ...acceptedBySize];
    });
}, []);

// removeFile - depends on isSending
const removeFile = useCallback((id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
}, []);

// handleOpenEmojiPicker - no deps
const handleOpenEmojiPicker = useCallback(() => {
    Keyboard.dismiss();
    setIsEmojiPickerOpen(true);
}, []);

// openAiMenu - no deps
const openAiMenu = useCallback(() => {
    Keyboard.dismiss();
    setIsAiActionModalOpen(true);
}, []);

// handleSuggestionSelect - no deps
const handleSuggestionSelect = useCallback((suggestion: string) => {
    applyAiDraft(suggestion);
    setIsSuggestionModalOpen(false);
    setAiSuggestions([]);
}, []);
```

For `pickImages` and `pickDocuments`, wrap with `useCallback` and dependency `[appendFiles]`:

```ts
const pickImages = useCallback(async () => {
    Keyboard.dismiss();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_FILES,
      quality: 1,
    });

    if (result.canceled) return;

    appendFiles(
      result.assets.map((asset) => ({
        id: `${Date.now()}-${Math.random()}-${asset.fileName || "image"}`,
        uri: asset.uri,
        name: asset.fileName || `image-${Date.now()}.jpg`,
        mimeType: asset.mimeType,
        size: asset.fileSize,
        isImage: true,
      })),
    );
}, [appendFiles]);

const pickDocuments = useCallback(async () => {
    Keyboard.dismiss();
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: "*/*",
    });

    if (result.canceled) return;

    appendFiles(
      result.assets.map((asset) => ({
        id: `${Date.now()}-${Math.random()}-${asset.name}`,
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        isImage: (asset.mimeType ?? "").startsWith("image/"),
      })),
    );
}, [appendFiles]);
```

For `handleTextChange` - depends on `text`, `conversationId`, `notifyTyping`, `notifyStoppedTyping`:

```ts
const handleTextChange = useCallback((newText: string) => {
    setText(newText);

    if (newText.trim().length > 0) {
      if (!typingStateRef.current) {
        notifyTyping(conversationId);
        typingStateRef.current = true;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        notifyStoppedTyping(conversationId);
        typingStateRef.current = false;
        typingTimeoutRef.current = null;
      }, 1000);
    } else {
      if (typingStateRef.current) {
        notifyStoppedTyping(conversationId);
        typingStateRef.current = false;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
}, [conversationId, notifyTyping, notifyStoppedTyping]);
```

For `handleSend` - depends on `text`, `selectedFiles`, `isSending`, `disabled`, `conversationId`, `onSend`, `replyTo`, `onCancelReply`:

```ts
const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && selectedFiles.length === 0) || isSending || disabled)
      return;

    stopTyping(conversationId);

    const filesToSend = selectedFiles.map((file) => ({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
    }));

    setIsSending(true);
    setText("");
    setSelectedFiles([]);
    onCancelReply?.();
    try {
      await onSend(trimmed, filesToSend, replyTo?.id ?? null);

      setDeliveryState("SENT");
      if (deliveryTimeoutRef.current) {
        clearTimeout(deliveryTimeoutRef.current);
      }
      deliveryTimeoutRef.current = setTimeout(() => {
        setDeliveryState("RECEIVED");
      }, 700);
    } catch (error) {
      console.error("Error sending message:", error);
      setDeliveryState(null);
    } finally {
      setIsSending(false);
    }
}, [text, selectedFiles, isSending, disabled, conversationId, onSend, replyTo, onCancelReply]);
```

For `runAiRewrite` - depends on `text`, `conversationId`, `setIsAiProcessing`, `setAiSuggestions`, `setIsSuggestionModalOpen`, `applyAiDraft`:

```ts
const runAiRewrite = useCallback(async (
    action: AiRewriteAction,
    targetLanguage?: "EN" | "VI",
  ) => {
    const draft = text.trim();
    if (action !== "SUGGEST_REPLY" && !draft) {
      Alert.alert(
        "Thông báo",
        "Vui lòng nhập nội dung trước khi dùng AI Rewrite.",
      );
      return;
    }

    setIsAiProcessing(true);
    try {
      const result = await chatService.aiRewriteDraft({
        conversationId,
        draftContent: draft,
        action,
        targetLanguage,
      });

      if (action === "SUGGEST_REPLY") {
        const suggestions = (result.suggestions ?? [])
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3);

        if (suggestions.length === 0) {
          Alert.alert("AI Rewrite", "AI chưa tạo được gợi ý trả lời.");
          return;
        }

        setAiSuggestions(suggestions);
        setIsSuggestionModalOpen(true);
        return;
      }

      const rewritten = result.rewrittenText?.trim();
      if (!rewritten) {
        Alert.alert("AI Rewrite", "AI Rewrite trả về dữ liệu không hợp lệ.");
        return;
      }

      applyAiDraft(rewritten);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể xử lý AI Rewrite.";
      Alert.alert("AI Rewrite", message);
    } finally {
      setIsAiProcessing(false);
    }
}, [text, conversationId]);
```

Note: `applyAiDraft` calls `handleTextChange` which is now a useCallback. Move `applyAiDraft` definition before `runAiRewrite`:

```ts
const applyAiDraft = useCallback((nextDraft: string) => {
    handleTextChange(nextDraft);
}, [handleTextChange]);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd ConnectionAppMobile/AppChatMobile && npx tsc --noEmit`
Expected: No new errors (existing errors OK)

- [ ] **Step 3: Commit**

```bash
git add ConnectionAppMobile/AppChatMobile/src/features/chat/components/ChatInput.tsx
git commit -m "perf: stabilize ChatInput handlers with useCallback"
```

---

### Task 2: Add dropdown state and toggle handler to ChatInput

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/components/ChatInput.tsx`

- [ ] **Step 1: Add isExpanded state and toggle handler**

After the existing state declarations (around line 111), add:

```ts
const [isExpanded, setIsExpanded] = useState(false);
```

Add the toggle handler (useCallback, no deps):

```ts
const toggleExpand = useCallback(() => {
    Keyboard.dismiss();
    setIsExpanded((prev) => !prev);
}, []);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd ConnectionAppMobile/AppChatMobile && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add ConnectionAppMobile/AppChatMobile/src/features/chat/components/ChatInput.tsx
git commit -m "feat: add dropdown expand state to ChatInput"
```

---

### Task 3: Redesign ChatInput UI - button layout + dropdown view

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/components/ChatInput.tsx`

- [ ] **Step 1: Replace the main container JSX (lines 480-585)**

Replace the `<View style={styles.container}>` block that currently has all inline buttons with this new layout:

```tsx
<View style={styles.container}>
  <TouchableOpacity
    style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
    onPress={pickImages}
    disabled={!canSendMessage}
  >
    <Ionicons name="image-outline" size={24} color={canSendMessage ? COLORS.textMuted : COLORS.textLight} />
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
    onPress={handleOpenEmojiPicker}
    disabled={!canSendMessage}
  >
    <Ionicons name="happy-outline" size={24} color={canSendMessage ? COLORS.textMuted : COLORS.textLight} />
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.iconBtn, !canSendMessage && styles.iconBtnDisabled]}
    onPress={toggleExpand}
    disabled={!canSendMessage}
  >
    <Ionicons
      name={isExpanded ? "chevron-down" : "chevron-up"}
      size={24}
      color={canSendMessage ? COLORS.textMuted : COLORS.textLight}
    />
  </TouchableOpacity>

  <View style={styles.inputWrap}>
    <TextInput
      value={text}
      onChangeText={handleTextChange}
      placeholder="Soạn tin nhắn..."
      placeholderTextColor={COLORS.textLight}
      style={styles.input}
      editable={!isSending && !disabled}
      multiline
      maxLength={1000}
      returnKeyType="default"
      textAlignVertical="center"
    />
  </View>

  {canSend ? (
    <TouchableOpacity
      style={styles.sendBtn}
      onPress={handleSend}
      disabled={!canSend}
    >
      {isSending ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="send" size={18} color="#fff" />
      )}
    </TouchableOpacity>
  ) : (
    <TouchableOpacity style={styles.iconBtn}>
      <Ionicons name="mic-outline" size={24} color={COLORS.textMuted} />
    </TouchableOpacity>
  )}
</View>
```

- [ ] **Step 2: Add dropdown view JSX**

Insert the dropdown view between the `selectedFiles` preview row and the main container. After the `</ScrollView>` closing tag for `previewRow` (around line 478), add:

```tsx
{isExpanded && canSendMessage && (
  <View style={styles.dropdown}>
    <View style={styles.dropdownGrid}>
      <TouchableOpacity
        style={styles.dropdownItem}
        onPress={() => {
          setIsExpanded(false);
          pickDocuments();
        }}
      >
        <Ionicons name="attach-outline" size={22} color={COLORS.textMuted} />
        <Text style={styles.dropdownItemLabel}>Tệp</Text>
      </TouchableOpacity>

      {onOpenPollCreator && (
        <TouchableOpacity
          style={styles.dropdownItem}
          onPress={() => {
            setIsExpanded(false);
            onOpenPollCreator();
          }}
        >
          <Ionicons name="stats-chart-outline" size={22} color={COLORS.textMuted} />
          <Text style={styles.dropdownItemLabel}>Bình chọn</Text>
        </TouchableOpacity>
      )}

      {onOpenReminderCreator && (
        <TouchableOpacity
          style={styles.dropdownItem}
          onPress={() => {
            setIsExpanded(false);
            onOpenReminderCreator();
          }}
        >
          <Ionicons name="alarm-outline" size={22} color={COLORS.textMuted} />
          <Text style={styles.dropdownItemLabel}>Nhắc hẹn</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.dropdownItem}
        onPress={() => {
          setIsExpanded(false);
          openAiMenu();
        }}
      >
        <Ionicons name="sparkles-outline" size={22} color={COLORS.textMuted} />
        <Text style={styles.dropdownItemLabel}>AI Rewrite</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

- [ ] **Step 3: Add dropdown styles**

Add these styles to the `StyleSheet.create` block:

```ts
dropdown: {
  paddingHorizontal: 8,
  paddingTop: 4,
  paddingBottom: 8,
},
dropdownGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 4,
  backgroundColor: COLORS.backgroundMuted,
  borderRadius: 12,
  padding: 8,
},
dropdownItem: {
  width: "48%",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  paddingVertical: 10,
  paddingHorizontal: 8,
  borderRadius: 8,
  backgroundColor: "#fff",
},
dropdownItemLabel: {
  fontSize: 13,
  color: COLORS.text,
  fontWeight: "500",
},
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd ConnectionAppMobile/AppChatMobile && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add ConnectionAppMobile/AppChatMobile/src/features/chat/components/ChatInput.tsx
git commit -m "feat: redesign ChatInput UI with dropdown for secondary functions"
```

---

### Task 4: Wrap ChatInput with React.memo

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/components/ChatInput.tsx`

- [ ] **Step 1: Add custom equality function and React.memo wrapper**

At the bottom of the file, change the export line from:
```ts
export default ChatInput;
```

to:

```ts
const chatInputPropsEqual = (
  prev: ChatInputProps,
  next: ChatInputProps,
): boolean => {
  return (
    prev.conversationId === next.conversationId &&
    prev.disabled === next.disabled &&
    prev.replyTo === next.replyTo &&
    prev.allowMemberSendMessage === next.allowMemberSendMessage &&
    prev.currentUserRole === next.currentUserRole &&
    prev.isGroup === next.isGroup &&
    prev.onSend === next.onSend &&
    prev.onCancelReply === next.onCancelReply &&
    prev.onOpenPollCreator === next.onOpenPollCreator &&
    prev.onOpenReminderCreator === next.onOpenReminderCreator
  );
};

export default React.memo(ChatInput, chatInputPropsEqual);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd ConnectionAppMobile/AppChatMobile && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add ConnectionAppMobile/AppChatMobile/src/features/chat/components/ChatInput.tsx
git commit -m "perf: wrap ChatInput with React.memo and custom equality check"
```

---

### Task 5: Stabilize ChatRoomScreen renderItem callback + FlatList tuning

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/screens/ChatRoomScreen.tsx`

- [ ] **Step 1: Extract renderItem into a useCallback**

Find the FlatList `renderItem` prop (around line 1294). Replace the inline arrow function with a useCallback defined before the return statement. Add this after the `handleScrollToBottomPress` function (around line 716):

```ts
const renderItem = useCallback(
  ({ item }: { item: Message }) => (
    <MessageBubble
      message={item.content || ""}
      attachments={item.attachments || []}
      poll={item.poll}
      reminder={item.reminder}
      messageId={item.id}
      status={item.status}
      onRetrySend={() =>
        retrySendMessage(conversationId, item.tempId ?? item.id).catch(
          (err) => {
            Alert.alert(
              "Lỗi",
              err instanceof Error ? err.message : "Không thể gửi lại tin nhắn",
            );
          },
        )
      }
      reactions={item.reactions || []}
      currentUserId={user?.id}
      onReact={(reactionCode) => {
        reactMessage(conversationId, item.id, reactionCode).catch((err) => {
          Alert.alert(
            "Lỗi",
            err instanceof Error ? err.message : "Không thể thả cảm xúc",
          );
        });
      }}
      isMe={item.senderInfo?.senderId === user?.id}
      senderName={item.senderInfo?.displayName}
      avatarUrl={item.senderInfo?.avatarUrl}
      createdAt={item.createdAt}
      recalledAt={item.recalledAt}
      replyInfo={item.replyInfo}
      isGroup={isGroup}
      participants={currentParticipants}
      markAdminMessages={currentConversation?.markAdminMessages}
      senderRole={
        currentParticipants?.find(
          (p: Participant) => p.userId === item.senderInfo?.senderId,
        )?.role
      }
      onLongPress={() => handleMessageLongPress(item)}
      onReplyPreviewPress={
        item.replyInfo?.parentId
          ? () => handleScrollToParent(item.replyInfo.parentId)
          : undefined
      }
      onPollVote={() => setPollToVote(item)}
      onReminderEdit={() => setReminderToEdit(item)}
      isHighlighted={item.id === highlightedMsgId}
    />
  ),
  [
    conversationId,
    retrySendMessage,
    reactMessage,
    user?.id,
    isGroup,
    currentParticipants,
    currentConversation?.markAdminMessages,
    handleMessageLongPress,
    handleScrollToParent,
    highlightedMsgId,
  ],
);
```

- [ ] **Step 2: Update FlatList to use the stable renderItem**

Change the FlatList `renderItem` prop from inline function to:
```tsx
renderItem={renderItem}
```

- [ ] **Step 3: Tune FlatList props**

Change these FlatList props:
- `windowSize={10}` → `windowSize={7}`
- `initialNumToRender={20}` → `initialNumToRender={15}`
- Add: `updateCellsBatchingPeriod={80}`

The FlatList props should look like:
```tsx
<FlatList
  ref={flatListRef}
  data={displayMessages}
  keyExtractor={(item) => item.id}
  windowSize={7}
  initialNumToRender={15}
  maxToRenderPerBatch={12}
  updateCellsBatchingPeriod={80}
  removeClippedSubviews
  renderItem={renderItem}
  extraData={highlightedMsgId}
  ...
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd ConnectionAppMobile/AppChatMobile && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add ConnectionAppMobile/AppChatMobile/src/features/chat/screens/ChatRoomScreen.tsx
git commit -m "perf: stabilize FlatList renderItem and tune rendering params"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Start Metro bundler**

Run: `cd ConnectionAppMobile/AppChatMobile && npm start`
Expected: Metro starts without errors

- [ ] **Step 2: Verify UI changes on device**

Check:
1. Chat input bar shows: [📷] [😊] [⬆️] [input] [📤]
2. Tapping ⬆️ dismisses keyboard and shows dropdown with 4 items
3. Tapping ⬇️ closes dropdown
4. Each dropdown item works: Tệp opens file picker, Bình chọn opens poll, etc.
5. Dropdown closes after selecting any function

- [ ] **Step 3: Verify performance**

Check:
1. Scroll through 100+ message chat - should be smooth
2. Type messages - no visible lag or re-render flicker
3. Receive messages while typing - no stutter

- [ ] **Step 4: Final commit if any tweaks needed**

```bash
git add -A
git commit -m "fix: address manual testing feedback"
```
