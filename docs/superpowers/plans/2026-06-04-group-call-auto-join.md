# Group Call Auto-Join Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement auto-start group calls with "Join" UX, persistent call until last leaver, ghost call prevention, and ChatListScreen active call indicator across backend, web, and mobile.

**Architecture:** Approach A — add `WAITING` participant status, differentiate group/private via `Conversation.getType()`, auto-start group calls as ONGOING, end only when last JOINED leaves, handle disconnects via `SessionDisconnectEvent`.

**Tech Stack:** Spring Boot 3.5 (Java 21), React 19 + Zustand (Web), Expo 54 + React Native 0.81 (Mobile), WebSocket STOMP, Zego Cloud

---

## File Structure

### Backend (ConnectionAppBackend)
| File | Responsibility |
|------|---------------|
| `domain/common/CallParticipantStatus.java` | Add `WAITING` enum value |
| `domain/dto/CallSessionResponse.java` | Add `isGroupCall` field (computed) |
| `domain/dto/ConversationResponse.java` | Add `hasActiveCall`, `activeCallId` fields |
| `repo/CallSessionRepository.java` | Add `findActiveByConversationIdOnly` query |
| `service/CallService.java` | Core logic: startCall, acceptCall, endCall branching, disconnect handler |
| `service/CallTimeoutScheduler.java` | No changes needed (already skips group calls implicitly) |
| `controller/CallController.java` | Add `GET /api/calls/conversation/{convId}/active` endpoint |
| `controller/ChatRealtimeController.java` | No changes |
| `config/WebSocketConfig.java` | Add `SessionDisconnectEvent` handler bean |
| `service/ConversationService.java` | Populate `hasActiveCall`/`activeCallId` in conversation response |

### Web Frontend (ConnectionAppWeb)
| File | Responsibility |
|------|---------------|
| `src/types/call.ts` | Add `WAITING` to status, `isGroupCall` to CallSession |
| `src/stores/useCallStore.ts` | Add `groupCallActive`, `joinGroupCall`, `fetchActiveCall` |
| `src/services/callService.ts` | Add `getActiveCallByConversation` method |
| `src/components/chat/CallOverlay.tsx` | Add group call "Join" banner, fetch on mount |
| `src/components/chat/ZegoCallRoom.tsx` | No changes (already handles VideoConference) |
| `src/stores/useSocketStore.ts` | Subscribe `/topic/conversation.{convId}/call-participants` |
| `src/components/chat/ChatWindowLayout.tsx` | Pass `conversationType` to CallOverlay |
| `src/components/chat/ConversationList.tsx` or sidebar | Show active call icon |

### Mobile Frontend (ConnectionAppMobile/AppChatMobile)
| File | Responsibility |
|------|---------------|
| `src/features/chat/services/call.service.ts` | Add `getActiveCallByConversation` method |
| `src/features/chat/context/ChatContext.tsx` | Add `groupCallActive`, `joinGroupCall`, AppState sync |
| `src/features/chat/screens/ChatRoomScreen.tsx` | Add "Join" banner, fetch on mount |
| `src/features/chat/screens/ChatListScreen.tsx` | Show active call indicator in list items |

---

## Task 1: Backend — Add WAITING enum and DTO changes

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/common/CallParticipantStatus.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallSessionResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ConversationResponse.java`

- [ ] **Step 1: Add WAITING to CallParticipantStatus**

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/common/CallParticipantStatus.java
package iuh.fit.ConnectionAppBackend.domain.common;

public enum CallParticipantStatus {
    RINGING,
    JOINED,
    DECLINED,
    LEFT,
    MISSED,
    WAITING  // Group call members who haven't joined yet
}
```

- [ ] **Step 2: Add isGroupCall to CallSessionResponse**

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallSessionResponse.java
// Add this field after `participants`:
private Boolean isGroupCall;
```

- [ ] **Step 3: Add hasActiveCall and activeCallId to ConversationResponse**

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ConversationResponse.java
// Add these fields:
private Boolean hasActiveCall;
private Long activeCallId;
```

- [ ] **Step 4: Commit**

```bash
cd ConnectionAppBackend
git add src/main/java/iuh/fit/ConnectionAppBackend/domain/common/CallParticipantStatus.java
git add src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallSessionResponse.java
git add src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ConversationResponse.java
git commit -m "feat(call): add WAITING status and DTO fields for group call"
```

---

## Task 2: Backend — Repository query for active call by conversation

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/repo/CallSessionRepository.java`

- [ ] **Step 1: Add optimized queries to CallSessionRepository**

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/repo/CallSessionRepository.java
// Add these two methods:

// Query 1: For disconnect handler — finds ongoing group calls where user is JOINED
@Query("SELECT DISTINCT cs FROM CallSession cs " +
        "JOIN FETCH cs.participants cp " +
        "JOIN FETCH cp.user u " +
        "JOIN FETCH cs.conversation c " +
        "WHERE u.username = :username " +
        "AND cs.status = :status " +
        "AND c.type = :type " +
        "AND cp.status = :participantStatus")
List<CallSession> findOngoingGroupCallsByUsername(
        @Param("username") String username,
        @Param("status") CallStatus status,
        @Param("type") ConversationType type,
        @Param("participantStatus") CallParticipantStatus participantStatus);

// Query 2: For GET /api/calls/conversation/{convId}/active endpoint
@Query("SELECT cs FROM CallSession cs " +
        "WHERE cs.conversation.id = :conversationId " +
        "AND cs.status = :status " +
        "ORDER BY cs.createdAt DESC")
Optional<CallSession> findActiveByConversationIdAndStatus(
        @Param("conversationId") Long conversationId,
        @Param("status") CallStatus status);
```

Query 1 improvements:
- `JOIN FETCH` loads participants + user + conversation in single query — no N+1
- Type-safe enum params instead of hardcoded strings
- `DISTINCT` prevents duplicate rows from JOIN
- Direct indexed query, O(1) regardless of database size

- [ ] **Step 2: Commit**

```bash
cd ConnectionAppBackend
git add src/main/java/iuh/fit/ConnectionAppBackend/repo/CallSessionRepository.java
git commit -m "feat(call): add repository query for active call by conversation"
```

---

## Task 3: Backend — CallService core logic changes

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/CallService.java`

This is the largest task. We modify `startCall`, `acceptCall`, `rejectCall`, `endCall`, `toCallSessionResponse`, and add disconnect handler.

- [ ] **Step 1: Modify `startCall` method**

Replace the `startCall` method (lines 99-175) with:

```java
@Transactional
public CallSessionResponse startCall(String username, CallStartRequest request) {
    if (request == null || request.getConversationId() == null) {
        throw new BadRequestException("conversationId is required");
    }

    User caller = requireUser(username);
    Long conversationId = request.getConversationId();

    Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

    if (!conversationUserRepository.isMember(conversationId, caller.getId())) {
        throw new UnauthorizedException("User is not a member of this conversation");
    }

    boolean isGroupCall = conversation.getType() == ConversationType.GROUP;

    // Check for existing active call
    List<CallSession> existingActiveCalls = callSessionRepository.findActiveByConversationId(
            conversationId,
            ACTIVE_CALL_STATUSES,
            PageRequest.of(0, 1)
    );

    if (!existingActiveCalls.isEmpty()) {
        CallSession existingCall = existingActiveCalls.get(0);
        List<CallParticipant> existingParticipants = callParticipantRepository.findByCallIdWithUser(existingCall.getId());

        reconcileExistingActiveCall(existingCall, existingParticipants);

        if (ACTIVE_CALL_STATUSES.contains(existingCall.getStatus())) {
            return toCallSessionResponse(existingCall, existingParticipants, caller.getId(), true);
        }
    }

    validatePrivateConversationBlock(conversation, caller.getId());

    List<ConversationUser> members = conversationUserRepository.findByConversationId(conversationId);
    if (members.size() < 2) {
        throw new BadRequestException("Cannot start a call without at least 2 participants");
    }

    Instant now = Instant.now();
    CallStatus initialStatus = isGroupCall ? CallStatus.ONGOING : CallStatus.RINGING;

    CallSession callSession = CallSession.builder()
            .conversation(conversation)
            .initiatedBy(caller)
            .mediaType(parseMediaType(request.getMediaType()))
            .status(initialStatus)
            .zegoRoomId(generateRoomId(conversationId))
            .createdAt(now)
            .build();

    CallSession savedSession = callSessionRepository.save(callSession);

    List<CallParticipant> participants = new ArrayList<>();
    for (ConversationUser member : members) {
        Long memberId = member.getUser().getId();
        boolean isCaller = Objects.equals(memberId, caller.getId());

        CallParticipantStatus initialParticipantStatus;
        Instant initialJoinedAt;
        if (isCaller) {
            initialParticipantStatus = CallParticipantStatus.JOINED;
            initialJoinedAt = now;
        } else if (isGroupCall) {
            initialParticipantStatus = CallParticipantStatus.WAITING;
            initialJoinedAt = null;
        } else {
            initialParticipantStatus = CallParticipantStatus.RINGING;
            initialJoinedAt = null;
        }

        CallParticipant participant = CallParticipant.builder()
                .callSession(savedSession)
                .user(member.getUser())
                .status(initialParticipantStatus)
                .audioMuted(false)
                .videoMuted(false)
                .joinedAt(initialJoinedAt)
                .leftAt(null)
                .build();
        participants.add(participant);
    }

    callParticipantRepository.saveAll(participants);

    // For group calls, don't send invite (no ringing)
    if (!isGroupCall) {
        publishInviteEvents(savedSession, participants);
    }
    publishStatusEvents(savedSession, participants);
    publishConversationParticipantState(savedSession, participants);

    return toCallSessionResponse(savedSession, participants, caller.getId(), true);
}
```

- [ ] **Step 2: Modify `acceptCall` method**

Replace the `acceptCall` method (lines 196-227) with:

```java
@Transactional
public CallSessionResponse acceptCall(String username, Long callId) {
    User user = requireUser(username);
    CallSession callSession = getRequiredCallSession(callId);
    Conversation conversation = callSession.getConversation();
    boolean isGroupCall = conversation.getType() == ConversationType.GROUP;

    CallParticipant participant = callParticipantRepository
            .findByCallSessionIdAndUserId(callId, user.getId())
            .orElse(null);

    // Upsert: if participant doesn't exist (new member added during call), create one
    if (participant == null) {
        if (!isGroupCall) {
            throw new UnauthorizedException("User is not a participant of this call");
        }
        if (!conversationUserRepository.isMember(conversation.getId(), user.getId())) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }
        if (callSession.getStatus() != CallStatus.ONGOING) {
            throw new BadRequestException("Call is no longer active");
        }

        participant = CallParticipant.builder()
                .callSession(callSession)
                .user(user)
                .status(CallParticipantStatus.JOINED)
                .audioMuted(false)
                .videoMuted(false)
                .joinedAt(Instant.now())
                .leftAt(null)
                .build();
        callParticipantRepository.save(participant);

        List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);
        publishStatusEvents(callSession, participants);
        publishConversationParticipantState(callSession, participants);
        return toCallSessionResponse(callSession, participants, user.getId(), true);
    }

    // Existing participant logic
    if (participant.getStatus() == CallParticipantStatus.DECLINED || participant.getStatus() == CallParticipantStatus.LEFT) {
        throw new BadRequestException("This participant state cannot be accepted");
    }

    if (participant.getStatus() != CallParticipantStatus.JOINED) {
        participant.setStatus(CallParticipantStatus.JOINED);
        participant.setJoinedAt(Instant.now());
        callParticipantRepository.save(participant);
    }

    // Only transition RINGING -> ONGOING for private calls
    if (!isGroupCall && callSession.getStatus() == CallStatus.RINGING) {
        callSession.setStatus(CallStatus.ONGOING);
        if (callSession.getStartedAt() == null) {
            callSession.setStartedAt(Instant.now());
        }
        callSessionRepository.save(callSession);
    }

    List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);
    publishStatusEvents(callSession, participants);
    publishConversationParticipantState(callSession, participants);

    return toCallSessionResponse(callSession, participants, user.getId(), true);
}
```

- [ ] **Step 3: Modify `rejectCall` method**

Replace the `rejectCall` method (lines 229-254) with:

```java
@Transactional
public CallSessionResponse rejectCall(String username, Long callId) {
    User user = requireUser(username);
    CallSession callSession = getRequiredCallSession(callId);
    Conversation conversation = callSession.getConversation();
    boolean isGroupCall = conversation.getType() == ConversationType.GROUP;

    if (isGroupCall) {
        throw new BadRequestException("Không thể từ chối cuộc gọi nhóm");
    }

    CallParticipant participant = callParticipantRepository
            .findByCallSessionIdAndUserId(callId, user.getId())
            .orElseThrow(() -> new UnauthorizedException("User is not a participant of this call"));

    if (participant.getStatus() == CallParticipantStatus.JOINED) {
        throw new BadRequestException("Joined participant cannot reject call");
    }

    if (participant.getStatus() != CallParticipantStatus.DECLINED) {
        participant.setStatus(CallParticipantStatus.DECLINED);
        participant.setLeftAt(Instant.now());
        callParticipantRepository.save(participant);
    }

    List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);
    maybeCompleteAsMissed(callSession, participants);

    publishStatusEvents(callSession, participants);
    publishConversationParticipantState(callSession, participants);

    return toCallSessionResponse(callSession, participants, user.getId(), false);
}
```

- [ ] **Step 4: Modify `endCall` method**

Replace the `endCall` method (lines 256-298) with:

```java
@Transactional
public CallSessionResponse endCall(String username, Long callId, CallActionRequest request) {
    User user = requireUser(username);
    CallSession callSession = getRequiredCallSession(callId);
    Conversation conversation = callSession.getConversation();
    boolean isGroupCall = conversation.getType() == ConversationType.GROUP;

    if (callSession.getStatus() == CallStatus.ENDED
            || callSession.getStatus() == CallStatus.MISSED
            || callSession.getStatus() == CallStatus.CANCELLED) {
        List<CallParticipant> existingParticipants = callParticipantRepository.findByCallIdWithUser(callId);
        return toCallSessionResponse(callSession, existingParticipants, user.getId(), false);
    }

    Instant now = Instant.now();
    List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);

    if (isGroupCall) {
        // Group call: only mark this participant as LEFT
        CallParticipant currentParticipant = participants.stream()
                .filter(p -> Objects.equals(p.getUser().getId(), user.getId()))
                .findFirst()
                .orElse(null);

        if (currentParticipant != null && currentParticipant.getLeftAt() == null) {
            currentParticipant.setStatus(CallParticipantStatus.LEFT);
            currentParticipant.setLeftAt(now);
            callParticipantRepository.save(currentParticipant);
        }

        // Check if any participant is still JOINED
        boolean hasJoinedParticipant = participants.stream()
                .anyMatch(p -> p.getStatus() == CallParticipantStatus.JOINED
                        && !Objects.equals(p.getUser().getId(), user.getId()));

        if (hasJoinedParticipant) {
            // Call continues
            publishConversationParticipantState(callSession, participants);
            return toCallSessionResponse(callSession, participants, user.getId(), false);
        }

        // Last participant left — end the call
        callSession.setStatus(CallStatus.ENDED);
        callSession.setEndedAt(now);
        callSession.setEndedReason(normalizeEndedReason(request == null ? null : request.getReason()));
        if (callSession.getStartedAt() != null) {
            long duration = Math.max(0, callSession.getStartedAt().until(now, ChronoUnit.SECONDS));
            callSession.setDurationSeconds(duration);
        }
        callSessionRepository.save(callSession);

        // Mark all WAITING participants as MISSED
        for (CallParticipant participant : participants) {
            if (participant.getLeftAt() != null) {
                continue;
            }
            if (participant.getStatus() == CallParticipantStatus.WAITING) {
                participant.setStatus(CallParticipantStatus.MISSED);
            }
            participant.setLeftAt(now);
        }
        callParticipantRepository.saveAll(participants);
    } else {
        // Private call: original logic
        callSession.setStatus(CallStatus.ENDED);
        callSession.setEndedAt(now);
        callSession.setEndedReason(normalizeEndedReason(request == null ? null : request.getReason()));
        if (callSession.getStartedAt() != null) {
            long duration = Math.max(0, callSession.getStartedAt().until(now, ChronoUnit.SECONDS));
            callSession.setDurationSeconds(duration);
        }
        callSessionRepository.save(callSession);

        for (CallParticipant participant : participants) {
            if (participant.getLeftAt() != null) {
                continue;
            }
            if (participant.getStatus() == CallParticipantStatus.RINGING) {
                participant.setStatus(CallParticipantStatus.MISSED);
            } else if (participant.getStatus() == CallParticipantStatus.JOINED) {
                participant.setStatus(CallParticipantStatus.LEFT);
            }
            participant.setLeftAt(now);
        }
        callParticipantRepository.saveAll(participants);
    }

    publishStatusEvents(callSession, participants);
    publishConversationParticipantState(callSession, participants);

    return toCallSessionResponse(callSession, participants, user.getId(), false);
}
```

- [ ] **Step 5: Modify `toCallSessionResponse` to include isGroupCall**

Find the `toCallSessionResponse` method (around line 559) and add `.isGroupCall(conversation.getType() == ConversationType.GROUP)`:

```java
// In toCallSessionResponse, add this line before .participants():
.isGroupCall(callSession.getConversation().getType() == ConversationType.GROUP)
```

- [ ] **Step 6: Modify `reconcileExistingActiveCall` to skip group calls**

Find `reconcileExistingActiveCall` (around line 408) and add at the start:

```java
private void reconcileExistingActiveCall(CallSession callSession, List<CallParticipant> participants) {
    if (!ACTIVE_CALL_STATUSES.contains(callSession.getStatus())) {
        return;
    }

    // Skip reconciliation for group calls (they don't have RINGING timeout)
    if (callSession.getConversation().getType() == ConversationType.GROUP) {
        return;
    }

    // ... rest of existing method unchanged
```

- [ ] **Step 7: Commit**

```bash
cd ConnectionAppBackend
git add src/main/java/iuh/fit/ConnectionAppBackend/service/CallService.java
git add src/main/java/iuh/fit/ConnectionAppBackend/repo/CallSessionRepository.java
git commit -m "feat(call): implement group call auto-start, join, and last-leaver end logic"
```

---

## Task 4: Backend — WebSocket Disconnect Handler (Ghost Call Prevention)

**Files:**
- Create: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/config/WebSocketDisconnectHandler.java`

- [ ] **Step 1: Modify WebSocketAuthInterceptor to store username in session**

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/security/WebSocketAuthInterceptor.java
// In the preSend method, after accessor.setUser(auth), add:

accessor.getSessionAttributes().put("username", username);
accessor.getSessionAttributes().put("userId", customerUserDetails.getUser().getId());
```

- [ ] **Step 2: Create disconnect handler**

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/config/WebSocketDisconnectHandler.java
package iuh.fit.ConnectionAppBackend.config;

import iuh.fit.ConnectionAppBackend.domain.common.CallParticipantStatus;
import iuh.fit.ConnectionAppBackend.domain.common.CallStatus;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallParticipant;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallSession;
import iuh.fit.ConnectionAppBackend.repo.CallParticipantRepository;
import iuh.fit.ConnectionAppBackend.repo.CallSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketDisconnectHandler {

    private final CallSessionRepository callSessionRepository;
    private final CallParticipantRepository callParticipantRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String username = (String) accessor.getSessionAttributes().get("username");
        if (username == null) {
            return;
        }

        // Optimized: Direct DB query — no findAll(), no memory overflow
        List<CallSession> activeGroupCalls = callSessionRepository
                .findOngoingGroupCallsByUsername(username, CallStatus.ONGOING, ConversationType.GROUP, CallParticipantStatus.JOINED);

        for (CallSession callSession : activeGroupCalls) {
            // Participants already loaded via JOIN FETCH
            List<CallParticipant> participants = callSession.getParticipants();
            CallParticipant currentParticipant = participants.stream()
                    .filter(p -> username.equals(p.getUser().getUsername()))
                    .findFirst()
                    .orElse(null);

            if (currentParticipant == null) {
                continue;
            }

            Instant now = Instant.now();
            currentParticipant.setStatus(CallParticipantStatus.LEFT);
            currentParticipant.setLeftAt(now);
            callParticipantRepository.save(currentParticipant);

            log.info("User {} disconnected from group call {}, marked as LEFT", username, callSession.getId());

            boolean hasJoinedParticipant = participants.stream()
                    .anyMatch(p -> p.getStatus() == CallParticipantStatus.JOINED
                            && !Objects.equals(p.getUser().getId(), currentParticipant.getUser().getId()));

            if (hasJoinedParticipant) {
                publishConversationParticipantState(callSession, participants);
                continue;
            }

            callSession.setStatus(CallStatus.ENDED);
            callSession.setEndedAt(now);
            callSession.setEndedReason("DISCONNECT");
            if (callSession.getStartedAt() != null) {
                long duration = Math.max(0, callSession.getStartedAt().until(now, ChronoUnit.SECONDS));
                callSession.setDurationSeconds(duration);
            }
            callSessionRepository.save(callSession);

            for (CallParticipant participant : participants) {
                if (participant.getLeftAt() != null) continue;
                if (participant.getStatus() == CallParticipantStatus.WAITING) {
                    participant.setStatus(CallParticipantStatus.MISSED);
                }
                participant.setLeftAt(now);
            }
            callParticipantRepository.saveAll(participants);

            log.info("Group call {} ended due to last participant disconnect", callSession.getId());
            publishStatusEvents(callSession, participants);
            publishConversationParticipantState(callSession, participants);
        }
    }

    private void publishConversationParticipantState(CallSession callSession, List<CallParticipant> participants) {
        List<Map<String, Object>> participantPayloads = participants.stream()
                .map(p -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("userId", p.getUser().getId());
                    map.put("displayName", p.getUser().getDisplayName());
                    map.put("avatarUrl", p.getUser().getAvatarUrl());
                    map.put("status", p.getStatus().name());
                    map.put("audioMuted", p.isAudioMuted());
                    map.put("videoMuted", p.isVideoMuted());
                    map.put("joinedAt", p.getJoinedAt());
                    map.put("leftAt", p.getLeftAt());
                    return map;
                })
                .toList();

        Map<String, Object> payload = new HashMap<>();
        payload.put("callId", callSession.getId());
        payload.put("conversationId", callSession.getConversation().getId());
        payload.put("status", callSession.getStatus().name());
        payload.put("participants", participantPayloads);

        messagingTemplate.convertAndSend(
                "/topic/conversation." + callSession.getConversation().getId() + "/call-participants",
                payload
        );
    }

    private void publishStatusEvents(CallSession callSession, List<CallParticipant> participants) {
        for (CallParticipant participant : participants) {
            Long userId = participant.getUser().getId();
            Map<String, Object> payload = buildCallSessionPayload(callSession, participants, userId);
            messagingTemplate.convertAndSend("/topic/user." + userId + "/call-status", payload);
        }
    }

    private Map<String, Object> buildCallSessionPayload(CallSession callSession, List<CallParticipant> participants, Long currentUserId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("callId", callSession.getId());
        payload.put("conversationId", callSession.getConversation().getId());
        payload.put("initiatedBy", callSession.getInitiatedBy().getId());
        payload.put("mediaType", callSession.getMediaType().name());
        payload.put("status", callSession.getStatus().name());
        payload.put("roomId", callSession.getZegoRoomId());
        payload.put("createdAt", callSession.getCreatedAt());
        payload.put("startedAt", callSession.getStartedAt());
        payload.put("endedAt", callSession.getEndedAt());
        payload.put("durationSeconds", callSession.getDurationSeconds());
        payload.put("endedReason", callSession.getEndedReason());
        payload.put("isGroupCall", callSession.getConversation().getType() == ConversationType.GROUP);

        List<Map<String, Object>> participantPayloads = participants.stream()
                .map(p -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("userId", p.getUser().getId());
                    map.put("displayName", p.getUser().getDisplayName());
                    map.put("avatarUrl", p.getUser().getAvatarUrl());
                    map.put("status", p.getStatus().name());
                    map.put("audioMuted", p.isAudioMuted());
                    map.put("videoMuted", p.isVideoMuted());
                    map.put("joinedAt", p.getJoinedAt());
                    map.put("leftAt", p.getLeftAt());
                    return map;
                })
                .toList();
        payload.put("participants", participantPayloads);

        return payload;
    }
}
```

Key differences from the original plan:
- Uses `findOngoingGroupCallsByUsername()` instead of `findAll().stream().filter()`
- Participants already loaded via `JOIN FETCH` — no additional `findByCallIdWithUser()` call needed
- Single DB query per disconnect event, O(1) memory regardless of database size

Wait — the existing codebase uses `WebSocketAuthInterceptor` for STOMP auth. The username is available via `SimpAttributes`. Let me check how the existing auth works first.

Actually, looking at the existing code, the disconnect handler needs to work with the user ID from the WebSocket session. The simplest approach is to store the user ID in session attributes during auth and retrieve it on disconnect. Let me revise:

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/config/WebSocketDisconnectHandler.java
package iuh.fit.ConnectionAppBackend.config;

import iuh.fit.ConnectionAppBackend.domain.common.CallParticipantStatus;
import iuh.fit.ConnectionAppBackend.domain.common.CallStatus;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallParticipant;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallSession;
import iuh.fit.ConnectionAppBackend.repo.CallParticipantRepository;
import iuh.fit.ConnectionAppBackend.repo.CallSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketDisconnectHandler {

    private final CallSessionRepository callSessionRepository;
    private final CallParticipantRepository callParticipantRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String username = (String) accessor.getSessionAttributes().get("username");
        if (username == null) {
            return;
        }

        // Find all active ONGOING calls and check if this user is JOINED
        // We need a repo method to find calls by user status
        // For now, use a broad query — in production, add a targeted index
        List<CallSession> ongoingCalls = callSessionRepository.findAll().stream()
                .filter(cs -> cs.getStatus() == CallStatus.ONGOING)
                .toList();

        for (CallSession callSession : ongoingCalls) {
            // Skip private calls
            if (callSession.getConversation().getType() != ConversationType.GROUP) {
                continue;
            }

            List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callSession.getId());
            CallParticipant currentParticipant = participants.stream()
                    .filter(p -> username.equals(p.getUser().getUsername()))
                    .findFirst()
                    .orElse(null);

            if (currentParticipant == null || currentParticipant.getStatus() != CallParticipantStatus.JOINED) {
                continue;
            }

            // User was JOINED in a group call — mark as LEFT
            Instant now = Instant.now();
            currentParticipant.setStatus(CallParticipantStatus.LEFT);
            currentParticipant.setLeftAt(now);
            callParticipantRepository.save(currentParticipant);

            log.info("User {} disconnected from group call {}, marked as LEFT", username, callSession.getId());

            // Check if any other participant is still JOINED
            boolean hasJoinedParticipant = participants.stream()
                    .anyMatch(p -> p.getStatus() == CallParticipantStatus.JOINED
                            && !Objects.equals(p.getUser().getId(), currentParticipant.getUser().getId()));

            if (hasJoinedParticipant) {
                publishConversationParticipantState(callSession, participants);
                continue;
            }

            // Last participant left — end the call
            callSession.setStatus(CallStatus.ENDED);
            callSession.setEndedAt(now);
            callSession.setEndedReason("DISCONNECT");
            if (callSession.getStartedAt() != null) {
                long duration = Math.max(0, callSession.getStartedAt().until(now, ChronoUnit.SECONDS));
                callSession.setDurationSeconds(duration);
            }
            callSessionRepository.save(callSession);

            for (CallParticipant participant : participants) {
                if (participant.getLeftAt() != null) {
                    continue;
                }
                if (participant.getStatus() == CallParticipantStatus.WAITING) {
                    participant.setStatus(CallParticipantStatus.MISSED);
                }
                participant.setLeftAt(now);
            }
            callParticipantRepository.saveAll(participants);

            log.info("Group call {} ended due to last participant disconnect", callSession.getId());
            publishStatusEvents(callSession, participants);
            publishConversationParticipantState(callSession, participants);
        }
    }

    private void publishConversationParticipantState(CallSession callSession, List<CallParticipant> participants) {
        List<Map<String, Object>> participantPayloads = participants.stream()
                .map(p -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("userId", p.getUser().getId());
                    map.put("displayName", p.getUser().getDisplayName());
                    map.put("avatarUrl", p.getUser().getAvatarUrl());
                    map.put("status", p.getStatus().name());
                    map.put("audioMuted", p.isAudioMuted());
                    map.put("videoMuted", p.isVideoMuted());
                    map.put("joinedAt", p.getJoinedAt());
                    map.put("leftAt", p.getLeftAt());
                    return map;
                })
                .toList();

        Map<String, Object> payload = new HashMap<>();
        payload.put("callId", callSession.getId());
        payload.put("conversationId", callSession.getConversation().getId());
        payload.put("status", callSession.getStatus().name());
        payload.put("participants", participantPayloads);

        messagingTemplate.convertAndSend(
                "/topic/conversation." + callSession.getConversation().getId() + "/call-participants",
                payload
        );
    }

    private void publishStatusEvents(CallSession callSession, List<CallParticipant> participants) {
        for (CallParticipant participant : participants) {
            Long userId = participant.getUser().getId();
            Map<String, Object> payload = buildCallSessionPayload(callSession, participants, userId);
            messagingTemplate.convertAndSend("/topic/user." + userId + "/call-status", payload);
        }
    }

    private Map<String, Object> buildCallSessionPayload(CallSession callSession, List<CallParticipant> participants, Long currentUserId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("callId", callSession.getId());
        payload.put("conversationId", callSession.getConversation().getId());
        payload.put("initiatedBy", callSession.getInitiatedBy().getId());
        payload.put("mediaType", callSession.getMediaType().name());
        payload.put("status", callSession.getStatus().name());
        payload.put("roomId", callSession.getZegoRoomId());
        payload.put("createdAt", callSession.getCreatedAt());
        payload.put("startedAt", callSession.getStartedAt());
        payload.put("endedAt", callSession.getEndedAt());
        payload.put("durationSeconds", callSession.getDurationSeconds());
        payload.put("endedReason", callSession.getEndedReason());
        payload.put("isGroupCall", callSession.getConversation().getType() == ConversationType.GROUP);

        List<Map<String, Object>> participantPayloads = participants.stream()
                .map(p -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("userId", p.getUser().getId());
                    map.put("displayName", p.getUser().getDisplayName());
                    map.put("avatarUrl", p.getUser().getAvatarUrl());
                    map.put("status", p.getStatus().name());
                    map.put("audioMuted", p.isAudioMuted());
                    map.put("videoMuted", p.isVideoMuted());
                    map.put("joinedAt", p.getJoinedAt());
                    map.put("leftAt", p.getLeftAt());
                    return map;
                })
                .toList();
        payload.put("participants", participantPayloads);

        return payload;
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd ConnectionAppBackend
git add src/main/java/iuh/fit/ConnectionAppBackend/config/WebSocketDisconnectHandler.java
git commit -m "feat(call): add WebSocket disconnect handler for ghost call prevention"
```

---

## Task 5: Backend — New endpoint + Conversation API enhancement

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/controller/CallController.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/CallService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/ConversationService.java`

- [ ] **Step 1: Add endpoint in CallController**

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/controller/CallController.java
// Add this method:

@GetMapping("/conversation/{convId}/active")
public ResponseEntity<CallSessionResponse> getActiveCallByConversation(
        Authentication authentication,
        @PathVariable Long convId) {

    CallSessionResponse response = callService.getActiveCallByConversation(authentication.getName(), convId);
    if (response == null) {
        return ResponseEntity.noContent().build();
    }
    return ResponseEntity.ok(response);
}
```

- [ ] **Step 2: Add method in CallService**

```java
// ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/CallService.java
// Add this method:

@Transactional(readOnly = true)
public CallSessionResponse getActiveCallByConversation(String username, Long conversationId) {
    User user = requireUser(username);

    if (!conversationUserRepository.isMember(conversationId, user.getId())) {
        return null;
    }

    return callSessionRepository.findActiveByConversationIdAndStatus(conversationId, CallStatus.ONGOING)
            .map(callSession -> {
                List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callSession.getId());
                return toCallSessionResponse(callSession, participants, user.getId(), true);
            })
            .orElse(null);
}
```

- [ ] **Step 3: Enhance ConversationService to populate hasActiveCall**

First, inject CallSessionRepository into ConversationService:

```java
// In ConversationService.java, add field injection:
@Autowired
private CallSessionRepository callSessionRepository;
```

Then modify `mapToConversationResponse` (around line 601) to add active call check:

```java
// In mapToConversationResponse, before the return statement:
// Check for active ONGOING call
boolean hasActiveCall = callSessionRepository
        .findActiveByConversationIdAndStatus(conversation.getId(), CallStatus.ONGOING)
        .isPresent();

Long activeCallId = null;
if (hasActiveCall) {
    activeCallId = callSessionRepository
            .findActiveByConversationIdAndStatus(conversation.getId(), CallStatus.ONGOING)
            .map(CallSession::getId)
            .orElse(null);
}
```

Then add to the builder (before `.blockedMembers(...)`):

```java
.hasActiveCall(hasActiveCall)
.activeCallId(activeCallId)
```

Note: This adds a DB query per conversation. For production with many conversations, consider batching the active call check into a single query. For now, this is acceptable for the initial implementation.

- [ ] **Step 4: Commit**

```bash
cd ConnectionAppBackend
git add src/main/java/iuh/fit/ConnectionAppBackend/controller/CallController.java
git add src/main/java/iuh/fit/ConnectionAppBackend/service/CallService.java
git add src/main/java/iuh/fit/ConnectionAppBackend/service/ConversationService.java
git commit -m "feat(call): add active call endpoint and conversation hasActiveCall field"
```

---

## Task 6: Backend — Build and verify

- [ ] **Step 1: Build**

```bash
cd ConnectionAppBackend
./mvnw clean package -DskipTests
```

Expected: BUILD SUCCESS

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "chore: verify backend build passes"
```

---

## Task 7: Web Frontend — Types and callService

**Files:**
- Modify: `ConnectionAppWeb/src/types/call.ts`
- Modify: `ConnectionAppWeb/src/services/callService.ts`

- [ ] **Step 1: Update call.ts types**

```typescript
// ConnectionAppWeb/src/types/call.ts
// Add WAITING to CallParticipant status (it's already `string`, so no type change needed)
// But add isGroupCall to CallSession:

export interface CallSession {
  callId: number;
  conversationId: number;
  initiatedBy: number;
  mediaType: CallMediaType;
  status: CallStatus;
  roomId: string;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  endedReason?: string | null;
  token?: CallToken | null;
  participants: CallParticipant[];
  isGroupCall?: boolean;  // ADD THIS
}
```

- [ ] **Step 2: Add getActiveCallByConversation to callService**

```typescript
// ConnectionAppWeb/src/services/callService.ts
// Add this method to the class:

async getActiveCallByConversation(conversationId: number): Promise<CallSession | null> {
  const response = await authService.authFetch(
    `/calls/conversation/${conversationId}/active`,
    { method: "GET" },
  );

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw await this.parseError(response, "Khong the kiem tra cuoc goi");
  }

  return (await response.json()) as CallSession;
}
```

- [ ] **Step 3: Commit**

```bash
cd ConnectionAppWeb
git add src/types/call.ts src/services/callService.ts
git commit -m "feat(call-web): add isGroupCall type and getActiveCallByConversation service"
```

---

## Task 8: Web Frontend — Zustand store changes

**Files:**
- Modify: `ConnectionAppWeb/src/stores/useCallStore.ts`

- [ ] **Step 1: Add groupCallActive state and actions**

```typescript
// ConnectionAppWeb/src/stores/useCallStore.ts
// Add to CallState interface:
interface CallState {
  // ... existing fields
  groupCallActive: CallSession | null;  // ADD THIS
  joinGroupCall: (callId: number) => Promise<CallSession>;  // ADD THIS
  fetchActiveCall: (convId: number) => Promise<void>;  // ADD THIS
  // ... existing methods
}

// Add to store implementation:
groupCallActive: null,

joinGroupCall: async (callId) => {
  const call = await callService.acceptCall(callId);
  set({ groupCallActive: null, activeCall: call });
  return call;
},

fetchActiveCall: async (convId) => {
  const call = await callService.getActiveCallByConversation(convId);
  if (call) {
    set({ groupCallActive: call });
  } else {
    set({ groupCallActive: null });
  }
},
```

- [ ] **Step 2: Modify setIncomingCall to handle group calls**

```typescript
// In setIncomingCall, add check for group call:
setIncomingCall: (call) => {
  const myUserId = useAuthStore.getState().user?.id;
  const isIncoming = myUserId != null && call.initiatedBy !== myUserId;

  // Group call with ONGOING status -> set groupCallActive, not incomingCall
  if (call.isGroupCall && call.status === "ONGOING") {
    set({ groupCallActive: call, incomingCall: null });
    return;
  }

  if (isIncoming) {
    set({ incomingCall: call });
    return;
  }

  set({ activeCall: call, incomingCall: null });
},
```

- [ ] **Step 3: Modify handleCallStatus to handle group call end**

```typescript
// In handleCallStatus, add group call handling:
handleCallStatus: (call) => {
  const myUserId = useAuthStore.getState().user?.id;
  const isIncoming = myUserId != null && call.initiatedBy !== myUserId;

  // Group call status updates
  if (call.isGroupCall) {
    if (isFinishedStatus(call.status)) {
      set({ groupCallActive: null, activeCall: null, incomingCall: null });
      void get().fetchHistory(0, 20);
      return;
    }
    if (call.status === "ONGOING") {
      set({ groupCallActive: call });
      return;
    }
  }

  // ... rest of existing handleCallStatus unchanged
```

- [ ] **Step 4: Commit**

```bash
cd ConnectionAppWeb
git add src/stores/useCallStore.ts
git commit -m "feat(call-web): add groupCallActive state and joinGroupCall action"
```

---

## Task 9: Web Frontend — CallOverlay with group call banner

**Files:**
- Modify: `ConnectionAppWeb/src/components/chat/CallOverlay.tsx`

- [ ] **Step 1: Update CallOverlay props and add group call banner**

```typescript
// ConnectionAppWeb/src/components/chat/CallOverlay.tsx
// Update interface:
interface CallOverlayProps {
  conversationId: number;
  isGroupConversation?: boolean;  // ADD THIS
}

const CallOverlay = ({ conversationId, isGroupConversation }: CallOverlayProps) => {
  const {
    incomingCall,
    activeCall,
    groupCallActive,  // ADD THIS
    acceptCall,
    rejectCall,
    endCall,
    ensureActiveCallToken,
    joinGroupCall,    // ADD THIS
    fetchActiveCall,  // ADD THIS
  } = useCallStore();

  // Fetch active call on mount
  useEffect(() => {
    if (isGroupConversation) {
      void fetchActiveCall(conversationId);
    }
  }, [conversationId, isGroupConversation, fetchActiveCall]);

  const groupCallForConversation =
    groupCallActive?.conversationId === conversationId ? groupCallActive : null;

  // Check if user is already in the group call
  const myUserId = useAuthStore.getState().user?.id;
  const isUserInGroupCall = groupCallForConversation?.participants.some(
    (p) => p.userId === myUserId && p.status === "JOINED"
  );

  // ... rest of existing logic
```

- [ ] **Step 2: Add group call banner UI**

Add this section in the return, before the incoming call banner:

```tsx
{isGroupConversation && groupCallForConversation && !isUserInGroupCall && (
  <div className="mb-3 rounded-lg border border-blue-300/60 bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
      <PhoneCall className="size-4" />
      <span>Dang co cuoc goi nhom dien ra, ban co muon tham gia?</span>
    </div>
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="h-8"
        onClick={() => void handleJoinGroupCall()}
        disabled={isSubmitting}
      >
        <PhoneCall className="size-4" />
        Tham gia
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Add handleJoinGroupCall function**

```typescript
const handleJoinGroupCall = async () => {
  if (!groupCallForConversation || isSubmitting) {
    return;
  }

  setIsSubmitting(true);
  try {
    await joinGroupCall(groupCallForConversation.callId);
    toast.success("Da tham gia cuoc goi nhom");
  } catch (error) {
    console.error(error);
    toast.error("Khong the tham gia cuoc goi");
  } finally {
    setIsSubmitting(false);
  }
};
```

- [ ] **Step 4: Commit**

```bash
cd ConnectionAppWeb
git add src/components/chat/CallOverlay.tsx
git commit -m "feat(call-web): add group call join banner to CallOverlay"
```

---

## Task 10: Web Frontend — ChatWindowLayout pass conversationType

**Files:**
- Modify: `ConnectionAppWeb/src/components/chat/ChatWindowLayout.tsx`

- [ ] **Step 1: Pass isGroupConversation to CallOverlay**

Find where `CallOverlay` is rendered and add the prop:

```tsx
// In ChatWindowLayout.tsx, find the CallOverlay render:
<CallOverlay
  conversationId={selectedConversation.id}
  isGroupConversation={selectedConversation.type === "GROUP"}
/>
```

- [ ] **Step 2: Commit**

```bash
cd ConnectionAppWeb
git add src/components/chat/ChatWindowLayout.tsx
git commit -m "feat(call-web): pass isGroupConversation to CallOverlay"
```

---

## Task 11: Web Frontend — WebSocket subscription for call participants

**Files:**
- Modify: `ConnectionAppWeb/src/components/chat/CallOverlay.tsx`

- [ ] **Step 1: Add dynamic subscription in CallOverlay**

Instead of subscribing in useSocketStore (which requires conversationId at connect time), subscribe dynamically in CallOverlay when it mounts for a group conversation:

```typescript
// In CallOverlay.tsx, add a new useEffect:
const { client } = useSocketStore.getState();

useEffect(() => {
  if (!isGroupConversation || !client || !client.connected) {
    return;
  }

  const topic = `/topic/conversation.${conversationId}/call-participants`;
  const subscription = client.subscribe(topic, (message) => {
    const payload: { callId: number; conversationId: number; status: string; participants: CallParticipant[] } = JSON.parse(message.body);

    const hasJoined = payload.participants.some(p => p.status === "JOINED");
    const myUserId = useAuthStore.getState().user?.id;
    const isUserJoined = payload.participants.some(
      p => p.userId === myUserId && p.status === "JOINED"
    );

    if (hasJoined && payload.status === "ONGOING") {
      if (!isUserJoined) {
        // User not in call yet — show groupCallActive banner
        useCallStore.getState().set({
          groupCallActive: {
            callId: payload.callId,
            conversationId: payload.conversationId,
            status: payload.status as CallStatus,
            participants: payload.participants,
            isGroupCall: true,
          } as CallSession,
        });
      }
      // If user IS joined, the activeCall state already handles it
    } else if (!hasJoined || payload.status === "ENDED" || payload.status === "MISSED") {
      const current = useCallStore.getState().groupCallActive;
      if (current?.conversationId === payload.conversationId) {
        useCallStore.getState().set({ groupCallActive: null });
      }
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}, [conversationId, isGroupConversation, client?.connected]);
```

This approach:
- Subscribes only when viewing a group conversation
- Unsubscribes when leaving the conversation
- No mass-subscription at ChatListScreen level

- [ ] **Step 2: Commit**

```bash
cd ConnectionAppWeb
git add src/components/chat/CallOverlay.tsx
git commit -m "feat(call-web): subscribe to call-participants topic in CallOverlay for group call sync"
```

---

## Task 12: Web Frontend — Conversation list active call indicator

**Files:**
- Modify: `ConnectionAppWeb/src/components/chat/ConversationList.tsx` (or wherever conversations are listed)

- [ ] **Step 1: Show active call icon**

In the conversation item rendering, add:

```tsx
{conversation.hasActiveCall && (
  <PhoneCall className="size-3 text-green-500 animate-pulse" />
)}
```

- [ ] **Step 2: Commit**

```bash
cd ConnectionAppWeb
git add src/components/chat/ConversationList.tsx
git commit -m "feat(call-web): show active call indicator in conversation list"
```

---

## Task 13: Web Frontend — Build and verify

- [ ] **Step 1: Build**

```bash
cd ConnectionAppWeb
npm run build
```

Expected: No errors

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "chore: verify web build passes"
```

---

## Task 14: Mobile Frontend — call.service.ts changes

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/services/call.service.ts`

- [ ] **Step 1: Add isGroupCall to CallSession interface**

```typescript
// ConnectionAppMobile/AppChatMobile/src/features/chat/services/call.service.ts
// Add to CallSession interface:
export interface CallSession {
  // ... existing fields
  isGroupCall?: boolean;  // ADD THIS
}
```

- [ ] **Step 2: Add getActiveCallByConversation method**

```typescript
// In CallService class:
async getActiveCallByConversation(conversationId: number): Promise<CallSession | null> {
  const response = await authService.authFetch(
    `/calls/conversation/${conversationId}/active`,
    { method: "GET" },
  );

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw await this.parseError(response, "Khong the kiem tra cuoc goi");
  }

  return (await response.json()) as CallSession;
}
```

- [ ] **Step 3: Commit**

```bash
cd ConnectionAppMobile/AppChatMobile
git add src/features/chat/services/call.service.ts
git commit -m "feat(call-mobile): add isGroupCall type and getActiveCallByConversation"
```

---

## Task 15: Mobile Frontend — ChatContext changes

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/context/ChatContext.tsx`

- [ ] **Step 1: Add groupCallActive state**

```typescript
// In ChatContext.tsx:
const [groupCallActive, setGroupCallActive] = useState<CallSession | null>(null);
```

- [ ] **Step 2: Add joinGroupCall action**

```typescript
// In ChatContext.tsx:
const joinGroupCall = useCallback(async (callId: number) => {
  try {
    const call = await callService.acceptCall(callId);
    const token = call.token ?? await callService.issueToken(callId);
    setActiveCall({ ...call, token });
    setGroupCallActive(null);
  } catch (error) {
    console.error("[ChatContext] joinGroupCall error:", error);
    throw error;
  }
}, []);
```

- [ ] **Step 3: Add to context interface and provider value**

```typescript
// In ChatContextType interface:
groupCallActive: CallSession | null;
joinGroupCall: (callId: number) => Promise<void>;

// In provider value:
groupCallActive,
joinGroupCall,
```

- [ ] **Step 4: Modify onCallInvite for group calls**

```typescript
// In onCallInvite:
const onCallInvite = useCallback((payload: any) => {
  if (!payload?.callId) {
    return;
  }

  const session = payload as CallSession;

  // Group call with ONGOING status -> set groupCallActive
  if (session.isGroupCall && session.status === "ONGOING") {
    setGroupCallActive(session);
    return;
  }

  setIncomingCall(session);
  // ... rest of existing logic
}, []);
```

- [ ] **Step 5: Modify onCallStatusUpdate for group calls**

```typescript
// In onCallStatusUpdate, add group call handling:
const onCallStatusUpdate = useCallback((payload: any) => {
  if (!payload?.status || !payload?.callId) {
    return;
  }

  const session = payload as CallSession;

  // Group call handling
  if (session.isGroupCall) {
    if (isFinishedStatus(payload.status)) {
      setGroupCallActive(null);
      setActiveCall(null);
      setIncomingCall(null);
      return;
    }

    if (payload.status === "ONGOING") {
      setGroupCallActive(session);
      return;
    }
  }

  // ... rest of existing logic unchanged
}, []);
```

- [ ] **Step 6: Commit**

```bash
cd ConnectionAppMobile/AppChatMobile
git add src/features/chat/context/ChatContext.tsx
git commit -m "feat(call-mobile): add groupCallActive state and joinGroupCall action"
```

---

## Task 16: Mobile Frontend — ChatRoomScreen changes

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/screens/ChatRoomScreen.tsx`

- [ ] **Step 1: Fetch active call on mount**

```typescript
// In ChatRoomScreen.tsx, add useEffect:
useEffect(() => {
  if (conversation?.type === "GROUP") {
    callService.getActiveCallByConversation(conversation.id)
      .then((call) => {
        if (call) {
          setGroupCallActive(call);
        }
      })
      .catch(console.error);
  }
}, [conversation?.id, conversation?.type]);
```

- [ ] **Step 2: Add group call banner**

Add this section before the active call banner:

```tsx
{conversation?.type === "GROUP" && groupCallActive && !isUserInGroupCall && (
  <View style={styles.groupCallBanner}>
    <Text style={styles.groupCallBannerText}>
      Dang co cuoc goi nhom dien ra, ban co muon tham gia?
    </Text>
    <Button title="Tham gia" onPress={() => joinGroupCall(groupCallActive.callId)} />
  </View>
)}
```

- [ ] **Step 3: Add isUserInGroupCall check**

```typescript
const isUserInGroupCall = groupCallActive?.participants.some(
  (p) => p.userId === user?.id && p.status === "JOINED"
);
```

- [ ] **Step 4: Commit**

```bash
cd ConnectionAppMobile/AppChatMobile
git add src/features/chat/screens/ChatRoomScreen.tsx
git commit -m "feat(call-mobile): add group call join banner to ChatRoomScreen"
```

---

## Task 17: Mobile Frontend — ChatListScreen active call indicator

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/screens/ChatListScreen.tsx`

- [ ] **Step 1: Show active call indicator**

In the conversation item rendering, add:

```tsx
{conversation.hasActiveCall && (
  <View style={styles.activeCallIndicator}>
    <Ionicons name="call" size={14} color="#22c55e" />
  </View>
)}
```

- [ ] **Step 2: Commit**

```bash
cd ConnectionAppMobile/AppChatMobile
git add src/features/chat/screens/ChatListScreen.tsx
git commit -m "feat(call-mobile): show active call indicator in ChatListScreen"
```

---

## Task 18: Mobile Frontend — DO NOT commit app.json and eas.json

**IMPORTANT**: The files `app.json` and `eas.json` contain private environment variables. Do NOT commit them.

- [ ] **Step 1: Verify .gitignore excludes them**

```bash
cd ConnectionAppMobile/AppChatMobile
git check-ignore app.json eas.json
```

If they are NOT ignored, add them to .gitignore:

```
# .gitignore
app.json
eas.json
```

- [ ] **Step 2: Unstage if accidentally staged**

```bash
git reset HEAD app.json eas.json 2>/dev/null || true
```

---

## Task 19: Mobile Frontend — Build and verify

- [ ] **Step 1: Type check**

```bash
cd ConnectionAppMobile/AppChatMobile
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 2: Commit**

```bash
# IMPORTANT: Do NOT commit app.json or eas.json
git add src/
git commit -m "chore: verify mobile type check passes"
```

---

## Task 20: Integration test with Docker Compose

- [ ] **Step 1: Start services**

```bash
cd C:\Users\Admin\Desktop\ConnectionApp
docker compose up -d
```

- [ ] **Step 2: Check backend logs for errors**

```bash
docker logs connection-backend --tail 50
```

- [ ] **Step 3: Test group call flow**
1. Create a group conversation with 3+ users
2. User A starts a group call
3. User B should see "Đang có cuộc gọi nhóm diễn ra, bạn có muốn tham gia?" with "Tham gia" button
4. User B clicks "Tham gia" → joins Zego room
5. User A leaves → call should continue (User B still in room)
6. User B leaves → call should end
7. User C (new member added during call) should see "Tham gia" button

- [ ] **Step 4: Test private call still works**
1. Start a private call between 2 users
2. Receiver should see incoming call banner with "Nhan" and "Tu choi" buttons
3. Verify behavior unchanged

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify group call integration with docker compose"
```
