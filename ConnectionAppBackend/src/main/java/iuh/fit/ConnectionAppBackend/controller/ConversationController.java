package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.ConversationRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationUserResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.PageResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.PaginationRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.RoleUpdateRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.GroupSettingsRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.GroupSettingsResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.BlockMemberRequest;
import iuh.fit.ConnectionAppBackend.service.ConversationService;
import iuh.fit.ConnectionAppBackend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    @Autowired
    private ConversationService conversationService;

    @Autowired
    private UserService userService;

    /**
     * Get all conversations for current user with pagination
     */
    @GetMapping
    public ResponseEntity<PageResponse<ConversationResponse>> getConversations(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "lastMessageAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        Sort.Direction direction = Sort.Direction.fromString(sortDirection.toUpperCase());
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

        Page<ConversationResponse> conversations = conversationService.getUserConversations(userId, pageable);

        PageResponse<ConversationResponse> response = PageResponse.<ConversationResponse>builder()
                .content(conversations.getContent())
                .pageNumber(page)
                .pageSize(size)
                .totalElements(conversations.getTotalElements())
                .totalPages(conversations.getTotalPages())
                .hasNext(conversations.hasNext())
                .hasPrevious(conversations.hasPrevious())
                .build();

        return ResponseEntity.ok(response);
    }

    /**
     * Get conversation by ID
     */
    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationResponse> getConversation(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        ConversationResponse conversation = conversationService.getConversationById(conversationId, userId);
        return ResponseEntity.ok(conversation);
    }

    @GetMapping("/invite/{inviteToken}")
    public ResponseEntity<ConversationResponse> resolveInvite(
            @PathVariable String inviteToken) {

        ConversationResponse conversation = conversationService.resolveGroupInvite(inviteToken);
        return ResponseEntity.ok(conversation);
    }

    @PostMapping("/invite/{inviteToken}/join")
    public ResponseEntity<ConversationResponse> joinByInvite(
            Authentication authentication,
            @PathVariable String inviteToken) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        ConversationResponse conversation = conversationService.joinConversationByInviteToken(inviteToken, userId);
        return ResponseEntity.ok(conversation);
    }

    /**
     * Create new conversation
     */
    @PostMapping
    public ResponseEntity<ConversationResponse> createConversation(
            Authentication authentication,
            @RequestBody ConversationRequest request) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        ConversationResponse conversation = conversationService.createConversation(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(conversation);
    }

    /**
     * Update conversation
     */
    @PutMapping("/{conversationId}")
    public ResponseEntity<ConversationResponse> updateConversation(
            Authentication authentication,
            @PathVariable Long conversationId,
            @RequestBody ConversationRequest request) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        ConversationResponse conversation = conversationService.updateConversation(conversationId, userId, request);
        return ResponseEntity.ok(conversation);
    }

    /**
     * Delete conversation
     */
    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Void> deleteConversation(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.deleteConversation(conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Add user to conversation
     */
    @PostMapping("/{conversationId}/members/{memberId}")
    public ResponseEntity<Void> addUserToConversation(
            Authentication authentication,
            @PathVariable Long conversationId,
            @PathVariable Long memberId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.addUserToConversation(conversationId, userId, memberId);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    /**
     * Remove user from conversation
     */
    @DeleteMapping("/{conversationId}/members/{memberId}")
    public ResponseEntity<Void> removeUserFromConversation(
            Authentication authentication,
            @PathVariable Long conversationId,
            @PathVariable Long memberId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.removeUserFromConversation(conversationId, userId, memberId);

        return ResponseEntity.noContent().build();
    }

    /**
     * Update member role in conversation
     */
    @PutMapping("/{conversationId}/members/{memberId}/role")
    public ResponseEntity<Void> updateMemberRole(
            Authentication authentication,
            @PathVariable Long conversationId,
            @PathVariable Long memberId,
            @RequestBody RoleUpdateRequest request) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.updateMemberRole(conversationId, userId, memberId, request.getRole());
        return ResponseEntity.noContent().build();
    }

    /**
     * Mark conversation as read
     */
    @PutMapping("/{conversationId}/read")
    public ResponseEntity<Void> markAsRead(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.markAsRead(conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Update conversation avatar
     */
    @PutMapping(value = "/{conversationId}/avatar", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ConversationResponse> updateConversationAvatar(
            Authentication authentication,
            @PathVariable Long conversationId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile avatarFile) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        ConversationResponse response = conversationService.upsertConversationAvatar(conversationId, userId, avatarFile);
        return ResponseEntity.ok(response);
    }

    /**
     * Get group settings
     */
    @GetMapping("/{conversationId}/settings")
    public ResponseEntity<GroupSettingsResponse> getGroupSettings(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        GroupSettingsResponse settings = conversationService.getGroupSettings(conversationId, userId);
        return ResponseEntity.ok(settings);
    }

    /**
     * Update group settings (OWNER only)
     */
    @PutMapping("/{conversationId}/settings")
    public ResponseEntity<GroupSettingsResponse> updateGroupSettings(
            Authentication authentication,
            @PathVariable Long conversationId,
            @RequestBody GroupSettingsRequest request) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        GroupSettingsResponse settings = conversationService.updateGroupSettings(conversationId, userId, request);
        return ResponseEntity.ok(settings);
    }

    /**
     * Refresh invite token (OWNER only)
     */
    @PostMapping("/{conversationId}/invite-token/refresh")
    public ResponseEntity<Map<String, String>> refreshInviteToken(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        String newToken = conversationService.refreshInviteToken(conversationId, userId);
        return ResponseEntity.ok(Map.of("inviteToken", newToken));
    }

    /**
     * Disband group (OWNER only)
     */
    @PostMapping("/{conversationId}/disband")
    public ResponseEntity<Void> disbandGroup(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.disbandGroup(conversationId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Block a member (OWNER/CO_OWNER only)
     */
    @PostMapping("/{conversationId}/blocked-members")
    public ResponseEntity<Void> blockMember(
            Authentication authentication,
            @PathVariable Long conversationId,
            @RequestBody BlockMemberRequest request) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.blockMember(conversationId, userId, request.getMemberId());
        return ResponseEntity.noContent().build();
    }

    /**
     * Unblock a member (OWNER/CO_OWNER only)
     */
    @DeleteMapping("/{conversationId}/blocked-members/{memberId}")
    public ResponseEntity<Void> unblockMember(
            Authentication authentication,
            @PathVariable Long conversationId,
            @PathVariable Long memberId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.unblockMember(conversationId, userId, memberId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Get blocked members
     */
    @GetMapping("/{conversationId}/blocked-members")
    public ResponseEntity<List<ConversationUserResponse>> getBlockedMembers(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        List<ConversationUserResponse> blockedMembers = conversationService.getBlockedMembers(conversationId, userId);
        return ResponseEntity.ok(blockedMembers);
    }

    /**
     * Approve pending member (OWNER/CO_OWNER only)
     */
    @PostMapping("/{conversationId}/pending-members/{memberId}/approve")
    public ResponseEntity<Void> approvePendingMember(
            Authentication authentication,
            @PathVariable Long conversationId,
            @PathVariable Long memberId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.approvePendingMember(conversationId, userId, memberId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Reject pending member (OWNER/CO_OWNER only)
     */
    @PostMapping("/{conversationId}/pending-members/{memberId}/reject")
    public ResponseEntity<Void> rejectPendingMember(
            Authentication authentication,
            @PathVariable Long conversationId,
            @PathVariable Long memberId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.rejectPendingMember(conversationId, userId, memberId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Get pending members
     */
    @GetMapping("/{conversationId}/pending-members")
    public ResponseEntity<List<ConversationUserResponse>> getPendingMembers(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        List<ConversationUserResponse> pendingMembers = conversationService.getPendingMembers(conversationId, userId);
        return ResponseEntity.ok(pendingMembers);
    }

    /**
     * Add co-owners (OWNER only)
     */
    @PostMapping("/{conversationId}/co-owners")
    public ResponseEntity<Void> addCoOwners(
            Authentication authentication,
            @PathVariable Long conversationId,
            @RequestBody List<Long> memberIds) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.addCoOwners(conversationId, userId, memberIds);
        return ResponseEntity.noContent().build();
    }

    /**
     * Remove co-owner (OWNER only)
     */
    @DeleteMapping("/{conversationId}/co-owners/{memberId}")
    public ResponseEntity<Void> removeCoOwner(
            Authentication authentication,
            @PathVariable Long conversationId,
            @PathVariable Long memberId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        conversationService.removeCoOwner(conversationId, userId, memberId);
        return ResponseEntity.noContent().build();
    }
}
