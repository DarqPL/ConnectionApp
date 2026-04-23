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
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.security.SecureRandom;

@Service
public class CallService {

    private static final Set<CallStatus> ACTIVE_CALL_STATUSES = Set.of(CallStatus.RINGING, CallStatus.ONGOING);
    private static final String ZEGO_TOKEN_VERSION = "04";
    private static final int ZEGO_IV_LENGTH = 16;
    private static final String ZEGO_TRANSFORMATION = "AES/CBC/PKCS5Padding";
    private static final String ZEGO_PRIVILEGE_LOGIN_KEY = "1";
    private static final String ZEGO_PRIVILEGE_PUBLISH_KEY = "2";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();

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

    @Value("${app.call.ring-timeout-seconds:30}")
    private long ringTimeoutSeconds;

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
            long duration = Math.max(0, callSession.getStartedAt().until(now, ChronoUnit.SECONDS));
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

    @Transactional
    public int processRingingTimeouts() {
        long timeoutSeconds = Math.max(5L, ringTimeoutSeconds);
        LocalDateTime deadline = LocalDateTime.now().minusSeconds(timeoutSeconds);

        List<CallSession> timedOutCalls = callSessionRepository.findByStatusTimedOut(CallStatus.RINGING, deadline);
        int processedCount = 0;

        for (CallSession callSession : timedOutCalls) {
            List<CallParticipant> participants = callParticipantRepository.findByCallIdWithUser(callSession.getId());
            if (participants.isEmpty() || callSession.getStatus() != CallStatus.RINGING) {
                continue;
            }

            boolean hasJoinedNonInitiator = participants.stream()
                    .anyMatch(p -> p.getStatus() == CallParticipantStatus.JOINED
                            && !Objects.equals(p.getUser().getId(), callSession.getInitiatedBy().getId()));
            if (hasJoinedNonInitiator) {
                continue;
            }

            markCallAsMissed(callSession, participants, "RING_TIMEOUT");
            processedCount++;
        }

        return processedCount;
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

    private void reconcileExistingActiveCall(CallSession callSession, List<CallParticipant> participants) {
        if (!ACTIVE_CALL_STATUSES.contains(callSession.getStatus())) {
            return;
        }

        if (callSession.getStatus() == CallStatus.RINGING) {
            LocalDateTime deadline = LocalDateTime.now().minusSeconds(Math.max(5L, ringTimeoutSeconds));
            if (callSession.getCreatedAt() != null && !callSession.getCreatedAt().isAfter(deadline)) {
                markCallAsMissed(callSession, participants, "RING_TIMEOUT");
                return;
            }

            CallStatus previousStatus = callSession.getStatus();
            maybeCompleteAsMissed(callSession, participants);
            if (previousStatus != callSession.getStatus()) {
                publishStatusEvents(callSession, participants);
                publishConversationParticipantState(callSession, participants);
            }
            return;
        }

        boolean hasJoinedParticipant = participants.stream()
                .anyMatch(p -> p.getStatus() == CallParticipantStatus.JOINED && p.getLeftAt() == null);

        if (!hasJoinedParticipant) {
            markCallAsEnded(callSession, participants, "NO_ACTIVE_PARTICIPANTS");
        }
    }

    private void markCallAsMissed(CallSession callSession,
                                  List<CallParticipant> participants,
                                  String reason) {
        LocalDateTime now = LocalDateTime.now();
        callSession.setStatus(CallStatus.MISSED);
        callSession.setEndedAt(now);
        callSession.setEndedReason(reason);
        callSession.setDurationSeconds(0L);
        callSessionRepository.save(callSession);

        for (CallParticipant participant : participants) {
            if (participant.getStatus() == CallParticipantStatus.RINGING) {
                participant.setStatus(CallParticipantStatus.MISSED);
            } else if (participant.getStatus() == CallParticipantStatus.JOINED) {
                participant.setStatus(CallParticipantStatus.LEFT);
            }

            if (participant.getLeftAt() == null) {
                participant.setLeftAt(now);
            }
        }
        callParticipantRepository.saveAll(participants);

        publishStatusEvents(callSession, participants);
        publishConversationParticipantState(callSession, participants);
    }

    private void markCallAsEnded(CallSession callSession,
                                 List<CallParticipant> participants,
                                 String reason) {
        LocalDateTime now = LocalDateTime.now();
        callSession.setStatus(CallStatus.ENDED);
        callSession.setEndedAt(now);
        callSession.setEndedReason(reason);
        if (callSession.getStartedAt() != null) {
            long duration = Math.max(0, callSession.getStartedAt().until(now, ChronoUnit.SECONDS));
            callSession.setDurationSeconds(duration);
        } else {
            callSession.setDurationSeconds(0L);
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

        publishStatusEvents(callSession, participants);
        publishConversationParticipantState(callSession, participants);
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

        byte[] secretBytes = zegoServerSecret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length != 32) {
            throw new BadRequestException("ZEGO server secret must be 32 bytes");
        }

        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(Math.max(60L, zegoTokenTtlSeconds));
        int effectiveTimeInSeconds = (int) Math.min(Integer.MAX_VALUE, Math.max(60L, zegoTokenTtlSeconds));
        String payload = buildRtcRoomPayload(callSession.getZegoRoomId());
        String token = generateToken04(zegoAppId, String.valueOf(userId), zegoServerSecret, effectiveTimeInSeconds, payload);

        return CallTokenResponse.builder()
                .appId(zegoAppId)
                .roomId(callSession.getZegoRoomId())
                .userId(String.valueOf(userId))
                .token(token)
                .expiresAt(expiresAt)
                .build();
    }

    private String buildRtcRoomPayload(String roomId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("room_id", roomId);

        Map<String, Integer> privilege = new LinkedHashMap<>();
        privilege.put(ZEGO_PRIVILEGE_LOGIN_KEY, 1);
        privilege.put(ZEGO_PRIVILEGE_PUBLISH_KEY, 1);

        payload.put("privilege", privilege);
        payload.put("stream_id_list", null);

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to serialize ZEGO payload", ex);
        }
    }

    private String generateToken04(long appId,
                                   String userId,
                                   String secret,
                                   int effectiveTimeInSeconds,
                                   String payload) {
        if (appId <= 0) {
            throw new BadRequestException("Invalid ZEGO appId");
        }
        if (!StringUtils.hasText(userId)) {
            throw new BadRequestException("Invalid ZEGO userId");
        }
        if (!StringUtils.hasText(secret) || secret.getBytes(StandardCharsets.UTF_8).length != 32) {
            throw new BadRequestException("ZEGO server secret must be 32 bytes");
        }
        if (effectiveTimeInSeconds <= 0) {
            throw new BadRequestException("Invalid ZEGO token effective time");
        }

        long currentEpoch = LocalDateTime.now().toEpochSecond(ZoneOffset.UTC);
        long expireEpoch = currentEpoch + effectiveTimeInSeconds;

        Map<String, Object> tokenInfo = new LinkedHashMap<>();
        tokenInfo.put("app_id", appId);
        tokenInfo.put("user_id", userId);
        tokenInfo.put("ctime", currentEpoch);
        tokenInfo.put("expire", expireEpoch);
        tokenInfo.put("nonce", ThreadLocalRandom.current().nextInt());
        tokenInfo.put("payload", payload);

        try {
            String content = objectMapper.writeValueAsString(tokenInfo);
            byte[] iv = new byte[ZEGO_IV_LENGTH];
            secureRandom.nextBytes(iv);

            byte[] encrypted = encryptTokenPayload(content.getBytes(StandardCharsets.UTF_8), secret.getBytes(StandardCharsets.UTF_8), iv);

            ByteBuffer buffer = ByteBuffer.allocate(8 + 2 + iv.length + 2 + encrypted.length)
                    .order(ByteOrder.BIG_ENDIAN);
            buffer.putLong(expireEpoch);
            packBytes(buffer, iv);
            packBytes(buffer, encrypted);

            return ZEGO_TOKEN_VERSION + Base64.getEncoder().encodeToString(buffer.array());
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to generate ZEGO token04", ex);
        }
    }

    private byte[] encryptTokenPayload(byte[] plainText, byte[] secretKey, byte[] ivBytes) throws Exception {
        Cipher cipher = Cipher.getInstance(ZEGO_TRANSFORMATION);
        SecretKeySpec keySpec = new SecretKeySpec(secretKey, "AES");
        IvParameterSpec ivSpec = new IvParameterSpec(ivBytes);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec);
        return cipher.doFinal(plainText);
    }

    private void packBytes(ByteBuffer target, byte[] source) {
        if (source.length > 65535) {
            throw new IllegalArgumentException("Token field too large");
        }

        target.putShort((short) source.length);
        target.put(source);
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
