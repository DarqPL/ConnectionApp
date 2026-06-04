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
