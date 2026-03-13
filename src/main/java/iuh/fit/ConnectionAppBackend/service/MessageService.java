package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.dto.MessageRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.Message;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.Attachment;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.SenderInfo;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.ConversationUserRepository;
import iuh.fit.ConnectionAppBackend.repo.MessageRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class MessageService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationUserRepository conversationUserRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Send a message
     */
    @Transactional
    public MessageResponse sendMessage(Long senderId, MessageRequest request) {
        // Verify sender is member of conversation
        boolean isMember = conversationUserRepository.isMember(request.getConversationId(), senderId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + senderId));

        if (request.getContent() == null || request.getContent().isEmpty()) {
            throw new BadRequestException("Message content cannot be empty");
        }

        SenderInfo senderInfo = SenderInfo.builder()
                .senderId(sender.getId())
                .displayName(sender.getDisplayName())
                .avatarUrl(sender.getAvatarUrl())
                .build();

        Message message = Message.builder()
                .conversationId(request.getConversationId())
                .senderInfo(senderInfo)
                .content(request.getContent())
                .parentId(request.getParentId())
                .isDeleted(false)
                .createdAt(LocalDateTime.now())
                .build();


        Message savedMessage = messageRepository.save(message);

        // Increment unread counts for other members
        conversationUserRepository.incrementUnreadCount(request.getConversationId(), senderId);

        MessageResponse response = mapToMessageResponse(savedMessage);

        messagingTemplate.convertAndSend("/topic/conversation" + request.getConversationId(), response);

        return response;
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

        List<MessageResponse.AttachmentResponse> attachments = message.getAttachments().stream()
                .map(a -> MessageResponse.AttachmentResponse.builder()
                        .fileUrl(a.getFileUrl())
                        .type(a.getType().name())
                        .build())
                .collect(Collectors.toList());

        return MessageResponse.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .senderInfo(senderInfo)
                .content(message.getContent())
                .attachments(attachments)
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdateAt())
                .parentId(message.getParentId())
                .isDeleted(message.isDeleted())
                .build();
    }
}
