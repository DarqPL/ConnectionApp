package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.ConversationRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.ConversationResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.PageResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.PaginationRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.RoleUpdateRequest;
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
}
