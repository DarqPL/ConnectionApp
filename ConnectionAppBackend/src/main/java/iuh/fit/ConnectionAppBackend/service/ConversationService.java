package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.ConversationRole;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationUserResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationUser;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.ConversationRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationUserRepository;
import iuh.fit.ConnectionAppBackend.repo.MessageRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
    private MessageRepository messageRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    @Lazy
    private MessageService messageService;

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

        // 🔥 Send real-time notification to all members
        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        if (!allMembers.isEmpty()) {
            ConversationResponse response = mapToConversationResponse(updatedConversation);
            
            Map<String, Object> update = new java.util.HashMap<>();
            update.put("conversationId", conversationId);
            update.put("type", "CONVERSATION_UPDATED");
            update.put("name", updatedConversation.getName());
            update.put("updatedConversation", response);

            // Notify all members
            for (ConversationUser m : allMembers) {
                // Send update notification
                messagingTemplate.convertAndSend(
                        "/topic/user." + m.getUser().getId() + "/conversation-updates",
                        update
                );
                
                // Also update the conversation in their main list
                messagingTemplate.convertAndSend(
                        "/topic/user." + m.getUser().getId() + "/conversations",
                        response
                );
            }
        }

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

        // 🔥 Send real-time notification to all members (including new one)
        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        if (!allMembers.isEmpty()) {
            List<ConversationUserResponse> updatedParticipants = allMembers.stream()
                    .map(this::mapToConversationUserResponse)
                    .collect(Collectors.toList());

            Map<String, Object> update = new java.util.HashMap<>();
            update.put("conversationId", conversationId);
            update.put("type", "MEMBER_JOINED");
            update.put("participants", updatedParticipants);
            update.put("joinedUserId", newMemberId); // ID of user who joined

            // Notify existing members about the update, and send full conversation to the new member
            ConversationResponse fullConvo = mapToConversationResponse(conversation);
            for (ConversationUser member : allMembers) {
                Long mUserId = member.getUser().getId();
                
                // If this is the new member, send the full conversation object so it appears in their list
                if (mUserId.equals(newMemberId)) {
                    messagingTemplate.convertAndSend("/topic/user." + mUserId + "/conversations", fullConvo);
                }
                
                // Always send the update notification (for participants list, etc.)
                messagingTemplate.convertAndSend(
                        "/topic/user." + mUserId + "/conversation-updates",
                        update
                );
            }
        }
    }

    /**
     * Remove user from conversation or Leave conversation
     * @param conversationId
     * @param requesterId the user who initiated the action
     * @param targetUserId the user to be removed (or leaving)
     */
    @Transactional
    public void removeUserFromConversation(Long conversationId, Long requesterId, Long targetUserId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        // 1. Verify requester is a member
        ConversationUser requester = conversationUserRepository.findByConversationIdAndUserId(conversationId, requesterId)
                .orElseThrow(() -> new BadRequestException("You are not a member of this conversation"));

        // 2. If removing someone else, check permissions
        if (!requesterId.equals(targetUserId)) {
            if (requester.getRole() != ConversationRole.OWNER && requester.getRole() != ConversationRole.CO_OWNER) {
                throw new BadRequestException("Only owner or co-owners can remove members");
            }
            
            // Cannot remove the owner
            ConversationUser targetMember = conversationUserRepository.findByConversationIdAndUserId(conversationId, targetUserId)
                    .orElseThrow(() -> new BadRequestException("Target user is not a member of this conversation"));
            
            if (targetMember.getRole() == ConversationRole.OWNER) {
                throw new BadRequestException("Cannot remove the owner of the group");
            }

            // Co-owners cannot remove other co-owners if requester is just co-owner? 
            // Usually, only OWNER can remove CO_OWNER.
            if (requester.getRole() == ConversationRole.CO_OWNER && targetMember.getRole() == ConversationRole.CO_OWNER) {
                 throw new BadRequestException("Co-owners cannot remove other co-owners");
            }
        }

        // 3. Perform removal
        conversationUserRepository.deleteByConversationIdAndUserId(conversationId, targetUserId);

        // Check remaining members
        List<ConversationUser> remainingMembers = conversationUserRepository.findByConversationId(conversationId);

        // If no members left and it's a GROUP, soft delete the conversation
        if (remainingMembers.isEmpty() && conversation.getType() == ConversationType.GROUP) {
            conversation.setActivate(false);
            conversationRepository.save(conversation);
            return;
        }

        // 🔥 Send real-time notification to all remaining members (and the removed user to clear their list?)
        // The removed user should also be notified to hide the conversation.
        
        List<ConversationUserResponse> updatedParticipants = remainingMembers.stream()
                .map(this::mapToConversationUserResponse)
                .collect(Collectors.toList());

        Map<String, Object> update = new java.util.HashMap<>();
        update.put("conversationId", conversationId);
        update.put("type", "MEMBER_LEFT");
        update.put("participants", updatedParticipants);
        update.put("leftUserId", targetUserId); // ID of user who left or was removed

        // Notify all remaining members
        for (ConversationUser member : remainingMembers) {
            messagingTemplate.convertAndSend(
                    "/topic/user." + member.getUser().getId() + "/conversation-updates",
                    update
            );
        }
        
        // Notify the removed user too
        messagingTemplate.convertAndSend(
                "/topic/user." + targetUserId + "/conversation-updates",
                update
        );
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
     * Update member role in conversation
     */
    @Transactional
    public void updateMemberRole(Long conversationId, Long userId, Long memberId, String newRole) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        // Check if requester is owner
        ConversationUser requester = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!requester.getRole().equals(ConversationRole.OWNER)) {
            throw new UnauthorizedException("Only owner can change member roles");
        }

        // Check if member exists
        ConversationUser member = conversationUserRepository.findByConversationIdAndUserId(conversationId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException("User is not a member of this conversation"));

        // Cannot demote owner
        if (member.getRole().equals(ConversationRole.OWNER)) {
            throw new BadRequestException("Cannot change the role of the owner");
        }

        // Update role
        ConversationRole role = ConversationRole.valueOf(newRole.toUpperCase());
        member.setRole(role);
        conversationUserRepository.save(member);

        // 🔥 Send real-time notification to all members
        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        if (!allMembers.isEmpty()) {
            List<ConversationUserResponse> updatedParticipants = allMembers.stream()
                    .map(this::mapToConversationUserResponse)
                    .collect(Collectors.toList());

            Map<String, Object> update = new java.util.HashMap<>();
            update.put("conversationId", conversationId);
            update.put("type", "ROLE_UPDATED");
            update.put("participants", updatedParticipants);
            update.put("roleUpdatedUserId", memberId); // ID of user whose role changed
            update.put("newRole", newRole);

            // Notify all members
            for (ConversationUser m : allMembers) {
                messagingTemplate.convertAndSend(
                        "/topic/user." + m.getUser().getId() + "/conversation-updates",
                        update
                );
            }
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

        List<MessageResponse> pinnedMessages = new ArrayList<>();
        if (StringUtils.hasText(conversation.getPinnedMessageIds())) {
            String[] ids = conversation.getPinnedMessageIds().split(",");
            for (String id : ids) {
                messageRepository.findById(id).ifPresent(msg -> {
                    pinnedMessages.add(messageService.mapToMessageResponse(msg));
                });
            }
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
                .pinnedMessages(pinnedMessages)
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
