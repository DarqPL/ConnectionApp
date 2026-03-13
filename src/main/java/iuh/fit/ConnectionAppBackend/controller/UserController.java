package iuh.fit.ConnectionAppBackend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.dto.UserProfileResponse;
import iuh.fit.ConnectionAppBackend.service.UserService;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    /**
     * Get current user profile
     */
    @GetMapping("/profile")
    public ResponseEntity<UserProfileResponse> getCurrentUserProfile(Authentication authentication) {
        String username = authentication.getName();
        Long userId = userService.getUserByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
        
        UserProfileResponse profile = userService.getUserProfile(userId);
        return ResponseEntity.ok(profile);
    }

    /**
     * Get user profile by ID
     */
    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> getUserProfile(@PathVariable Long userId) {
        UserProfileResponse profile = userService.getUserProfile(userId);
        return ResponseEntity.ok(profile);
    }

    /**
     * Search users
     */
    @GetMapping("/search")
    public ResponseEntity<List<UserProfileResponse>> searchUsers(@RequestParam String query) {
        List<UserProfileResponse> results = userService.searchUsers(query);
        return ResponseEntity.ok(results);
    }

    /**
     * Update user profile
     */
    @PutMapping("/profile")
    public ResponseEntity<UserProfileResponse> updateUserProfile(
            Authentication authentication,
            @RequestBody UserProfileResponse profileRequest) {
        
        String username = authentication.getName();
        Long userId = userService.getUserByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        UserProfileResponse updatedProfile = userService.updateUserProfile(userId, profileRequest);
        return ResponseEntity.ok(updatedProfile);
    }

    /**
     * Update user status (online/offline)
     */
    @PutMapping("/status")
    public ResponseEntity<Void> updateStatus(
            Authentication authentication,
            @RequestParam String status) {
        
        String username = authentication.getName();
        Long userId = userService.getUserByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        try {
            UserStatus userStatus = UserStatus.valueOf(status.toUpperCase());
            userService.updateUserStatus(userId, userStatus);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Change password
     */
    @PostMapping("/change-password")
    public ResponseEntity<String> changePassword(
            Authentication authentication,
            @RequestParam String oldPassword,
            @RequestParam String newPassword) {
        
        String username = authentication.getName();
        Long userId = userService.getUserByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        try {
            userService.changePassword(userId, oldPassword, newPassword);
            return ResponseEntity.ok("Password changed successfully");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }
}
