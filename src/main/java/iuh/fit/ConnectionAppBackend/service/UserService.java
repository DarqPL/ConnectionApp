package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.dto.ImageObjectResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.UserProfileResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private S3StorageService s3StorageService;

    /**
     * Get user profile by user ID
     */
    public UserProfileResponse getUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        return mapToUserProfileResponse(user);
    }

    /**
     * Update user profile
     */
    @Transactional
    public UserProfileResponse updateUserProfile(Long userId, UserProfileResponse profileRequest) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (profileRequest.getDisplayName() != null && !profileRequest.getDisplayName().isEmpty()) {
            user.setDisplayName(profileRequest.getDisplayName());
        }
        if (profileRequest.getEmail() != null && !profileRequest.getEmail().isEmpty()) {
            user.setEmail(profileRequest.getEmail());
        }
        if (profileRequest.getPhone() != null && !profileRequest.getPhone().isEmpty()) {
            user.setPhone(profileRequest.getPhone());
        }
        if (profileRequest.getAvatarUrl() != null && !profileRequest.getAvatarUrl().isEmpty()) {
            user.setAvatarUrl(profileRequest.getAvatarUrl());
        }

        User updatedUser = userRepository.save(user);
        return mapToUserProfileResponse(updatedUser);
    }

    /**
     * Update user status
     */
    @Transactional
    public void updateUserStatus(Long userId, UserStatus status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        user.setStatus(status);
        userRepository.save(user);
    }

    /**
     * Change user password
     */
    @Transactional
    public void changePassword(Long userId, String oldPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (!passwordEncoder.matches(oldPassword, user.getHashPassword())) {
            throw new IllegalArgumentException("Old password is incorrect");
        }

        user.setHashPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /**
     * Get user by username
     */
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Transactional
    public UserProfileResponse createCurrentUserAvatar(Long userId, MultipartFile avatarFile) {
        User user = getRequiredUser(userId);
        if (StringUtils.hasText(user.getAvatarUrl())) {
            throw new BadRequestException("Avatar already exists. Use PUT /api/users/profile/avatar to replace.");
        }

        ImageObjectResponse upload = s3StorageService.uploadImage(avatarFile, "avatars/" + userId);
        user.setAvatarUrl(upload.getImageUrl());
        return mapToUserProfileResponse(userRepository.save(user));
    }

    @Transactional
    public UserProfileResponse updateCurrentUserAvatar(Long userId, MultipartFile avatarFile) {
        User user = getRequiredUser(userId);
        if (!StringUtils.hasText(user.getAvatarUrl())) {
            throw new ResourceNotFoundException("Avatar not found. Use POST /api/users/profile/avatar to create.");
        }

        String existingKey = s3StorageService.extractObjectKeyFromUrl(user.getAvatarUrl());
        ImageObjectResponse upload;

        if (StringUtils.hasText(existingKey)) {
            upload = s3StorageService.replaceImage(existingKey, avatarFile);
        } else {
            upload = s3StorageService.uploadImage(avatarFile, "avatars/" + userId);
        }

        user.setAvatarUrl(upload.getImageUrl());
        return mapToUserProfileResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteCurrentUserAvatar(Long userId) {
        User user = getRequiredUser(userId);
        if (!StringUtils.hasText(user.getAvatarUrl())) {
            throw new ResourceNotFoundException("Avatar not found");
        }

        String existingKey = s3StorageService.extractObjectKeyFromUrl(user.getAvatarUrl());
        if (StringUtils.hasText(existingKey)) {
            s3StorageService.deleteImage(existingKey);
        }

        user.setAvatarUrl(null);
        userRepository.save(user);
    }

    /**
     * Check if user exists
     */
    public boolean userExists(String username) {
        return userRepository.existsByUsername(username);
    }

    /**
     * Search users by username, display name, or phone
     */
    public List<UserProfileResponse> searchUsers(String query) {
        return userRepository.searchUsers(query).stream()
                .map(this::mapToUserProfileResponse)
                .collect(Collectors.toList());
    }

    /**
     * Map User entity to UserProfileResponse DTO
     */
    private UserProfileResponse mapToUserProfileResponse(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .gender(user.getGender() != null ? user.getGender().name() : null)
                .role(user.getRole().name())
                .status(user.getStatus().name())
                .build();
    }

    private User getRequiredUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
    }
    /**
     * Lock account
     */
    @Transactional
    public String lockAccount(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (user.getStatus() == UserStatus.DELETED) {
            throw new IllegalStateException("Cannot lock a deleted account");
        }

        if (user.getStatus() == UserStatus.LOCKED) {
            return "Account is already locked";
        }

        user.setStatus(UserStatus.LOCKED);
        userRepository.save(user);

        return "Account locked successfully";
    }

    /**
     * Unlock account
     */
    @Transactional
    public String unlockAccount(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (user.getStatus() == UserStatus.DELETED) {
            throw new IllegalStateException("Cannot unlock a deleted account");
        }

        if (user.getStatus() != UserStatus.LOCKED) {
            return "Account is not locked";
        }

        // tuỳ logic: OFFLINE hoặc ONLINE
        user.setStatus(UserStatus.OFFLINE);
        userRepository.save(user);

        return "Account unlocked successfully";
    }

    /**
     * Delete account (soft delete)
     */
    @Transactional
    public String deleteAccount(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (user.getStatus() == UserStatus.DELETED) {
            return "Account already deleted";
        }

        user.setStatus(UserStatus.DELETED);
        userRepository.save(user);

        return "Account deleted successfully";
    }
}
