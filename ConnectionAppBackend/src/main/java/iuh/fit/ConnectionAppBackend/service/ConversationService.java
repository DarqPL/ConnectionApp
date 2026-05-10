package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.ConversationRole;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationUserResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.GroupSettingsRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.GroupSettingsResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationUser;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationBlockedUser;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationPendingMember;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.ConversationRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationUserRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationBlockedUserRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationPendingMemberRepository;
import iuh.fit.ConnectionAppBackend.repo.MessageRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import iuh.fit.ConnectionAppBackend.domain.dto.ImageObjectResponse;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ConversationService {
    private static final int INVITE_TOKEN_LENGTH = 24;

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

    @Autowired
    private S3StorageService s3StorageService;

    @Autowired
    private ConversationBlockedUserRepository conversationBlockedUserRepository;

    @Autowired
    private ConversationPendingMemberRepository conversationPendingMemberRepository;

    /**
     * Get all conversations for a user with pagination
     */
    public Page<ConversationResponse> getUserConversations(Long userId, Pageable pageable) {
        return conversationRepository.findAllByUserId(userId, pageable)
                .map(this::mapToConversationResponse);
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

    public ConversationResponse resolveGroupInvite(String inviteToken) {
        Conversation conversation = conversationRepository.findByInviteTokenWithUsers(inviteToken)
                .orElseThrow(() -> new ResourceNotFoundException("Group invite link not found"));

        validateGroupInviteConversation(conversation);
        return mapToConversationResponse(conversation);
    }

    @Transactional
    public ConversationResponse joinConversationByInviteToken(String inviteToken, Long userId) {
        Conversation conversation = conversationRepository.findByInviteTokenWithUsers(inviteToken)
                .orElseThrow(() -> new ResourceNotFoundException("Group invite link not found"));

        validateGroupInviteConversation(conversation);

        if (!conversation.isAllowLinkJoin()) {
            throw new BadRequestException("This group does not allow joining via invite link");
        }

        if (conversationUserRepository.findByConversationIdAndUserId(conversation.getId(), userId).isPresent()) {
            return mapToConversationResponse(conversation);
        }

        // Check if user is blocked
        if (conversationBlockedUserRepository.existsByConversationIdAndUserId(conversation.getId(), userId)) {
            throw new BadRequestException("You have been blocked from this group");
        }

        User joiningUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        // If approval mode is on, add to pending instead of joining directly
        if (conversation.isApprovalMode()) {
            if (conversationPendingMemberRepository.existsByConversationIdAndUserId(conversation.getId(), userId)) {
                throw new BadRequestException("Your join request is already pending approval");
            }

            ConversationPendingMember pendingMember = ConversationPendingMember.builder()
                    .conversation(conversation)
                    .user(joiningUser)
                    .requestedAt(LocalDateTime.now())
                    .build();
            conversationPendingMemberRepository.save(pendingMember);

            // Notify owner and co-owners about pending request
            List<ConversationUser> admins = conversationUserRepository.findByConversationId(conversation.getId()).stream()
                    .filter(cu -> cu.getRole() == ConversationRole.OWNER || cu.getRole() == ConversationRole.CO_OWNER)
                    .collect(Collectors.toList());

            for (ConversationUser admin : admins) {
                messagingTemplate.convertAndSend(
                        "/topic/user." + admin.getUser().getId() + "/pending-approval",
                        Map.of(
                                "conversationId", conversation.getId(),
                                "type", "PENDING_REQUEST",
                                "userId", userId,
                                "displayName", joiningUser.getDisplayName(),
                                "avatarUrl", joiningUser.getAvatarUrl()
                        )
                );
            }

            return mapToConversationResponse(conversation);
        }

        ConversationUser joiningMember = ConversationUser.builder()
                .conversation(conversation)
                .user(joiningUser)
                .role(ConversationRole.MEMBER)
                .joinedAt(LocalDateTime.now())
                .unreadCounts(0L)
                .build();
        conversationUserRepository.save(joiningMember);
        entityManager.flush();
        entityManager.clear();

        Conversation refreshedConversation = conversationRepository.findByIdWithUsers(conversation.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversation.getId()));

        publishMemberJoinedUpdate(refreshedConversation, userId);

        return mapToConversationResponse(refreshedConversation);
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
                .inviteToken(type == ConversationType.GROUP ? generateUniqueInviteToken() : null)
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

        if (request.getAvatarUrl() != null) {
            conversation.setAvatarUrl(request.getAvatarUrl());
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

        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        boolean isInvitedByAdmin = conversationUser.getRole().equals(ConversationRole.OWNER) ||
                                   conversationUser.getRole().equals(ConversationRole.CO_OWNER);

        if (conversationUserRepository.findByConversationIdAndUserId(conversationId, newMemberId).isPresent()) {
            throw new BadRequestException("User is already a member of this conversation");
        }

        // Check if new member is blocked
        if (conversationBlockedUserRepository.existsByConversationIdAndUserId(conversationId, newMemberId)) {
            throw new BadRequestException("User is blocked from this group");
        }

        User newMember = userRepository.findById(newMemberId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + newMemberId));

        // If approval mode is on and not invited by admin, add to pending
        if (conversation.isApprovalMode() && !isInvitedByAdmin) {
            if (conversationPendingMemberRepository.existsByConversationIdAndUserId(conversationId, newMemberId)) {
                throw new BadRequestException("User's join request is already pending approval");
            }

            ConversationPendingMember pendingMember = ConversationPendingMember.builder()
                    .conversation(conversation)
                    .user(newMember)
                    .requestedBy(userRepository.findById(userId).orElse(null))
                    .requestedAt(LocalDateTime.now())
                    .build();
            conversationPendingMemberRepository.save(pendingMember);

            // Notify admins
            List<ConversationUser> admins = conversationUserRepository.findByConversationId(conversationId).stream()
                    .filter(cu -> cu.getRole() == ConversationRole.OWNER || cu.getRole() == ConversationRole.CO_OWNER)
                    .collect(Collectors.toList());

            for (ConversationUser admin : admins) {
                messagingTemplate.convertAndSend(
                        "/topic/user." + admin.getUser().getId() + "/pending-approval",
                        Map.of(
                                "conversationId", conversationId,
                                "type", "PENDING_REQUEST",
                                "userId", newMemberId,
                                "displayName", newMember.getDisplayName(),
                                "avatarUrl", newMember.getAvatarUrl()
                        )
                );
            }
            return;
        }

        ConversationUser newConversationUser = ConversationUser.builder()
                .conversation(conversation)
                .user(newMember)
                .role(ConversationRole.MEMBER)
                .joinedAt(LocalDateTime.now())
                .unreadCounts(0L)
                .build();

        conversationUserRepository.save(newConversationUser);

        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        if (!allMembers.isEmpty()) {
            List<ConversationUserResponse> updatedParticipants = allMembers.stream()
                    .map(this::mapToConversationUserResponse)
                    .collect(Collectors.toList());

            Map<String, Object> update = new java.util.HashMap<>();
            update.put("conversationId", conversationId);
            update.put("type", "MEMBER_JOINED");
            update.put("participants", updatedParticipants);
            update.put("joinedUserId", newMemberId);

            ConversationResponse fullConvo = mapToConversationResponse(conversation);
            for (ConversationUser member : allMembers) {
                Long mUserId = member.getUser().getId();

                if (mUserId.equals(newMemberId)) {
                    messagingTemplate.convertAndSend("/topic/user." + mUserId + "/conversations", fullConvo);
                }

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
            List<String> pinnedIds = List.of(conversation.getPinnedMessageIds().split(",")).stream()
                    .map(String::trim)
                    .filter(StringUtils::hasText)
                    .toList();

            Map<String, iuh.fit.ConnectionAppBackend.domain.entity.mongodb.Message> pinnedMessagesById =
                    messageRepository.findAllById(pinnedIds).stream()
                            .collect(Collectors.toMap(
                                    iuh.fit.ConnectionAppBackend.domain.entity.mongodb.Message::getId,
                                    message -> message
                            ));

            pinnedMessages = pinnedIds.stream()
                    .map(pinnedMessagesById::get)
                    .filter(java.util.Objects::nonNull)
                    .map(messageService::mapToMessageResponse)
                    .collect(Collectors.toList());
        }

        return ConversationResponse.builder()
                .id(conversation.getId())
                .name(conversation.getName())
                .avatarUrl(conversation.getAvatarUrl())
                .inviteToken(conversation.getInviteToken())
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
                .allowMemberEditInfo(conversation.isAllowMemberEditInfo())
                .allowMemberCreateNotes(conversation.isAllowMemberCreateNotes())
                .allowMemberCreatePolls(conversation.isAllowMemberCreatePolls())
                .allowMemberSendMessage(conversation.isAllowMemberSendMessage())
                .approvalMode(conversation.isApprovalMode())
                .markAdminMessages(conversation.isMarkAdminMessages())
                .allowNewMembersReadHistory(conversation.isAllowNewMembersReadHistory())
                .allowLinkJoin(conversation.isAllowLinkJoin())
                .blockedMembers(new ArrayList<>())
                .pendingMembers(new ArrayList<>())
                .build();
    }

    private void validateGroupInviteConversation(Conversation conversation) {
        if (conversation.getType() != ConversationType.GROUP) {
            throw new BadRequestException("Invite link is only available for group conversations");
        }

        if (!conversation.isActivate()) {
            throw new BadRequestException("This group invite link is no longer active");
        }
    }

    private String generateUniqueInviteToken() {
        String token;
        do {
            token = UUID.randomUUID().toString().replace("-", "").substring(0, INVITE_TOKEN_LENGTH);
        } while (conversationRepository.findByInviteTokenWithUsers(token).isPresent());

        return token;
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

    private void publishMemberJoinedUpdate(Conversation conversation, Long joinedUserId) {
        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversation.getId());
        if (allMembers.isEmpty()) {
            return;
        }

        List<ConversationUserResponse> updatedParticipants = allMembers.stream()
                .map(this::mapToConversationUserResponse)
                .collect(Collectors.toList());

        Map<String, Object> update = new java.util.HashMap<>();
        update.put("conversationId", conversation.getId());
        update.put("type", "MEMBER_JOINED");
        update.put("participants", updatedParticipants);
        update.put("joinedUserId", joinedUserId);

        ConversationResponse fullConvo = mapToConversationResponse(conversation);
        for (ConversationUser member : allMembers) {
            Long memberUserId = member.getUser().getId();

            if (memberUserId.equals(joinedUserId)) {
                messagingTemplate.convertAndSend("/topic/user." + memberUserId + "/conversations", fullConvo);
            }

            messagingTemplate.convertAndSend(
                    "/topic/user." + memberUserId + "/conversation-updates",
                    update
            );
        }
    }

    /**
     * Upsert conversation avatar using S3
     */
    @Transactional
    public ConversationResponse upsertConversationAvatar(Long conversationId, Long userId, MultipartFile avatarFile) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        // Check if user is owner or co-owner
        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!conversationUser.getRole().equals(ConversationRole.OWNER) && 
            !conversationUser.getRole().equals(ConversationRole.CO_OWNER)) {
            throw new UnauthorizedException("Only owner or co-owner can update conversation avatar");
        }

        String existingKey = StringUtils.hasText(conversation.getAvatarUrl())
                ? s3StorageService.extractObjectKeyFromUrl(conversation.getAvatarUrl())
                : null;

        ImageObjectResponse upload;
        try {
            if (StringUtils.hasText(existingKey)) {
                // Replace the existing object in S3
                upload = s3StorageService.replaceImage(existingKey, avatarFile);
            } else {
                // No avatar yet — upload as new
                upload = s3StorageService.uploadImage(avatarFile, "conversations/" + conversationId);
            }
        } catch (iuh.fit.ConnectionAppBackend.exception.ImageNotFoundException ex) {
            // Fallback if existing image not found in S3
            upload = s3StorageService.uploadImage(avatarFile, "conversations/" + conversationId);
        }

        conversation.setAvatarUrl(upload.getImageUrl());
        conversation.setUpdateAt(LocalDateTime.now());
        Conversation updatedConversation = conversationRepository.save(conversation);

        // Send real-time notification to all members
        ConversationResponse response = mapToConversationResponse(updatedConversation);
        
        Map<String, Object> update = new java.util.HashMap<>();
        update.put("conversationId", conversationId);
        update.put("type", "CONVERSATION_UPDATED");
        update.put("name", updatedConversation.getName());
        update.put("updatedConversation", response);

        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        for (ConversationUser member : allMembers) {
            messagingTemplate.convertAndSend("/topic/user." + member.getUser().getId() + "/conversation-updates", update);
        }

        return response;
    }

    /**
     * Get group settings
     */
    public GroupSettingsResponse getGroupSettings(Long conversationId, Long userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (conversation.getType() != ConversationType.GROUP) {
            throw new BadRequestException("Settings are only available for group conversations");
        }

        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        List<ConversationBlockedUser> blockedUsers = conversationBlockedUserRepository.findByConversationId(conversationId);
        List<ConversationUserResponse> blockedMembers = blockedUsers.stream()
                .map(cbu -> ConversationUserResponse.builder()
                        .userId(cbu.getUser().getId())
                        .username(cbu.getUser().getUsername())
                        .displayName(cbu.getUser().getDisplayName())
                        .avatarUrl(cbu.getUser().getAvatarUrl())
                        .role("BLOCKED")
                        .joinedAt(cbu.getBlockedAt())
                        .unreadCounts(0L)
                        .build())
                .collect(Collectors.toList());

        List<ConversationPendingMember> pendingMembers = conversationPendingMemberRepository.findByConversationId(conversationId);
        List<ConversationUserResponse> pendingMemberResponses = pendingMembers.stream()
                .map(cpm -> ConversationUserResponse.builder()
                        .userId(cpm.getUser().getId())
                        .username(cpm.getUser().getUsername())
                        .displayName(cpm.getUser().getDisplayName())
                        .avatarUrl(cpm.getUser().getAvatarUrl())
                        .role("PENDING")
                        .joinedAt(cpm.getRequestedAt())
                        .unreadCounts(0L)
                        .build())
                .collect(Collectors.toList());

        return GroupSettingsResponse.builder()
                .conversationId(conversationId)
                .allowMemberEditInfo(conversation.isAllowMemberEditInfo())
                .allowMemberCreateNotes(conversation.isAllowMemberCreateNotes())
                .allowMemberCreatePolls(conversation.isAllowMemberCreatePolls())
                .allowMemberSendMessage(conversation.isAllowMemberSendMessage())
                .approvalMode(conversation.isApprovalMode())
                .markAdminMessages(conversation.isMarkAdminMessages())
                .allowNewMembersReadHistory(conversation.isAllowNewMembersReadHistory())
                .allowLinkJoin(conversation.isAllowLinkJoin())
                .inviteToken(conversation.getInviteToken())
                .blockedMembers(blockedMembers)
                .pendingMembers(pendingMemberResponses)
                .build();
    }

    /**
     * Update group settings (OWNER only)
     */
    @Transactional
    public GroupSettingsResponse updateGroupSettings(Long conversationId, Long userId, GroupSettingsRequest request) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (conversation.getType() != ConversationType.GROUP) {
            throw new BadRequestException("Settings are only available for group conversations");
        }

        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!conversationUser.getRole().equals(ConversationRole.OWNER)) {
            throw new UnauthorizedException("Only owner can update group settings");
        }

        if (request.getAllowMemberEditInfo() != null) conversation.setAllowMemberEditInfo(request.getAllowMemberEditInfo());
        if (request.getAllowMemberCreateNotes() != null) conversation.setAllowMemberCreateNotes(request.getAllowMemberCreateNotes());
        if (request.getAllowMemberCreatePolls() != null) conversation.setAllowMemberCreatePolls(request.getAllowMemberCreatePolls());
        if (request.getAllowMemberSendMessage() != null) conversation.setAllowMemberSendMessage(request.getAllowMemberSendMessage());
        if (request.getApprovalMode() != null) conversation.setApprovalMode(request.getApprovalMode());
        if (request.getMarkAdminMessages() != null) conversation.setMarkAdminMessages(request.getMarkAdminMessages());
        if (request.getAllowNewMembersReadHistory() != null) conversation.setAllowNewMembersReadHistory(request.getAllowNewMembersReadHistory());
        if (request.getAllowLinkJoin() != null) conversation.setAllowLinkJoin(request.getAllowLinkJoin());

        conversation.setUpdateAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        // Broadcast settings update to all members
        GroupSettingsResponse settingsResponse = getGroupSettings(conversationId, userId);
        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        for (ConversationUser member : allMembers) {
            messagingTemplate.convertAndSend(
                    "/topic/user." + member.getUser().getId() + "/conversation-settings",
                    settingsResponse
            );
        }

        return settingsResponse;
    }

    /**
     * Refresh invite token (OWNER only)
     */
    @Transactional
    public String refreshInviteToken(Long conversationId, Long userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!conversationUser.getRole().equals(ConversationRole.OWNER)) {
            throw new UnauthorizedException("Only owner can refresh invite token");
        }

        String oldToken = conversation.getInviteToken();
        String newToken = generateUniqueInviteToken();
        conversation.setInviteToken(newToken);
        conversation.setUpdateAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        // Notify all members about token refresh
        Map<String, Object> update = new java.util.HashMap<>();
        update.put("conversationId", conversationId);
        update.put("type", "INVITE_TOKEN_REFRESHED");
        update.put("newInviteToken", newToken);

        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        for (ConversationUser member : allMembers) {
            messagingTemplate.convertAndSend(
                    "/topic/user." + member.getUser().getId() + "/conversation-updates",
                    update
            );
        }

        return newToken;
    }

    /**
     * Disband group (OWNER only) - soft delete
     */
    @Transactional
    public void disbandGroup(Long conversationId, Long userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (conversation.getType() != ConversationType.GROUP) {
            throw new BadRequestException("Only group conversations can be disbanded");
        }

        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!conversationUser.getRole().equals(ConversationRole.OWNER)) {
            throw new UnauthorizedException("Only owner can disband the group");
        }

        conversation.setActivate(false);
        conversationRepository.save(conversation);

        // Notify all members about disband
        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        for (ConversationUser member : allMembers) {
            messagingTemplate.convertAndSend(
                    "/topic/user." + member.getUser().getId() + "/conversation-disbanded",
                    Map.of("conversationId", conversationId, "disbandedBy", userId)
            );
        }
    }

    /**
     * Block a member from group (OWNER/CO_OWNER only)
     */
    @Transactional
    public void blockMember(Long conversationId, Long userId, Long memberId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (conversation.getType() != ConversationType.GROUP) {
            throw new BadRequestException("Blocking members is only available for group conversations");
        }

        ConversationUser requester = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!requester.getRole().equals(ConversationRole.OWNER) && !requester.getRole().equals(ConversationRole.CO_OWNER)) {
            throw new UnauthorizedException("Only owner or co-owner can block members");
        }

        if (conversationBlockedUserRepository.existsByConversationIdAndUserId(conversationId, memberId)) {
            throw new BadRequestException("User is already blocked");
        }

        User blockedUser = userRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + memberId));

        User blocker = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        ConversationBlockedUser blockedEntry = ConversationBlockedUser.builder()
                .conversation(conversation)
                .user(blockedUser)
                .blockedBy(blocker)
                .blockedAt(LocalDateTime.now())
                .build();
        conversationBlockedUserRepository.save(blockedEntry);

        // Remove from conversation if they are a member
        if (conversationUserRepository.findByConversationIdAndUserId(conversationId, memberId).isPresent()) {
            removeUserFromConversation(conversationId, userId, memberId);
        }

        // Notify blocked user
        messagingTemplate.convertAndSend(
                "/topic/user." + memberId + "/member-blocked",
                Map.of("conversationId", conversationId, "blockedBy", userId)
        );
    }

    /**
     * Unblock a member (OWNER/CO_OWNER only)
     */
    @Transactional
    public void unblockMember(Long conversationId, Long userId, Long memberId) {
        ConversationUser requester = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!requester.getRole().equals(ConversationRole.OWNER) && !requester.getRole().equals(ConversationRole.CO_OWNER)) {
            throw new UnauthorizedException("Only owner or co-owner can unblock members");
        }

        conversationBlockedUserRepository.deleteByConversationIdAndUserId(conversationId, memberId);
    }

    /**
     * Get blocked members list
     */
    public List<ConversationUserResponse> getBlockedMembers(Long conversationId, Long userId) {
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        List<ConversationBlockedUser> blockedUsers = conversationBlockedUserRepository.findByConversationId(conversationId);
        return blockedUsers.stream()
                .map(cbu -> ConversationUserResponse.builder()
                        .userId(cbu.getUser().getId())
                        .username(cbu.getUser().getUsername())
                        .displayName(cbu.getUser().getDisplayName())
                        .avatarUrl(cbu.getUser().getAvatarUrl())
                        .role("BLOCKED")
                        .joinedAt(cbu.getBlockedAt())
                        .unreadCounts(0L)
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Approve pending member (OWNER/CO_OWNER only)
     */
    @Transactional
    public void approvePendingMember(Long conversationId, Long userId, Long memberId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (conversation.getType() != ConversationType.GROUP) {
            throw new BadRequestException("This action is only available for group conversations");
        }

        if (!conversation.isApprovalMode()) {
            throw new BadRequestException("Approval mode is not enabled for this group");
        }

        ConversationUser requester = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!requester.getRole().equals(ConversationRole.OWNER) && !requester.getRole().equals(ConversationRole.CO_OWNER)) {
            throw new UnauthorizedException("Only owner or co-owner can approve members");
        }

        ConversationPendingMember pending = conversationPendingMemberRepository.findByConversationIdAndUserId(conversationId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException("Pending member not found"));

        // Add to conversation
        ConversationUser newMember = ConversationUser.builder()
                .conversation(conversation)
                .user(pending.getUser())
                .role(ConversationRole.MEMBER)
                .joinedAt(LocalDateTime.now())
                .unreadCounts(0L)
                .build();
        conversationUserRepository.save(newMember);

        // Remove from pending
        conversationPendingMemberRepository.deleteByConversationIdAndUserId(conversationId, memberId);

        entityManager.flush();
        entityManager.clear();

        Conversation refreshedConversation = conversationRepository.findByIdWithUsers(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        publishMemberJoinedUpdate(refreshedConversation, memberId);
    }

    /**
     * Reject pending member (OWNER/CO_OWNER only)
     */
    @Transactional
    public void rejectPendingMember(Long conversationId, Long userId, Long memberId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (conversation.getType() != ConversationType.GROUP) {
            throw new BadRequestException("This action is only available for group conversations");
        }

        if (!conversation.isApprovalMode()) {
            throw new BadRequestException("Approval mode is not enabled for this group");
        }

        ConversationUser requester = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!requester.getRole().equals(ConversationRole.OWNER) && !requester.getRole().equals(ConversationRole.CO_OWNER)) {
            throw new UnauthorizedException("Only owner or co-owner can reject members");
        }

        conversationPendingMemberRepository.deleteByConversationIdAndUserId(conversationId, memberId);
    }

    /**
     * Get pending members list
     */
    public List<ConversationUserResponse> getPendingMembers(Long conversationId, Long userId) {
        boolean isMember = conversationUserRepository.isMember(conversationId, userId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        List<ConversationPendingMember> pendingMembers = conversationPendingMemberRepository.findByConversationId(conversationId);
        return pendingMembers.stream()
                .map(cpm -> ConversationUserResponse.builder()
                        .userId(cpm.getUser().getId())
                        .username(cpm.getUser().getUsername())
                        .displayName(cpm.getUser().getDisplayName())
                        .avatarUrl(cpm.getUser().getAvatarUrl())
                        .role("PENDING")
                        .joinedAt(cpm.getRequestedAt())
                        .unreadCounts(0L)
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Add co-owners (OWNER only)
     */
    @Transactional
    public void addCoOwners(Long conversationId, Long userId, List<Long> memberIds) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        ConversationUser requester = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!requester.getRole().equals(ConversationRole.OWNER)) {
            throw new UnauthorizedException("Only owner can add co-owners");
        }

        for (Long memberId : memberIds) {
            ConversationUser member = conversationUserRepository.findByConversationIdAndUserId(conversationId, memberId)
                    .orElseThrow(() -> new ResourceNotFoundException("User is not a member of this conversation"));

            if (member.getRole().equals(ConversationRole.OWNER)) {
                throw new BadRequestException("Cannot change the role of the owner");
            }

            member.setRole(ConversationRole.CO_OWNER);
            conversationUserRepository.save(member);
        }

        // Notify all members
        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        List<ConversationUserResponse> updatedParticipants = allMembers.stream()
                .map(this::mapToConversationUserResponse)
                .collect(Collectors.toList());

        Map<String, Object> update = new java.util.HashMap<>();
        update.put("conversationId", conversationId);
        update.put("type", "CO_OWNERS_ADDED");
        update.put("participants", updatedParticipants);

        for (ConversationUser member : allMembers) {
            messagingTemplate.convertAndSend(
                    "/topic/user." + member.getUser().getId() + "/conversation-updates",
                    update
            );
        }
    }

    /**
     * Remove co-owner (OWNER only)
     */
    @Transactional
    public void removeCoOwner(Long conversationId, Long userId, Long memberId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        ConversationUser requester = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new UnauthorizedException("User is not a member of this conversation"));

        if (!requester.getRole().equals(ConversationRole.OWNER)) {
            throw new UnauthorizedException("Only owner can remove co-owners");
        }

        ConversationUser member = conversationUserRepository.findByConversationIdAndUserId(conversationId, memberId)
                .orElseThrow(() -> new ResourceNotFoundException("User is not a member of this conversation"));

        if (member.getRole().equals(ConversationRole.OWNER)) {
            throw new BadRequestException("Cannot change the role of the owner");
        }

        member.setRole(ConversationRole.MEMBER);
        conversationUserRepository.save(member);

        // Notify all members
        List<ConversationUser> allMembers = conversationUserRepository.findByConversationId(conversationId);
        List<ConversationUserResponse> updatedParticipants = allMembers.stream()
                .map(this::mapToConversationUserResponse)
                .collect(Collectors.toList());

        Map<String, Object> update = new java.util.HashMap<>();
        update.put("conversationId", conversationId);
        update.put("type", "CO_OWNER_REMOVED");
        update.put("participants", updatedParticipants);

        for (ConversationUser m : allMembers) {
            messagingTemplate.convertAndSend(
                    "/topic/user." + m.getUser().getId() + "/conversation-updates",
                    update
            );
        }
    }

    /**
     * Check if user can send messages in conversation
     */
    public boolean canSendMessage(Long conversationId, Long userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (conversation.getType() != ConversationType.GROUP) {
            return true; // Private chats always allow messaging
        }

        if (conversation.isAllowMemberSendMessage()) {
            return true;
        }

        ConversationUser conversationUser = conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElse(null);

        if (conversationUser == null) {
            return false;
        }

        return conversationUser.getRole().equals(ConversationRole.OWNER) ||
               conversationUser.getRole().equals(ConversationRole.CO_OWNER);
    }

    /**
     * Check if user is blocked from conversation
     */
    public boolean isUserBlocked(Long conversationId, Long userId) {
        return conversationBlockedUserRepository.existsByConversationIdAndUserId(conversationId, userId);
    }

    /**
     * Get the joined date of a user in a conversation
     */
    public LocalDateTime getUserJoinedAt(Long conversationId, Long userId) {
        return conversationUserRepository.findByConversationIdAndUserId(conversationId, userId)
                .map(ConversationUser::getJoinedAt)
                .orElse(null);
    }
}
