package iuh.fit.ConnectionAppBackend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.dto.UserProfileResponse;
import iuh.fit.ConnectionAppBackend.security.AdminOnly;
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
    @AdminOnly
    @PostMapping("/{id}/lock")
    public ResponseEntity<String> lockAccount(@PathVariable Long id){
        return ResponseEntity.ok(userService.lockAccount(id));
    }

    @AdminOnly
    @PostMapping("/{id}/unlock")
    public ResponseEntity<String> unlockAccount(@PathVariable Long id){
        return ResponseEntity.ok(userService.unlockAccount(id));
    }

    @PostMapping("/delete/request-otp")
    public ResponseEntity<Void> requestDeleteOtp(Authentication authentication) {
        Long userId = getAuthenticatedUserId(authentication);
        userService.requestDeleteOtp(userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/delete/confirm")
    public ResponseEntity<String> confirmDeleteAccount(
            Authentication authentication,
            @RequestParam String otp) {
        Long userId = getAuthenticatedUserId(authentication);
        return ResponseEntity.ok(userService.confirmDeleteAccount(userId, otp));
    }

    @AdminOnly
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteAccount(@PathVariable Long id){
        return ResponseEntity.ok(userService.deleteAccount(id));
    }

    @PostMapping(value = "/profile/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserProfileResponse> createCurrentUserAvatar(
            Authentication authentication,
            @RequestParam("file") MultipartFile avatarFile) {

        Long userId = getAuthenticatedUserId(authentication);
        UserProfileResponse result = userService.upsertCurrentUserAvatar(userId, avatarFile);
        return ResponseEntity.ok(result);
    }

    @PutMapping(value = "/profile/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserProfileResponse> updateCurrentUserAvatar(
            Authentication authentication,
            @RequestParam("file") MultipartFile avatarFile) {

        Long userId = getAuthenticatedUserId(authentication);
        UserProfileResponse result = userService.upsertCurrentUserAvatar(userId, avatarFile);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/profile/avatar")
    public ResponseEntity<Void> deleteCurrentUserAvatar(Authentication authentication) {
        Long userId = getAuthenticatedUserId(authentication);
        userService.deleteCurrentUserAvatar(userId);
        return ResponseEntity.noContent().build();
    }

    private Long getAuthenticatedUserId(Authentication authentication) {
        String username = authentication.getName();
        return userService.getUserByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
