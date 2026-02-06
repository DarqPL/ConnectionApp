package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.FriendResponse;
import iuh.fit.ConnectionAppBackend.service.FriendService;
import iuh.fit.ConnectionAppBackend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
        return ResponseEntity.ok(areFriends);
    }
}
