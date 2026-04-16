package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.FriendResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.BlockStatusResponse;
import iuh.fit.ConnectionAppBackend.service.FriendService;
import iuh.fit.ConnectionAppBackend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
public class FriendController {

    @Autowired
    private FriendService friendService;

    @Autowired
    private UserService userService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Send friend request
     */
    @PostMapping("/request/{receiverId}")
    public ResponseEntity<FriendResponse> sendFriendRequest(
            Authentication authentication,
            @PathVariable Long receiverId) {

        Long requesterId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        FriendResponse friendRequest = friendService.sendFriendRequest(requesterId, receiverId);
        
        // Send WebSocket notification to receiver
        if (friendRequest.getFriendId() != null) {
            messagingTemplate.convertAndSend(
                    "/topic/user." + receiverId + "/friend-requests",
                    friendRequest
            );
        }
        
        return ResponseEntity.status(HttpStatus.CREATED).body(friendRequest);
    }

    /**
     * Accept friend request
     */
    @PostMapping("/accept/{requesterId}")
    public ResponseEntity<FriendResponse> acceptFriendRequest(
            Authentication authentication,
            @PathVariable Long requesterId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        FriendResponse friendResponse = friendService.acceptFriendRequest(userId, requesterId);
        
        // Notify requester that the request was accepted
        messagingTemplate.convertAndSend(
                "/topic/user." + requesterId + "/friend-accepted",
                friendResponse
        );
        
        return ResponseEntity.ok(friendResponse);
    }

    /**
     * Reject friend request
     */
    @DeleteMapping("/reject/{requesterId}")
    public ResponseEntity<Void> rejectFriendRequest(
            Authentication authentication,
            @PathVariable Long requesterId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        friendService.rejectFriendRequest(userId, requesterId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Get all friends
     */
    @GetMapping
    public ResponseEntity<List<FriendResponse>> getFriends(Authentication authentication) {
        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        List<FriendResponse> friends = friendService.getFriends(userId);
        return ResponseEntity.ok(friends);
    }

    /**
     * Get pending friend requests
     */
    @GetMapping("/pending")
    public ResponseEntity<List<FriendResponse>> getPendingRequests(Authentication authentication) {
        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        List<FriendResponse> pendingRequests = friendService.getPendingRequests(userId);
        return ResponseEntity.ok(pendingRequests);
    }

    /**
     * Block user
     */
    @PostMapping("/block/{blockedUserId}")
    public ResponseEntity<Void> blockUser(
            Authentication authentication,
            @PathVariable Long blockedUserId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        friendService.blockUser(userId, blockedUserId);
        return ResponseEntity.ok().build();
    }

    /**
     * Unblock user
     */
    @DeleteMapping("/block/{blockedUserId}")
    public ResponseEntity<Void> unblockUser(
            Authentication authentication,
            @PathVariable Long blockedUserId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        friendService.unblockUser(userId, blockedUserId);
        return ResponseEntity.noContent().build();
    }

        /**
         * Get block status between current user and target user
         */
        @GetMapping("/block/status/{otherUserId}")
        public ResponseEntity<BlockStatusResponse> getBlockStatus(
                        Authentication authentication,
                        @PathVariable Long otherUserId) {

                Long userId = userService.getUserByUsername(authentication.getName())
                                .orElseThrow(() -> new RuntimeException("User not found"))
                                .getId();

                return ResponseEntity.ok(friendService.getBlockStatus(userId, otherUserId));
        }

    /**
     * Check if users are friends
     */
    @GetMapping("/check/{otherUserId}")
    public ResponseEntity<Boolean> areFriends(
            Authentication authentication,
            @PathVariable Long otherUserId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        boolean areFriends = friendService.areFriends(userId, otherUserId);
        System.out.println(areFriends);
        return ResponseEntity.ok(areFriends);
    }

        @GetMapping("/check/isSending/{otherUserId}")
        public ResponseEntity<Boolean> isSending(
                Authentication authentication,
                @PathVariable Long otherUserId) {
               
        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
        boolean result = friendService.isSending(userId, otherUserId);
        System.out.println(result);
        return ResponseEntity.ok(result);
        }

        @GetMapping("/check/isReceived/{otherUserId}")
        public ResponseEntity<Boolean> isReceived(
                Authentication authentication,
                @PathVariable Long otherUserId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();              
        boolean result = friendService.isReceived(userId, otherUserId);
        System.out.println(result);
        return ResponseEntity.ok(result);
        }

      @DeleteMapping("/cancel/{otherUserId}")
        public ResponseEntity<?> cancelRequest(
                Authentication authentication,
                @PathVariable Long otherUserId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        friendService.cancelFriendRequest(userId, otherUserId);
        return ResponseEntity.ok("Đã hủy lời mời");
        }
        @DeleteMapping("/unfriend/{otherUserId}")
        public ResponseEntity<?> unfriend(
                Authentication authentication,
                @PathVariable Long otherUserId) {

        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        friendService.unfriend(userId, otherUserId);
        return ResponseEntity.ok("Đã hủy kết bạn");
        }




}
