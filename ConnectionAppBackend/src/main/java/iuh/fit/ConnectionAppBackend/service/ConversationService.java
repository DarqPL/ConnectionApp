package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.ConversationRole;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationUserResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationUser;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.ConversationRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationUserRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ConversationService {

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private ConversationUserRepository conversationUserRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Get all conversations for a user with pagination
     */
    public Page<ConversationResponse> getUserConversations(Long userId, Pageable pageable) {
        List<Conversation> conversations = conversationRepository.findAllByUserId(userId);
        
        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), conversations.size());
        List<Conversation> pageContent = conversations.subList(start, end);

        List<ConversationResponse> responses = pageContent.stream()
                .map(this::mapToConversationResponse)
                .collect(Collectors.toList());

        return new PageImpl<>(responses, pageable, conversations.size());
    }

    /**
     * Get conversation by ID
     */
    public ConversationResponse getConversationById(Long conversationId, Long userId) {
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        Conversation conversation = conversationRepository.findByIdWithUsers(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        return mapToConversationResponse(conversation);
    }

    /**
     * Create a new conversation
     */
    @Transactional
    public ConversationResponse createConversation(Long creatorId, ConversationRequest request) {
        User creator = userRepository.findById(creatorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + creatorId));

        ConversationType type = ConversationType.PRIVATE;
        if (request.getType() != null && !request.getType().isEmpty()) {
            type = ConversationType.valueOf(request.getType().toUpperCase());
        }

        // Avoid duplicate private conversations
        if (type == ConversationType.PRIVATE && request.getParticipantIds() != null && request.getParticipantIds().length == 1) {
            Long participantId = request.getParticipantIds()[0];
            List<Conversation> existing = conversationRepository.findPrivateConversation(creatorId, participantId);
            if (!existing.isEmpty()) {
                return mapToConversationResponse(existing.get(0)); // Return existing
            }
        }

        Conversation conversation = Conversation.builder()
                .name(request.getName())
                .type(type)
                .createdBy(creator)
                .activate(true)
                .createdAt(LocalDateTime.now())
                .build();

        Conversation savedConversation = conversationRepository.save(conversation);

        // Add creator as member
        ConversationUser conversationUser = ConversationUser.builder()
                .conversation(savedConversation)
                .user(creator)
                .role(ConversationRole.OWNER)
                .joinedAt(LocalDateTime.now())
                .unreadCounts(0L)
                .build();
        conversationUserRepository.save(conversationUser);

        // Add other participants
        if (request.getParticipantIds() != null && request.getParticipantIds().length > 0) {
            for (Long participantId : request.getParticipantIds()) {
                if (!participantId.equals(creatorId)) {
                    User participant = userRepository.findById(participantId)
                            .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + participantId));

                    ConversationUser member = ConversationUser.builder()
                            .conversation(savedConversation)
                            .user(participant)
                            .role(ConversationRole.MEMBER)
                            .joinedAt(LocalDateTime.now())
                            .unreadCounts(0L)
                            .build();
                    conversationUserRepository.save(member);
                }
            }
        }

        // Flush and clear persistence context so re-fetch gets fresh data with participants
        entityManager.flush();
        entityManager.clear();

        // Re-fetch conversation with participants loaded to return complete response
        Conversation fullConversation = conversationRepository.findByIdWithUsers(savedConversation.getId())
                .orElse(savedConversation);

        ConversationResponse response = mapToConversationResponse(fullConversation);

        // Notify all participants about the new conversation via WebSocket
        List<ConversationUser> members = conversationUserRepository.findByConversationId(savedConversation.getId());
        for (ConversationUser member : members) {
            messagingTemplate.convertAndSend("/topic/user." + member.getUser().getId() + "/conversations", response);
        }

        return response;
    }

    /**
     * Update conversation
     */
    @Transactional
    public ConversationResponse updateConversation(Long conversationId, Long userId, ConversationRequest request) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        // Check if user is owner or co-owner
        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!conversationUser.getRole().equals(ConversationRole.OWNER) && 
            !conversationUser.getRole().equals(ConversationRole.CO_OWNER)) {
            throw new UnauthorizedException("Only owner or co-owner can update conversation");
        }

        if (request.getName() != null && !request.getName().isEmpty()) {
            conversation.setName(request.getName());
        }

        conversation.setUpdateAt(LocalDateTime.now());
        Conversation updatedConversation = conversationRepository.save(conversation);

        return mapToConversationResponse(updatedConversation);
    }

    /**
     * Delete conversation (soft delete)
     */
    @Transactional
    public void deleteConversation(Long conversationId, Long userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!conversationUser.getRole().equals(ConversationRole.OWNER)) {
            throw new UnauthorizedException("Only owner can delete conversation");
        }

        conversation.setActivate(false);
        conversationRepository.save(conversation);
    }

    /**
     * Add user to conversation
     */
    @Transactional
    public void addUserToConversation(Long conversationId, Long userId, Long newMemberId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        // Check if user has permission
        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        // Check if new member is already in conversation
        if (conversationUserRepository.findByConversationIdAndUserId(conversationId, newMemberId).isPresent()) {
            throw new BadRequestException("User is already a member of this conversation");
        }

        User newMember = userRepository.findById(newMemberId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + newMemberId));

        ConversationUser newConversationUser = ConversationUser.builder()
                .conversation(conversation)
                .user(newMember)
                .role(ConversationRole.MEMBER)
                .joinedAt(LocalDateTime.now())
                .unreadCounts(0L)
                .build();

        conversationUserRepository.save(newConversationUser);
    }

    /**
     * Remove user from conversation
     */
    @Transactional
    public void removeUserFromConversation(Long conversationId, Long userId) {
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new BadRequestException("User is not a member of this conversation");
        }

        conversationUserRepository.deleteByConversationIdAndUserId(conversationId, userId);
    }

    /**
     * Mark conversation as read
     */
    @Transactional
    public void markAsRead(Long conversationId, Long userId) {
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (isMember) {
            conversationUserRepository.resetUnreadCount(conversationId, userId);
        }
    }

    /**
     * Map Conversation entity to ConversationResponse DTO
     */
    private ConversationResponse mapToConversationResponse(Conversation conversation) {
        List<ConversationUserResponse> participants = new ArrayList<>();
        
        if (conversation.getConversationUsers() != null && !conversation.getConversationUsers().isEmpty()) {
            participants = conversation.getConversationUsers().stream()
                    .map(this::mapToConversationUserResponse)
                    .collect(Collectors.toList());
        }

        return ConversationResponse.builder()
                .id(conversation.getId())
                .name(conversation.getName())
                .avatarUrl(conversation.getAvatarUrl())
                .type(conversation.getType() != null ? conversation.getType().name() : "PRIVATE")
                .lastMessageAt(conversation.getLastMessageAt())
                .lastMessageContent(conversation.getLastMessageContent())
                .activate(conversation.isActivate())
                .createdById(conversation.getCreatedBy() != null ? conversation.getCreatedBy().getId() : null)
                .createdByName(conversation.getCreatedBy() != null ? conversation.getCreatedBy().getDisplayName() : "")
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdateAt())
                .participants(participants)
                .build();
    }

    /**
     * Map ConversationUser entity to ConversationUserResponse DTO
     */
    private ConversationUserResponse mapToConversationUserResponse(ConversationUser conversationUser) {
        return ConversationUserResponse.builder()
                .id(conversationUser.getId())
                .userId(conversationUser.getUser().getId())
                .username(conversationUser.getUser().getUsername())
                .displayName(conversationUser.getUser().getDisplayName())
                .avatarUrl(conversationUser.getUser().getAvatarUrl())
                .role(conversationUser.getRole().name())
                .joinedAt(conversationUser.getJoinedAt())
                .unreadCounts(conversationUser.getUnreadCounts())
                .build();
    }
}
