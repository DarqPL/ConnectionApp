package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.AiRewriteRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.AiRewriteResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageReactionRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.MessageResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.PageResponse;
import iuh.fit.ConnectionAppBackend.service.MessageService;
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

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    @Autowired
    private MessageService messageService;

    @Autowired
    private UserService userService;

    /**
     * Send a message
     */
    @PostMapping
    public ResponseEntity<MessageResponse> sendMessage(
            Authentication authentication,
            @RequestBody MessageRequest request) {

        Long senderId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        MessageResponse message = messageService.sendMessage(senderId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    /**
     * Get messages in a conversation with pagination
     */
    @GetMapping("/conversation/{conversationId}")
    public ResponseEntity<PageResponse<MessageResponse>> getMessages(
            Authentication authentication,
            @PathVariable Long conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        Sort.Direction direction = Sort.Direction.fromString(sortDirection.toUpperCase());
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

        Page<MessageResponse> messages = messageService.getMessages(conversationId, userId, pageable);

        PageResponse<MessageResponse> response = PageResponse.<MessageResponse>builder()
                .content(messages.getContent())
                .pageNumber(page)
                .pageSize(size)
                .totalElements(messages.getTotalElements())
                .totalPages(messages.getTotalPages())
                .hasNext(messages.hasNext())
                .hasPrevious(messages.hasPrevious())
                .build();

        return ResponseEntity.ok(response);
    }

    /**
     * Get a specific message
     */
    @GetMapping("/{messageId}")
    public ResponseEntity<MessageResponse> getMessage(
            Authentication authentication,
            @PathVariable String messageId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        MessageResponse message = messageService.getMessageById(messageId, userId);
        return ResponseEntity.ok(message);
    }

    /**
     * Edit message
     */
    @PutMapping("/{messageId}")
    public ResponseEntity<MessageResponse> editMessage(
            Authentication authentication,
            @PathVariable String messageId,
            @RequestBody MessageRequest request) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        MessageResponse message = messageService.editMessage(messageId, userId, request.getContent());
        return ResponseEntity.ok(message);
    }

    /**
     * Delete message
     */
    @DeleteMapping("/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            Authentication authentication,
            @PathVariable String messageId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        messageService.deleteMessage(messageId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Recall (unsend) a message
     */
    @PutMapping("/{messageId}/recall")
    public ResponseEntity<MessageResponse> recallMessage(
            Authentication authentication,
            @PathVariable String messageId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        MessageResponse message = messageService.recallMessage(messageId, userId);
        return ResponseEntity.ok(message);
    }

        /**
         * Add/update reaction for a message. If same reaction already exists for user, it toggles off.
         */
        @PostMapping("/{messageId}/reaction")
        public ResponseEntity<MessageResponse> reactToMessage(
                        Authentication authentication,
                        @PathVariable String messageId,
                        @RequestBody MessageReactionRequest request) {

                Long userId = userService.getUserByUsername(authentication.getName())
                                .orElseThrow(() -> new RuntimeException("User not found"))
                                .getId();

                MessageResponse message = messageService.reactToMessage(messageId, userId, request.getReactionCode());
                return ResponseEntity.ok(message);
        }

        /**
         * Remove current user's reaction from a message.
         */
        @DeleteMapping("/{messageId}/reaction")
        public ResponseEntity<MessageResponse> removeReaction(
                        Authentication authentication,
                        @PathVariable String messageId) {

                Long userId = userService.getUserByUsername(authentication.getName())
                                .orElseThrow(() -> new RuntimeException("User not found"))
                                .getId();

                MessageResponse message = messageService.removeReaction(messageId, userId);
                return ResponseEntity.ok(message);
        }

    /**
     * Vote in a poll
     */
    @PostMapping("/{messageId}/vote")
    public ResponseEntity<MessageResponse> vote(
            Authentication authentication,
            @PathVariable String messageId,
            @RequestParam List<String> optionIds) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        MessageResponse message = messageService.vote(messageId, userId, optionIds);
        return ResponseEntity.ok(message);
    }

    /**
     * Close a poll
     */
    @PutMapping("/{messageId}/poll/close")
    public ResponseEntity<MessageResponse> closePoll(
            Authentication authentication,
            @PathVariable String messageId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        MessageResponse message = messageService.closePoll(messageId, userId);
        return ResponseEntity.ok(message);
    }

    /**
     * Pin a message
     */
    @PostMapping("/{messageId}/pin")
    public ResponseEntity<MessageResponse> pinMessage(
            Authentication authentication,
            @PathVariable String messageId,
            @RequestParam Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        MessageResponse message = messageService.pinMessage(conversationId, userId, messageId);
        return ResponseEntity.ok(message);
    }

    /**
     * Unpin a message
     */
    @DeleteMapping("/{messageId}/unpin")
    public ResponseEntity<Void> unpinMessage(
            Authentication authentication,
            @PathVariable String messageId,
            @RequestParam Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        messageService.unpinMessage(conversationId, userId, messageId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Search messages
     */
    @GetMapping("/search")
    public ResponseEntity<List<MessageResponse>> searchMessages(
            Authentication authentication,
            @RequestParam Long conversationId,
            @RequestParam String searchTerm) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        List<MessageResponse> messages = messageService.searchMessages(conversationId, userId, searchTerm);
        return ResponseEntity.ok(messages);
    }

    /**
     * Get unread message count
     */
    @GetMapping("/unread/{conversationId}")
    public ResponseEntity<Long> getUnreadMessageCount(
            Authentication authentication,
            @PathVariable Long conversationId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        long unreadCount = messageService.getUnreadMessageCount(conversationId, userId);
        return ResponseEntity.ok(unreadCount);
    }

        /**
         * AI rewrite for drafted message content
         */
        @PostMapping("/ai-rewrite")
        public ResponseEntity<AiRewriteResponse> aiRewriteDraft(
                        Authentication authentication,
                        @RequestBody AiRewriteRequest request) {

                Long userId = userService.getUserByUsername(authentication.getName())
                                .orElseThrow(() -> new RuntimeException("User not found"))
                                .getId();

                AiRewriteResponse response = messageService.aiRewriteDraft(userId, request);
                return ResponseEntity.ok(response);
        }
}
