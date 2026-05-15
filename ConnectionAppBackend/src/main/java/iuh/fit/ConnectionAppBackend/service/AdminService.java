package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.common.Role;
import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.dto.*;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.repo.ConversationRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.stream.Collectors;

@Service
public class AdminService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private RefreshTokenService refreshTokenService;

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    public AdminStatsResponse getDashboardStats() {
        long totalUsers = userRepository.countByStatusNot(UserStatus.DELETED);
        long activeUsers = userRepository.countByStatus(UserStatus.ONLINE);
        long lockedUsers = userRepository.countByStatus(UserStatus.LOCKED);
        long totalConversations = conversationRepository.countByActivateTrue();
        long totalReports = 0;
        long pendingReports = 0;

        return AdminStatsResponse.builder()
                .totalUsers(totalUsers)
                .activeUsers(activeUsers)
                .lockedUsers(lockedUsers)
                .totalConversations(totalConversations)
                .totalReports(totalReports)
                .pendingReports(pendingReports)
                .build();
    }

    public Page<AdminUserResponse> getAllUsers(String statusFilter, String searchQuery, Pageable pageable) {
        Page<User> users;

        if (searchQuery != null && !searchQuery.isBlank() && statusFilter != null && !statusFilter.isBlank()) {
            UserStatus status = UserStatus.valueOf(statusFilter.toUpperCase());
            users = userRepository.searchUsersByStatus(searchQuery, status, pageable);
        } else if (searchQuery != null && !searchQuery.isBlank()) {
            users = userRepository.searchUsersPaginated(searchQuery, pageable);
        } else if (statusFilter != null && !statusFilter.isBlank()) {
            UserStatus status = UserStatus.valueOf(statusFilter.toUpperCase());
            users = userRepository.findByStatus(status, pageable);
        } else {
            users = userRepository.findAllActive(pageable);
        }

        return users.map(this::mapToAdminUserResponse);
    }

    @Transactional
    public String updateUserRole(Long adminUserId, Long targetUserId, String newRoleStr) {
        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Admin user not found"));
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Target user not found"));

        if (admin.getId().equals(target.getId())) {
            throw new BadRequestException("Cannot change your own role");
        }

        Role newRole = Role.valueOf(newRoleStr.toUpperCase());

        if (newRole == Role.USER && target.getRole() == Role.ADMIN) {
            long adminCount = userRepository.countByRoleAndStatusNot(Role.ADMIN, UserStatus.DELETED);
            if (adminCount <= 1) {
                throw new BadRequestException("Cannot remove the last admin in the system");
            }
        }

        target.setRole(newRole);
        userRepository.save(target);

        return "User role updated to " + newRoleStr;
    }

    public Page<AdminConversationResponse> getAllConversations(String typeFilter, Pageable pageable) {
        Page<Conversation> conversations;

        if (typeFilter != null && !typeFilter.isBlank()) {
            ConversationType type = ConversationType.valueOf(typeFilter.toUpperCase());
            conversations = conversationRepository.findByTypeForAdmin(type, pageable);
        } else {
            conversations = conversationRepository.findAllForAdmin(pageable);
        }

        return conversations.map(this::mapToAdminConversationResponse);
    }

    @Transactional
    public String lockConversation(Long conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        conversation.setActivate(false);
        conversationRepository.save(conversation);

        return "Conversation locked";
    }

    @Transactional
    public String unlockConversation(Long conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        conversation.setActivate(true);
        conversationRepository.save(conversation);

        return "Conversation unlocked";
    }

    @Transactional
    public String softDeleteConversation(Long conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        Query query = new Query(Criteria.where("conversation_id").is(conversationId));
        Update update = new Update().set("is_deleted", true);
        mongoTemplate.updateMulti(query, update, "messages");

        conversation.setActivate(false);
        conversation.setName("[Deleted] " + conversation.getName());
        conversationRepository.save(conversation);

        return "Conversation deleted";
    }

    private AdminUserResponse mapToAdminUserResponse(User user) {
        return AdminUserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole().name())
                .status(user.getStatus().name())
                .lockUntil(user.getLockUntil() != null ? user.getLockUntil().format(ISO_FORMATTER) : null)
                .lockReason(user.getLockReason())
                .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().format(ISO_FORMATTER) : null)
                .build();
    }

    private AdminConversationResponse mapToAdminConversationResponse(Conversation conversation) {
        long participantCount = conversation.getConversationUsers() != null
                ? conversation.getConversationUsers().size()
                : 0;

        String creatorName = null;
        if (conversation.getCreatedBy() != null) {
            creatorName = conversation.getCreatedBy().getDisplayName();
        }

        String lastActivity = null;
        if (conversation.getLastMessageAt() != null) {
            lastActivity = conversation.getLastMessageAt().format(ISO_FORMATTER);
        } else if (conversation.getCreatedAt() != null) {
            lastActivity = conversation.getCreatedAt().format(ISO_FORMATTER);
        }

        String status = conversation.isActivate() ? "ACTIVE" : "LOCKED";

        return AdminConversationResponse.builder()
                .id(conversation.getId())
                .name(conversation.getName())
                .type(conversation.getType().name())
                .participantCount(participantCount)
                .creatorName(creatorName)
                .createdAt(conversation.getCreatedAt() != null ? conversation.getCreatedAt().format(ISO_FORMATTER) : null)
                .status(status)
                .lastActivity(lastActivity)
                .build();
    }
}
