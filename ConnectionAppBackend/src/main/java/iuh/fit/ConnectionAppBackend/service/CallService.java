package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.CallMediaType;
import iuh.fit.ConnectionAppBackend.domain.common.CallParticipantStatus;
import iuh.fit.ConnectionAppBackend.domain.common.CallStatus;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.dto.*;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallParticipant;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallSession;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationUser;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.CallParticipantRepository;
import iuh.fit.ConnectionAppBackend.repo.CallSessionRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationUserRepository;
import iuh.fit.ConnectionAppBackend.repo.FriendRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class CallService {

    private static final Set<CallStatus> ACTIVE_CALL_STATUSES = Set.of(CallStatus.RINGING, CallStatus.ONGOING);

    @Autowired
    private UserService userService;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private ConversationUserRepository conversationUserRepository;

    @Autowired
    private FriendRepository friendRepository;

    @Autowired
    private CallSessionRepository callSessionRepository;

    @Autowired
    private CallParticipantRepository callParticipantRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Value("${app.zego.app-id:0}")
    private long zegoAppId;

    @Value("${app.zego.server-secret:}")
    private String zegoServerSecret;

    @Value("${app.zego.token-ttl-seconds:3600}")
    private long zegoTokenTtlSeconds;

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

        List<CallSession> existingActiveCalls = callSessionRepository.findActiveByConversationId(
                conversationId,
                ACTIVE_CALL_STATUSES,
                PageRequest.of(0, 1)
        );

        if (!existingActiveCalls.isEmpty()) {
            throw new BadRequestException("This conversation already has an active call");
        }

        validatePrivateConversationBlock(conversation, caller.getId());

        List<ConversationUser> members = conversationUserRepository.findByConversationId(conversationId);
        if (members.size() < 2) {
            throw new BadRequestException("Cannot start a call without at least 2 participants");
        }

        LocalDateTime now = LocalDateTime.now();
        CallSession callSession = CallSession.builder()
                .conversation(conversation)
                .initiatedBy(caller)
                .mediaType(parseMediaType(request.getMediaType()))
                .status(CallStatus.RINGING)
                .zegoRoomId(generateRoomId(conversationId))
                .createdAt(now)
                .build();

        CallSession savedSession = callSessionRepository.save(callSession);

        List<CallParticipant> participants = new ArrayList<>();
        for (ConversationUser member : members) {
            Long memberId = member.getUser().getId();
            boolean isCaller = Objects.equals(memberId, caller.getId());

            CallParticipant participant = CallParticipant.builder()
                    .callSession(savedSession)
                    .user(member.getUser())
                    .status(isCaller ? CallParticipantStatus.JOINED : CallParticipantStatus.RINGING)
                    .audioMuted(false)
                    .videoMuted(false)
                    .joinedAt(isCaller ? now : null)
                    .leftAt(null)
                    .build();
            participants.add(participant);
        }

        callParticipantRepository.saveAll(participants);

        publishInviteEvents(savedSession, participants);
        publishStatusEvents(savedSession, participants);
        publishConversationParticipantState(savedSession, participants);

        return toCallSessionResponse(savedSession, participants, caller.getId(), true);
    }

    @Transactional(readOnly = true)
    public CallSessionResponse getCallDetails(String username, Long callId) {
        User user = requireUser(username);
        CallSession callSession = getRequiredCallSession(callId);
        ensureUserIsParticipant(callId, user.getId());

        List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);
        return toCallSessionResponse(callSession, participants, user.getId(), false);
    }

    @Transactional(readOnly = true)
    public CallTokenResponse issueToken(String username, Long callId) {
        User user = requireUser(username);
        CallSession callSession = getRequiredCallSession(callId);
        ensureUserIsParticipant(callId, user.getId());

        return buildToken(callSession, user.getId());
    }

    @Transactional
    public CallSessionResponse acceptCall(String username, Long callId) {
        User user = requireUser(username);
        CallSession callSession = getRequiredCallSession(callId);

        CallParticipant participant = callParticipantRepository.findByCallSessionIdAndUserId(callId, user.getId())
                .orElseThrow(() -> new UnauthorizedException("User is not a participant of this call"));

        if (participant.getStatus() == CallParticipantStatus.DECLINED || participant.getStatus() == CallParticipantStatus.LEFT) {
            throw new BadRequestException("This participant state cannot be accepted");
        }

        if (participant.getStatus() != CallParticipantStatus.JOINED) {
            participant.setStatus(CallParticipantStatus.JOINED);
            participant.setJoinedAt(LocalDateTime.now());
            callParticipantRepository.save(participant);
        }

        if (callSession.getStatus() == CallStatus.RINGING) {
            callSession.setStatus(CallStatus.ONGOING);
            if (callSession.getStartedAt() == null) {
                callSession.setStartedAt(LocalDateTime.now());
            }
            callSessionRepository.save(callSession);
        }

        List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);
        publishStatusEvents(callSession, participants);
        publishConversationParticipantState(callSession, participants);

        return toCallSessionResponse(callSession, participants, user.getId(), true);
    }

    @Transactional
    public CallSessionResponse rejectCall(String username, Long callId) {
        User user = requireUser(username);
        CallSession callSession = getRequiredCallSession(callId);

        CallParticipant participant = callParticipantRepository.findByCallSessionIdAndUserId(callId, user.getId())
                .orElseThrow(() -> new UnauthorizedException("User is not a participant of this call"));

        if (participant.getStatus() == CallParticipantStatus.JOINED) {
            throw new BadRequestException("Joined participant cannot reject call");
        }

        if (participant.getStatus() != CallParticipantStatus.DECLINED) {
            participant.setStatus(CallParticipantStatus.DECLINED);
            participant.setLeftAt(LocalDateTime.now());
            callParticipantRepository.save(participant);
        }

        List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);
        maybeCompleteAsMissed(callSession, participants);

        publishStatusEvents(callSession, participants);
        publishConversationParticipantState(callSession, participants);

        return toCallSessionResponse(callSession, participants, user.getId(), false);
    }

    @Transactional
    public CallSessionResponse endCall(String username, Long callId, CallActionRequest request) {
        User user = requireUser(username);
        CallSession callSession = getRequiredCallSession(callId);
        ensureUserIsParticipant(callId, user.getId());

        if (callSession.getStatus() == CallStatus.ENDED
                || callSession.getStatus() == CallStatus.MISSED
                || callSession.getStatus() == CallStatus.CANCELLED) {
            List<CallParticipant> existingParticipants = callParticipantRepository.findByCallIdWithUser(callId);
            return toCallSessionResponse(callSession, existingParticipants, user.getId(), false);
        }

        LocalDateTime now = LocalDateTime.now();
        callSession.setStatus(CallStatus.ENDED);
        callSession.setEndedAt(now);
        callSession.setEndedReason(normalizeEndedReason(request == null ? null : request.getReason()));
        if (callSession.getStartedAt() != null) {
            long duration = Math.max(0, callSession.getStartedAt().until(now, java.time.temporal.ChronoUnit.SECONDS));
            callSession.setDurationSeconds(duration);
        }
        callSessionRepository.save(callSession);

        List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);
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

        publishStatusEvents(callSession, participants);
        publishConversationParticipantState(callSession, participants);

        return toCallSessionResponse(callSession, participants, user.getId(), false);
    }

    @Transactional
    public CallSessionResponse updateParticipantState(String username, Long callId, CallParticipantStateRequest request) {
        User user = requireUser(username);
        return updateParticipantStateByUserId(user.getId(), callId, request);
    }

    @Transactional
    public CallSessionResponse updateParticipantStateByUserId(Long userId, Long callId, CallParticipantStateRequest request) {
        if (request == null || (request.getAudioMuted() == null && request.getVideoMuted() == null)) {
            throw new BadRequestException("At least one participant state field is required");
        }

        CallSession callSession = getRequiredCallSession(callId);
        CallParticipant participant = callParticipantRepository.findByCallSessionIdAndUserId(callId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a participant of this call"));

        if (request.getAudioMuted() != null) {
            participant.setAudioMuted(request.getAudioMuted());
        }
        if (request.getVideoMuted() != null) {
            participant.setVideoMuted(request.getVideoMuted());
        }
        callParticipantRepository.save(participant);

        List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callId);
        publishConversationParticipantState(callSession, participants);

        return toCallSessionResponse(callSession, participants, userId, false);
    }

    @Transactional(readOnly = true)
    public PageResponse<CallHistoryItemResponse> getCallHistory(String username, int page, int size) {
        User user = requireUser(username);

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<CallSession> history = callSessionRepository.findHistoryByUserId(user.getId(), pageable);
        List<CallHistoryItemResponse> items = history.getContent()
                .stream()
                .map(call -> mapToHistoryItem(call, user.getId()))
                .toList();

        return PageResponse.<CallHistoryItemResponse>builder()
                .content(items)
                .pageNumber(safePage)
                .pageSize(safeSize)
                .totalElements(history.getTotalElements())
                .totalPages(history.getTotalPages())
                .hasNext(history.hasNext())
                .hasPrevious(history.hasPrevious())
                .build();
    }

    private void maybeCompleteAsMissed(CallSession callSession, List<CallParticipant> participants) {
        if (callSession.getStatus() != CallStatus.RINGING) {
            return;
        }

        boolean hasJoinedParticipant = participants.stream()
                .anyMatch(p -> p.getStatus() == CallParticipantStatus.JOINED);

        if (hasJoinedParticipant) {
            return;
        }

        boolean hasRingingParticipant = participants.stream()
                .anyMatch(p -> p.getStatus() == CallParticipantStatus.RINGING);

        if (!hasRingingParticipant) {
            LocalDateTime now = LocalDateTime.now();
            callSession.setStatus(CallStatus.MISSED);
            callSession.setEndedAt(now);
            callSession.setEndedReason("NO_ANSWER");
            callSession.setDurationSeconds(0L);
            callSessionRepository.save(callSession);
        }
    }

    private CallHistoryItemResponse mapToHistoryItem(CallSession callSession, Long currentUserId) {
        List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callSession.getId());
        String counterpartSummary = participants.stream()
                .filter(p -> !Objects.equals(p.getUser().getId(), currentUserId))
                .map(p -> p.getUser().getDisplayName())
                .filter(StringUtils::hasText)
                .limit(3)
                .reduce((left, right) -> left + ", " + right)
                .orElse("Unknown");

        return CallHistoryItemResponse.builder()
                .callId(callSession.getId())
                .conversationId(callSession.getConversation().getId())
                .mediaType(callSession.getMediaType().name())
                .status(callSession.getStatus().name())
                .createdAt(callSession.getCreatedAt())
                .startedAt(callSession.getStartedAt())
                .endedAt(callSession.getEndedAt())
                .durationSeconds(callSession.getDurationSeconds())
                .counterpartSummary(counterpartSummary)
                .build();
    }

    private void publishInviteEvents(CallSession callSession, List<CallParticipant> participants) {
        Long initiatorId = callSession.getInitiatedBy().getId();

        for (CallParticipant participant : participants) {
            Long userId = participant.getUser().getId();
            if (Objects.equals(userId, initiatorId)) {
                continue;
            }

            CallSessionResponse payload = toCallSessionResponse(callSession, participants, userId, true);
            messagingTemplate.convertAndSend("/topic/user." + userId + "/call-invite", payload);
        }
    }

    private void publishStatusEvents(CallSession callSession, List<CallParticipant> participants) {
        for (CallParticipant participant : participants) {
            Long userId = participant.getUser().getId();
            CallSessionResponse payload = toCallSessionResponse(callSession, participants, userId, false);
            messagingTemplate.convertAndSend("/topic/user." + userId + "/call-status", payload);
        }
    }

    private void publishConversationParticipantState(CallSession callSession, List<CallParticipant> participants) {
        List<CallParticipantResponse> participantPayloads = participants.stream()
                .map(this::toCallParticipantResponse)
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

    private CallSessionResponse toCallSessionResponse(CallSession callSession,
                                                      List<CallParticipant> participants,
                                                      Long currentUserId,
                                                      boolean includeToken) {
        List<CallParticipantResponse> participantResponses = participants.stream()
                .map(this::toCallParticipantResponse)
                .toList();

        return CallSessionResponse.builder()
                .callId(callSession.getId())
                .conversationId(callSession.getConversation().getId())
                .initiatedBy(callSession.getInitiatedBy().getId())
                .mediaType(callSession.getMediaType().name())
                .status(callSession.getStatus().name())
                .roomId(callSession.getZegoRoomId())
                .createdAt(callSession.getCreatedAt())
                .startedAt(callSession.getStartedAt())
                .endedAt(callSession.getEndedAt())
                .durationSeconds(callSession.getDurationSeconds())
                .endedReason(callSession.getEndedReason())
                .token(includeToken ? buildToken(callSession, currentUserId) : null)
                .participants(participantResponses)
                .build();
    }

    private CallParticipantResponse toCallParticipantResponse(CallParticipant participant) {
        return CallParticipantResponse.builder()
                .userId(participant.getUser().getId())
                .displayName(participant.getUser().getDisplayName())
                .avatarUrl(participant.getUser().getAvatarUrl())
                .status(participant.getStatus().name())
                .audioMuted(participant.isAudioMuted())
                .videoMuted(participant.isVideoMuted())
                .joinedAt(participant.getJoinedAt())
                .leftAt(participant.getLeftAt())
                .build();
    }

    private CallTokenResponse buildToken(CallSession callSession, Long userId) {
        if (zegoAppId <= 0 || !StringUtils.hasText(zegoServerSecret)) {
            throw new BadRequestException("ZEGO is not configured on server");
        }

        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(Math.max(60L, zegoTokenTtlSeconds));
        long expiresAtEpoch = expiresAt.toEpochSecond(ZoneOffset.UTC);

        String data = callSession.getZegoRoomId() + ":" + userId + ":" + expiresAtEpoch;
        String signature = sign(data, zegoServerSecret);
        String rawToken = data + ":" + signature;
        String encodedToken = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(rawToken.getBytes(StandardCharsets.UTF_8));

        return CallTokenResponse.builder()
                .appId(zegoAppId)
                .roomId(callSession.getZegoRoomId())
                .userId(String.valueOf(userId))
                .token(encodedToken)
                .expiresAt(expiresAt)
                .build();
    }

    private String sign(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signed = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(signed);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to generate call token", ex);
        }
    }

    private String generateRoomId(Long conversationId) {
        return "room_" + conversationId + "_" + System.currentTimeMillis();
    }

    private String normalizeEndedReason(String rawReason) {
        if (!StringUtils.hasText(rawReason)) {
            return "ENDED_BY_USER";
        }
        return rawReason.trim();
    }

    private CallMediaType parseMediaType(String rawMediaType) {
        if (!StringUtils.hasText(rawMediaType)) {
            return CallMediaType.VOICE;
        }

        try {
            return CallMediaType.valueOf(rawMediaType.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Unsupported mediaType: " + rawMediaType);
        }
    }

    private void validatePrivateConversationBlock(Conversation conversation, Long senderId) {
        if (conversation.getType() != ConversationType.PRIVATE) {
            return;
        }

        List<ConversationUser> members = conversationUserRepository.findByConversationId(conversation.getId());
        Long otherUserId = members.stream()
                .map(member -> member.getUser().getId())
                .filter(memberId -> !memberId.equals(senderId))
                .findFirst()
                .orElse(null);

        if (otherUserId == null) {
            return;
        }

        boolean blockedByOther = friendRepository.isBlockedBy(otherUserId, senderId);
        boolean blockedByMe = friendRepository.isBlockedBy(senderId, otherUserId);

        if (blockedByOther || blockedByMe) {
            throw new UnauthorizedException("Call is not allowed in this private conversation");
        }
    }

    private void ensureUserIsParticipant(Long callId, Long userId) {
        boolean isParticipant = callParticipantRepository.existsByCallSessionIdAndUserId(callId, userId);
        if (!isParticipant) {
            throw new UnauthorizedException("User is not a participant of this call");
        }
    }

    private CallSession getRequiredCallSession(Long callId) {
        return callSessionRepository.findByIdWithContext(callId)
                .orElseThrow(() -> new ResourceNotFoundException("Call not found with id: " + callId));
    }

    private User requireUser(String username) {
        return userService.getUserByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}
