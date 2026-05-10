package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.AttachmentType;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationRole;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.dto.AiRewriteRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.AiRewriteResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.AttachmentRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.PollRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.PollResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.ReminderResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.Message;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Attachment;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.MessageReaction;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Poll;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.PollOption;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.ReminderInfo;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.SenderInfo;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationUser;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.AccountTemporarilyLockedException;
import iuh.fit.ConnectionAppBackend.exception.ChatBlockedException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.ConversationRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationUserRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationBlockedUserRepository;
import iuh.fit.ConnectionAppBackend.repo.FriendRepository;
import iuh.fit.ConnectionAppBackend.repo.MessageRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MessageService {

    private static final int MAX_ATTACHMENTS_PER_MESSAGE = 5;
    private static final Set<String> ALLOWED_REACTION_CODES = Set.of(
            "👍", "❤️", "😆", "😮", "😢", "😡"
    );

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationUserRepository conversationUserRepository;

    @Autowired
    private ConversationBlockedUserRepository conversationBlockedUserRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private FriendRepository friendRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private GroupMediaSafetyService groupMediaSafetyService;

    @Autowired
    private UserService userService;

    @Autowired
    private SecurityNotificationService securityNotificationService;

    @Autowired
    private MessageAiRewriteService messageAiRewriteService;

    /**
     * Send a message
     */
    @Transactional
    public MessageResponse sendMessage(Long senderId, MessageRequest request) {
        if (request.getConversationId() == null) {
            throw new BadRequestException("Conversation ID is required");
        }

        Conversation conversation = conversationRepository.findById(request.getConversationId())
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + request.getConversationId()));

        // Verify sender is member of conversation
        boolean isMember = conversationUserRepository.isMember(request.getConversationId(), senderId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        // Check if sender is blocked
        if (conversationBlockedUserRepository.existsByConversationIdAndUserId(request.getConversationId(), senderId)) {
            throw new UnauthorizedException("You have been blocked from this group");
        }

        // Check if sender can send messages (group settings)
        if (conversation.getType() == ConversationType.GROUP) {
            if (!conversation.isAllowMemberSendMessage()) {
                ConversationUser senderRole = conversationUserRepository.findByConversationIdAndUserId(
                        request.getConversationId(), senderId).orElse(null);
                if (senderRole != null && senderRole.getRole() != ConversationRole.OWNER && senderRole.getRole() != ConversationRole.CO_OWNER) {
                    throw new UnauthorizedException("Only owner and co-owners can send messages in this group");
                }
            }
        }

        validatePrivateConversationBlock(conversation, senderId);

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + senderId));

        String normalizedContent = request.getContent() == null ? "" : request.getContent().trim();
        List<Attachment> normalizedAttachments = mapAndValidateAttachments(request.getAttachments());

        if (!StringUtils.hasText(normalizedContent) && normalizedAttachments.isEmpty() && request.getPoll() == null) {
            throw new BadRequestException("Message must contain text, attachments, or a poll");
        }

        if (groupMediaSafetyService.shouldScanConversation(conversation.getType())) {
            GroupMediaSafetyService.SafetyVerdict verdict = groupMediaSafetyService.scanGroupMedia(normalizedAttachments);
            if (verdict.blocked()) {
            UserService.TemporaryLockInfo lockInfo = userService.lockAccountTemporarily(senderId, "POLICY_VIOLATION_MEDIA_SAFETY");
            securityNotificationService.notifyAccountTemporarilyLocked(
                senderId,
                lockInfo.lockUntil(),
                lockInfo.remainingMinutes(),
                lockInfo.reason()
            );

            throw new AccountTemporarilyLockedException(
                "Bạn đã vi phạm chính sách của chúng tôi. Tài khoản bị khóa tạm thời trong "
                    + lockInfo.remainingMinutes()
                    + " phút.",
                lockInfo.remainingMinutes(),
                lockInfo.lockUntil()
            );
            }
        }

        SenderInfo senderInfo = SenderInfo.builder()
                .senderId(sender.getId())
                .displayName(sender.getDisplayName())
                .avatarUrl(sender.getAvatarUrl())
                .build();

        Message message = Message.builder()
                .conversationId(request.getConversationId())
                .senderInfo(senderInfo)
            .content(StringUtils.hasText(normalizedContent) ? normalizedContent : null)
                .attachments(normalizedAttachments)
                .parentId(request.getParentId())
                .poll(mapPollRequestToEntity(request.getPoll()))
                .isDeleted(false)
                .createdAt(LocalDateTime.now())
                .build();


        Message savedMessage = messageRepository.save(message);

        // Increment unread counts for other members
        conversationUserRepository.incrementUnreadCount(request.getConversationId(), senderId);

        MessageResponse response = mapToMessageResponse(savedMessage);

        // Broadcast strictly through each member's personal topic to avoid duplicate deliveries.
        List<Long> memberIds = conversationUserRepository.findMemberIdsByConversationId(request.getConversationId());
        for (Long memberUserId : memberIds) {
            messagingTemplate.convertAndSend("/topic/user." + memberUserId, response);
        }

        return response;
    }

    private void validatePrivateConversationBlock(Conversation conversation, Long senderId) {
        if (conversation.getType() != ConversationType.PRIVATE) {
            return;
        }

        Long conversationId = conversation.getId();

        List<ConversationUser> members = conversationUserRepository.findByConversationId(conversationId);
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

        if (blockedByOther) {
            throw new ChatBlockedException("Bạn đã bị chặn");
        }

        if (blockedByMe) {
            throw new ChatBlockedException("Bạn đã chặn người dùng này");
        }
    }

    /**
     * Get messages in a conversation with pagination
     */
    public Page<MessageResponse> getMessages(Long conversationId, Long userId, Pageable pageable) {
        // Verify user is member of conversation
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        Page<Message> messages = messageRepository
                .findByConversationIdAndIsDeletedFalseOrderByCreatedAtDesc(conversationId, pageable);

        Map<String, Message> parentMessagesById = preloadParentMessages(messages.getContent());
        return messages.map(message -> mapToMessageResponse(message, parentMessagesById));
    }

    /**
     * Get a specific message
     */
    public MessageResponse getMessageById(String messageId, Long userId) {
        Message message = messageRepository.findByIdAndIsDeletedFalse(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));

        // Verify user is member of conversation
        boolean isMember = conversationUserRepository.isMember(message.getConversationId(), userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        return mapToMessageResponse(message);
    }

    /**
     * Edit message
     */
    @Transactional
    public MessageResponse editMessage(String messageId, Long userId, String newContent) {
        Message message = messageRepository.findByIdAndIsDeletedFalse(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));

        // Check if user is the sender
        if (!message.getSenderInfo().getSenderId().equals(userId)) {
            throw new UnauthorizedException("User can only edit their own messages");
        }

        if (newContent == null || newContent.isEmpty()) {
            throw new BadRequestException("Message content cannot be empty");
        }

        message.setContent(newContent);
        message.setUpdateAt(LocalDateTime.now());

        Message updatedMessage = messageRepository.save(message);
        return mapToMessageResponse(updatedMessage);
    }

    /**
     * Delete message (soft delete)
     */
    @Transactional
    public void deleteMessage(String messageId, Long userId) {
        Message message = messageRepository.findByIdAndIsDeletedFalse(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));

        // Check if user is the sender
        if (!message.getSenderInfo().getSenderId().equals(userId)) {
            throw new UnauthorizedException("User can only delete their own messages");
        }

        message.setIsDeleted(true);
        message.setUpdateAt(LocalDateTime.now());
        messageRepository.save(message);
    }

    /**
     * Recall (unsend) a message
     */
    @Transactional
    public MessageResponse recallMessage(String messageId, Long userId) {
        Message message = messageRepository.findByIdAndIsDeletedFalse(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));

        // Check if user is the sender
        if (!message.getSenderInfo().getSenderId().equals(userId)) {
            throw new UnauthorizedException("User can only recall their own messages");
        }

        // Check if message is already recalled
        if (message.getRecalledAt() != null) {
            throw new BadRequestException("Message is already recalled");
        }

        message.setRecalledAt(LocalDateTime.now());
        message.setContent(null);
        message.setAttachments(new java.util.ArrayList<>());
        message.setUpdateAt(LocalDateTime.now());

        Message updatedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(updatedMessage);

        // Broadcast recall to all members via WebSocket
        List<ConversationUser> members = conversationUserRepository.findByConversationId(message.getConversationId());
        for (ConversationUser member : members) {
            messagingTemplate.convertAndSend("/topic/user." + member.getUser().getId() + "/recall", response);
        }

        return response;
    }

    @Transactional
    public MessageResponse reactToMessage(String messageId, Long userId, String reactionCode) {
        Message message = messageRepository.findByIdAndIsDeletedFalse(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));

        validateReactionPermission(message, userId);

        String normalizedReactionCode = normalizeReactionCode(reactionCode);
        boolean changed = applyReactionUpdate(message, userId, normalizedReactionCode);
        if (!changed) {
            return mapToMessageResponse(message);
        }

        Message updatedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(updatedMessage);
        broadcastReactionUpdate(updatedMessage.getConversationId(), response);
        return response;
    }

    @Transactional
    public MessageResponse removeReaction(String messageId, Long userId) {
        Message message = messageRepository.findByIdAndIsDeletedFalse(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));

        validateReactionPermission(message, userId);

        boolean changed = applyReactionUpdate(message, userId, null);
        if (!changed) {
            return mapToMessageResponse(message);
        }

        Message updatedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(updatedMessage);
        broadcastReactionUpdate(updatedMessage.getConversationId(), response);
        return response;
    }

    private void validateReactionPermission(Message message, Long userId) {
        boolean isMember = conversationUserRepository.isMember(message.getConversationId(), userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        Conversation conversation = conversationRepository.findById(message.getConversationId())
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + message.getConversationId()));

        validatePrivateConversationBlock(conversation, userId);

        if (message.getRecalledAt() != null) {
            throw new BadRequestException("Cannot react to a recalled message");
        }
    }

    private String normalizeReactionCode(String reactionCode) {
        if (!StringUtils.hasText(reactionCode)) {
            throw new BadRequestException("Reaction code is required");
        }

        String normalized = reactionCode.trim();
        if (!ALLOWED_REACTION_CODES.contains(normalized)) {
            throw new BadRequestException("Unsupported reaction code");
        }

        return normalized;
    }

    private boolean applyReactionUpdate(Message message, Long userId, String reactionCodeOrNull) {
        List<MessageReaction> nextReactions =
                message.getReactions() == null ? new ArrayList<>() : new ArrayList<>(message.getReactions());

        MessageReaction existingReaction = nextReactions.stream()
                .filter(reaction -> Objects.equals(reaction.getUserId(), userId))
                .findFirst()
                .orElse(null);

        if (reactionCodeOrNull == null) {
            if (existingReaction == null) {
                return false;
            }

            nextReactions.removeIf(reaction -> Objects.equals(reaction.getUserId(), userId));
            message.setReactions(nextReactions);
            message.setUpdateAt(LocalDateTime.now());
            return true;
        }

        if (existingReaction != null && reactionCodeOrNull.equals(existingReaction.getReactionCode())) {
            nextReactions.removeIf(reaction -> Objects.equals(reaction.getUserId(), userId));
            message.setReactions(nextReactions);
            message.setUpdateAt(LocalDateTime.now());
            return true;
        }

        if (existingReaction != null) {
            existingReaction.setReactionCode(reactionCodeOrNull);
            existingReaction.setReactedAt(LocalDateTime.now());
            message.setReactions(nextReactions);
            message.setUpdateAt(LocalDateTime.now());
            return true;
        }

        nextReactions.add(MessageReaction.builder()
                .userId(userId)
                .reactionCode(reactionCodeOrNull)
                .reactedAt(LocalDateTime.now())
                .build());
        message.setReactions(nextReactions);
        message.setUpdateAt(LocalDateTime.now());
        return true;
    }

    private void broadcastReactionUpdate(Long conversationId, MessageResponse response) {
        List<ConversationUser> members = conversationUserRepository.findByConversationId(conversationId);
        for (ConversationUser member : members) {
            if (member.getUser() != null) {
                messagingTemplate.convertAndSend(
                        "/topic/user." + member.getUser().getId() + "/reactions",
                        response
                );
            }
        }
    }

    @Transactional
    public MessageResponse vote(String messageId, Long userId, List<String> optionIds) {
        Message message = messageRepository.findByIdAndIsDeletedFalse(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));

        if (message.getPoll() == null) {
            throw new BadRequestException("This message is not a poll");
        }

        if (message.getPoll().isClosed()) {
            throw new BadRequestException("Poll is closed");
        }

        if (message.getPoll().getExpiredAt() != null && message.getPoll().getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Poll has expired");
        }

        // Verify user is member of conversation
        boolean isMember = conversationUserRepository.isMember(message.getConversationId(), userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        Poll poll = message.getPoll();
        boolean multiChoice = poll.isMultiChoice();

        if (optionIds == null) {
            optionIds = new ArrayList<>();
        }

        if (!multiChoice && optionIds.size() > 1) {
            throw new BadRequestException("This poll only allows a single choice");
        }

        // Clear previous votes for this user in all options and ensure list is initialized
        for (PollOption option : poll.getOptions()) {
            if (option.getVoterIds() == null) {
                option.setVoterIds(new ArrayList<>());
            }
            option.getVoterIds().remove(userId);
        }

        // Add new votes
        for (PollOption option : poll.getOptions()) {
            if (optionIds.contains(option.getId())) {
                if (option.getVoterIds() == null) {
                    option.setVoterIds(new ArrayList<>());
                }
                option.getVoterIds().add(userId);
            }
        }

        // BUMP the message to the end of conversation
        message.setUpdateAt(LocalDateTime.now());

        Message updatedMessage = messageRepository.save(message);
        
        // Update conversation last message timestamp to bump conversation list
        conversationRepository.findById(message.getConversationId()).ifPresent(convo -> {
            convo.setLastMessageAt(LocalDateTime.now());
            conversationRepository.save(convo);
        });

        MessageResponse response = mapToMessageResponse(updatedMessage);

        // Broadcast update to all members via their personal topics
        List<ConversationUser> members = conversationUserRepository.findByConversationId(message.getConversationId());
        for (ConversationUser member : members) {
            if (member.getUser() != null) {
                messagingTemplate.convertAndSend("/topic/user." + member.getUser().getId(), response);
            }
        }

        return response;
    }

    @Transactional
    public MessageResponse closePoll(String messageId, Long userId) {
        Message message = messageRepository.findByIdAndIsDeletedFalse(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));

        if (message.getPoll() == null) {
            throw new BadRequestException("This message is not a poll");
        }

        // Only creator can close the poll
        if (!message.getSenderInfo().getSenderId().equals(userId)) {
            throw new UnauthorizedException("Only the creator can close this poll");
        }

        message.getPoll().setClosed(true);
        message.setUpdateAt(LocalDateTime.now());

        Message updatedMessage = messageRepository.save(message);
        MessageResponse response = mapToMessageResponse(updatedMessage);

        // Broadcast update to all members via their personal topics
        List<ConversationUser> members = conversationUserRepository.findByConversationId(message.getConversationId());
        for (ConversationUser member : members) {
            if (member.getUser() != null) {
                messagingTemplate.convertAndSend("/topic/user." + member.getUser().getId(), response);
            }
        }

        return response;
    }

    @Transactional
    public MessageResponse pinMessage(Long conversationId, Long userId, String messageId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        // Verify user is member
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found"));

        String pinnedIds = conversation.getPinnedMessageIds();
        List<String> idList = new ArrayList<>();
        if (StringUtils.hasText(pinnedIds)) {
            idList = new ArrayList<>(List.of(pinnedIds.split(",")));
        }

        if (!idList.contains(messageId)) {
            idList.add(messageId);
            conversation.setPinnedMessageIds(String.join(",", idList));
            conversationRepository.save(conversation);
        }

        MessageResponse response = mapToMessageResponse(message);

        // Notify members about conversation update (pinned messages changed)
        broadcastConversationUpdate(conversationId);

        return response;
    }

    @Transactional
    public void unpinMessage(Long conversationId, Long userId, String messageId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        // Verify user is member
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        String pinnedIds = conversation.getPinnedMessageIds();
        if (StringUtils.hasText(pinnedIds)) {
            List<String> idList = new ArrayList<>(List.of(pinnedIds.split(",")));
            if (idList.remove(messageId)) {
                conversation.setPinnedMessageIds(idList.isEmpty() ? null : String.join(",", idList));
                conversationRepository.save(conversation);
                
                // Notify members
                broadcastConversationUpdate(conversationId);
            }
        }
    }

    private void broadcastConversationUpdate(Long conversationId) {
        // Fetch updated conversation response
        // We'll use a simplified update notification for now
        // or a full conversation update if needed.
        // For simplicity, let's just trigger a reload signal or send the updated pinned messages list.
        
        List<ConversationUser> members = conversationUserRepository.findByConversationId(conversationId);
        Map<String, Object> update = new java.util.HashMap<>();
        update.put("conversationId", conversationId);
        update.put("type", "PIN_UPDATE");
        
        for (ConversationUser member : members) {
            if (member.getUser() != null) {
                messagingTemplate.convertAndSend("/topic/user." + member.getUser().getId() + "/conversation-updates", update);
            }
        }
    }

    /**
     * Search messages
     */
    public List<MessageResponse> searchMessages(Long conversationId, Long userId, String searchTerm) {
        // Verify user is member of conversation
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        List<Message> messages = messageRepository.searchByContent(conversationId, searchTerm);
        Map<String, Message> parentMessagesById = preloadParentMessages(messages);
        return messages.stream()
                .map(message -> mapToMessageResponse(message, parentMessagesById))
                .collect(Collectors.toList());
    }

    /**
     * Get unread message count
     */
    public long getUnreadMessageCount(Long conversationId, Long userId) {
        return messageRepository.countUnreadMessages(conversationId, userId);
    }

    public AiRewriteResponse aiRewriteDraft(Long userId, AiRewriteRequest request) {
        if (request == null) {
            throw new BadRequestException("AI Rewrite payload is required");
        }

        if (request.getConversationId() == null) {
            throw new BadRequestException("Conversation ID is required");
        }

        Conversation conversation = conversationRepository.findById(request.getConversationId())
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + request.getConversationId()));

        boolean isMember = conversationUserRepository.isMember(request.getConversationId(), userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        validatePrivateConversationBlock(conversation, userId);

        Pageable pageable = PageRequest.of(
                0,
                messageAiRewriteService.getMaxContextMessages(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        List<Message> recentMessages = messageRepository
                .findByConversationIdAndIsDeletedFalseOrderByCreatedAtDesc(request.getConversationId(), pageable)
                .getContent();

        return messageAiRewriteService.rewriteDraft(request, recentMessages, conversation.getType());
    }

    /**
     * Map Message entity to MessageResponse DTO
     */
    public MessageResponse mapToMessageResponse(Message message) {
        return mapToMessageResponse(message, Collections.emptyMap());
    }

    private MessageResponse mapToMessageResponse(Message message, Map<String, Message> parentMessagesById) {
        MessageResponse.SenderInfoResponse senderInfo = MessageResponse.SenderInfoResponse.builder()
                .senderId(message.getSenderInfo().getSenderId())
                .displayName(message.getSenderInfo().getDisplayName())
                .avatarUrl(message.getSenderInfo().getAvatarUrl())
                .build();

        List<Attachment> messageAttachments =
            message.getAttachments() == null ? Collections.emptyList() : message.getAttachments();

        List<MessageResponse.AttachmentResponse> attachments = messageAttachments.stream()
                .map(a -> MessageResponse.AttachmentResponse.builder()
                        .fileUrl(a.getFileUrl())
                .type(a.getType() == null ? AttachmentType.FILE.name() : a.getType().name())
                .originalFileName(resolveOriginalFileName(a.getOriginalFileName(), a.getFileUrl()))
                        .build())
                .collect(Collectors.toList());

        List<MessageReaction> messageReactions =
            message.getReactions() == null ? Collections.emptyList() : message.getReactions();

        List<MessageResponse.MessageReactionResponse> reactions = messageReactions.stream()
            .map(r -> MessageResponse.MessageReactionResponse.builder()
                .userId(r.getUserId())
                .reactionCode(r.getReactionCode())
                .reactedAt(r.getReactedAt())
                .build())
            .collect(Collectors.toList());

        MessageResponse.ReplyInfoResponse replyInfo = buildReplyInfo(message, parentMessagesById);

        return MessageResponse.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .senderInfo(senderInfo)
                .content(message.getRecalledAt() != null ? null : message.getContent())
                .attachments(attachments)
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdateAt())
                .parentId(message.getParentId())
                .isDeleted(message.isDeleted())
                .recalledAt(message.getRecalledAt())
                .replyInfo(replyInfo)
                .poll(mapPollEntityToResponse(message.getPoll()))
                .reminder(mapReminderEntityToResponse(message.getReminder(), message.getConversationId(), message.getId(), message.getCreatedAt()))
                .reactions(reactions)
                .build();
    }

    private Map<String, Message> preloadParentMessages(List<Message> messages) {
        Set<String> parentIds = messages.stream()
                .map(Message::getParentId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (parentIds.isEmpty()) {
            return Collections.emptyMap();
        }

        return messageRepository.findAllById(parentIds).stream()
                .collect(Collectors.toMap(Message::getId, parent -> parent));
    }

    private MessageResponse.ReplyInfoResponse buildReplyInfo(Message message, Map<String, Message> parentMessagesById) {
        if (message.getParentId() == null) {
            return null;
        }

        Message parent = parentMessagesById.get(message.getParentId());
        if (parent == null) {
            parent = messageRepository.findById(message.getParentId()).orElse(null);
        }

        if (parent == null) {
            return null;
        }

        boolean parentRecalled = parent.getRecalledAt() != null;
        List<MessageResponse.AttachmentResponse> parentAttachments = parentRecalled
                ? Collections.emptyList()
                : mapAttachments(parent.getAttachments());

        return MessageResponse.ReplyInfoResponse.builder()
                .parentId(parent.getId())
                .parentContent(parentRecalled ? null : parent.getContent())
                .parentSenderName(parent.getSenderInfo().getDisplayName())
                .parentAttachments(parentAttachments)
                .parentRecalled(parentRecalled)
                .build();
    }

    private List<MessageResponse.AttachmentResponse> mapAttachments(List<Attachment> attachments) {
        List<Attachment> safeAttachments = attachments == null ? Collections.emptyList() : attachments;

        return safeAttachments.stream()
                .map(a -> MessageResponse.AttachmentResponse.builder()
                        .fileUrl(a.getFileUrl())
                        .type(a.getType() == null ? AttachmentType.FILE.name() : a.getType().name())
                        .originalFileName(resolveOriginalFileName(a.getOriginalFileName(), a.getFileUrl()))
                        .build())
                .collect(Collectors.toList());
    }

    private Poll mapPollRequestToEntity(PollRequest request) {
        if (request == null) return null;

        List<PollOption> options = new ArrayList<>();
        if (request.getOptions() != null) {
            for (int i = 0; i < request.getOptions().size(); i++) {
                options.add(PollOption.builder()
                        .id(String.valueOf(i))
                        .text(request.getOptions().get(i).getText())
                        .voterIds(new ArrayList<>())
                        .build());
            }
        }

        return Poll.builder()
                .question(request.getQuestion())
                .options(options)
                .multiChoice(request.isMultiChoice())
                .allowAddOptions(request.isAllowAddOptions())
                .isAnonymous(request.isAnonymous())
                .expiredAt(request.getExpiredAt())
                .build();
    }

    private PollResponse mapPollEntityToResponse(Poll poll) {
        if (poll == null) return null;

        List<PollResponse.PollOptionResponse> options = poll.getOptions().stream()
                .map(o -> PollResponse.PollOptionResponse.builder()
                        .id(o.getId())
                        .text(o.getText())
                        .voterIds(o.getVoterIds())
                        .build())
                .collect(Collectors.toList());

        return PollResponse.builder()
                .question(poll.getQuestion())
                .options(options)
                .multiChoice(poll.isMultiChoice())
                .allowAddOptions(poll.isAllowAddOptions())
                .isAnonymous(poll.isAnonymous())
                .closed(poll.isClosed())
                .expiredAt(poll.getExpiredAt())
                .build();
    }

    private ReminderResponse mapReminderEntityToResponse(ReminderInfo info, Long conversationId, String messageId, LocalDateTime createdAt) {
        if (info == null) return null;

        return ReminderResponse.builder()
                .id(messageId) // For embedded, we use messageId as the logical reminder ID
                .title(info.getTitle())
                .content(info.getContent())
                .reminderTime(info.getReminderTime())
                .isNotified(info.isNotified())
                .conversationId(conversationId)
                .creatorId(info.getCreatorId())
                .creatorName(info.getCreatorName())
                .participantIds(info.getParticipantIds())
                .declinedIds(info.getDeclinedIds())
                .createdAt(createdAt)
                .reminderGroupId(info.getReminderGroupId())
                .build();
    }

    private List<Attachment> mapAndValidateAttachments(List<AttachmentRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return new ArrayList<>();
        }

        if (requests.size() > MAX_ATTACHMENTS_PER_MESSAGE) {
            throw new BadRequestException("Maximum 5 attachments per message");
        }

        List<Attachment> attachments = new ArrayList<>();
        for (AttachmentRequest req : requests) {
            if (req == null || !StringUtils.hasText(req.getFileUrl())) {
                throw new BadRequestException("Attachment URL is required");
            }

            attachments.add(
                    Attachment.builder()
                            .fileUrl(req.getFileUrl().trim())
                            .type(resolveAttachmentType(req.getType()))
                        .originalFileName(resolveOriginalFileName(req.getOriginalFileName(), req.getFileUrl()))
                            .build()
            );
        }

        return attachments;
    }

    private AttachmentType resolveAttachmentType(String rawType) {
        if (!StringUtils.hasText(rawType)) {
            return AttachmentType.FILE;
        }

        try {
            return AttachmentType.valueOf(rawType.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Unsupported attachment type: " + rawType);
        }
    }

    private String resolveOriginalFileName(String rawFileName, String fileUrl) {
        if (StringUtils.hasText(rawFileName)) {
            return rawFileName.trim();
        }

        if (!StringUtils.hasText(fileUrl)) {
            return "attached-file";
        }

        try {
            URI parsed = URI.create(fileUrl);
            String path = parsed.getPath();
            if (!StringUtils.hasText(path)) {
                return "attached-file";
            }

            int index = path.lastIndexOf('/');
            String value = index >= 0 ? path.substring(index + 1) : path;
            if (!StringUtils.hasText(value)) {
                return "attached-file";
            }

            return URLDecoder.decode(value, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return "attached-file";
        }
    }
}
