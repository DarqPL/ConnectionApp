package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.AttachmentType;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.dto.AttachmentRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.Message;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Attachment;
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
import iuh.fit.ConnectionAppBackend.repo.FriendRepository;
import iuh.fit.ConnectionAppBackend.repo.MessageRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
import java.util.stream.Collectors;

@Service
public class MessageService {

    private static final int MAX_ATTACHMENTS_PER_MESSAGE = 5;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationUserRepository conversationUserRepository;

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

        validatePrivateConversationBlock(conversation, senderId);

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + senderId));

        String normalizedContent = request.getContent() == null ? "" : request.getContent().trim();
        List<Attachment> normalizedAttachments = mapAndValidateAttachments(request.getAttachments());

        if (!StringUtils.hasText(normalizedContent) && normalizedAttachments.isEmpty()) {
            throw new BadRequestException("Message must contain text or attachments");
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
                .isDeleted(false)
                .createdAt(LocalDateTime.now())
                .build();


        Message savedMessage = messageRepository.save(message);

        // Increment unread counts for other members
        conversationUserRepository.incrementUnreadCount(request.getConversationId(), senderId);

        MessageResponse response = mapToMessageResponse(savedMessage);

        // Broadcast to conversation topic (keep legacy destination for compatibility)
        messagingTemplate.convertAndSend("/topic/conversation/" + request.getConversationId(), response);
        messagingTemplate.convertAndSend("/topic/conversation" + request.getConversationId(), response);

        // Also notify each participant via their personal topic
        List<ConversationUser> members = conversationUserRepository.findByConversationId(request.getConversationId());
        boolean senderNotified = false;
        for (ConversationUser member : members) {
            Long memberUserId = member.getUser().getId();
            messagingTemplate.convertAndSend("/topic/user." + memberUserId, response);
            if (memberUserId.equals(senderId)) {
                senderNotified = true;
            }
        }

        // Ensure sender's all devices (web/mobile) receive realtime event even if membership query omits sender
        if (!senderNotified) {
            messagingTemplate.convertAndSend("/topic/user." + senderId, response);
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

        return messages.map(this::mapToMessageResponse);
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
        return messages.stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get unread message count
     */
    public long getUnreadMessageCount(Long conversationId, Long userId) {
        return messageRepository.countUnreadMessages(conversationId, userId);
    }

    /**
     * Map Message entity to MessageResponse DTO
     */
    private MessageResponse mapToMessageResponse(Message message) {
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

        // Build reply info if parentId exists
        MessageResponse.ReplyInfoResponse replyInfo = null;
        if (message.getParentId() != null) {
            replyInfo = messageRepository.findById(message.getParentId())
                    .map(parent -> {
                        boolean parentRecalled = parent.getRecalledAt() != null;
                        List<MessageResponse.AttachmentResponse> parentAttachments = parentRecalled
                                ? Collections.emptyList()
                                : (parent.getAttachments() == null ? Collections.emptyList()
                                    : parent.getAttachments().stream()
                                        .map(a -> MessageResponse.AttachmentResponse.builder()
                                                .fileUrl(a.getFileUrl())
                                                .type(a.getType() == null ? AttachmentType.FILE.name() : a.getType().name())
                                                .originalFileName(resolveOriginalFileName(a.getOriginalFileName(), a.getFileUrl()))
                                                .build())
                                        .collect(Collectors.toList()));
                        return MessageResponse.ReplyInfoResponse.builder()
                                .parentId(parent.getId())
                                .parentContent(parentRecalled ? null : parent.getContent())
                                .parentSenderName(parent.getSenderInfo().getDisplayName())
                                .parentAttachments(parentAttachments)
                                .parentRecalled(parentRecalled)
                                .build();
                    })
                    .orElse(null);
        }

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
