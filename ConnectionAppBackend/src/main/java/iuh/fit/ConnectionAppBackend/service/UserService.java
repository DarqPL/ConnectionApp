package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.dto.ImageObjectResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.UserProfileResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;
import java.util.List;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Service
public class UserService {

    public record TemporaryLockInfo(LocalDateTime lockUntil, long remainingMinutes, String reason) {
    }

    private static final String DEFAULT_TEMP_LOCK_REASON = "POLICY_VIOLATION";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private iuh.fit.ConnectionAppBackend.repo.MessageRepository messageRepository;

    @Autowired
    private OtpService otpService;

    @Autowired
    private EmailService emailService;

    @Autowired
    private S3StorageService s3StorageService;
    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserAccountLockService userAccountLockService;

    @Value("${app.security.temp-lock-minutes:30}")
    private long tempLockMinutes;

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
        if (profileRequest.getBio() != null) {
            user.setBio(profileRequest.getBio());
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

        if (user.getLockUntil() != null && user.getLockUntil().isAfter(LocalDateTime.now())) {
            return;
        }

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

    /**
     * Get user by username or email identifier.
     */
    public Optional<User> getUserByIdentifier(String identifier) {
        return userRepository.findByUsernameOrEmail(identifier, identifier);
    }

    /**
     * Throw if account is currently locked; auto-unlocks temporary lock when time has passed.
     */
    @Transactional
    public void assertAccountIsActive(User user) {
        userAccountLockService.assertAccountIsActive(user);
    }

    /**
     * Temporarily lock account for policy violation and invalidate all sessions.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public TemporaryLockInfo lockAccountTemporarily(Long userId, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime base = user.getLockUntil() != null && user.getLockUntil().isAfter(now)
                ? user.getLockUntil()
                : now;

        LocalDateTime lockUntil = base.plusMinutes(Math.max(1, tempLockMinutes));
        String normalizedReason = StringUtils.hasText(reason) ? reason.trim() : DEFAULT_TEMP_LOCK_REASON;

        user.setStatus(UserStatus.OFFLINE);
        user.setLockUntil(lockUntil);
        user.setLockReason(normalizedReason);
        bumpAllPlatformTokenVersions(user);
        userRepository.save(user);

        refreshTokenService.revokeAllByUser(user);

        return new TemporaryLockInfo(
                lockUntil,
                calculateRemainingMinutes(lockUntil),
                normalizedReason
        );
    }

    /**
     * Upsert avatar — upload if user has no avatar, replace if user already has one.
     * This is the single entry point for all avatar upload operations.
     */
    @Transactional
    public UserProfileResponse upsertCurrentUserAvatar(Long userId, MultipartFile avatarFile) {
        User user = getRequiredUser(userId);

        String existingKey = StringUtils.hasText(user.getAvatarUrl())
                ? s3StorageService.extractObjectKeyFromUrl(user.getAvatarUrl())
                : null;

        ImageObjectResponse upload;
        if (StringUtils.hasText(existingKey)) {
            // Replace the existing object in S3
            upload = s3StorageService.replaceImage(existingKey, avatarFile);
        } else {
            // No avatar yet — upload as new
            upload = s3StorageService.uploadImage(avatarFile, "avatars/" + userId);
        }

        user.setAvatarUrl(upload.getImageUrl());
        return mapToUserProfileResponse(userRepository.save(user));
    }

    /** @deprecated Use upsertCurrentUserAvatar instead */
    @Transactional
    public UserProfileResponse createCurrentUserAvatar(Long userId, MultipartFile avatarFile) {
        return upsertCurrentUserAvatar(userId, avatarFile);
    }

    /** @deprecated Use upsertCurrentUserAvatar instead */
    @Transactional
    public UserProfileResponse updateCurrentUserAvatar(Long userId, MultipartFile avatarFile) {
        return upsertCurrentUserAvatar(userId, avatarFile);
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
                .bio(user.getBio())
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

        LocalDateTime now = LocalDateTime.now();
        if (user.getLockUntil() != null && user.getLockUntil().isAfter(now)) {
            return "Account is already locked";
        }

        user.setStatus(UserStatus.OFFLINE);
        user.setLockUntil(now.plusYears(100));
        user.setLockReason("MANUAL_LOCK");
        bumpAllPlatformTokenVersions(user);
        userRepository.save(user);
        refreshTokenService.revokeAllByUser(user);

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

        if (user.getLockUntil() == null) {
            return "Account is not locked";
        }

        // tuỳ logic: OFFLINE hoặc ONLINE
        user.setStatus(UserStatus.OFFLINE);
        user.setLockUntil(null);
        user.setLockReason(null);
        userRepository.save(user);

        return "Account unlocked successfully";
    }

    public void requestManualUnlockOtp(String usernameOrEmail, String email) {
        User user = userRepository.findByUsernameOrEmail(usernameOrEmail, usernameOrEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        LocalDateTime now = LocalDateTime.now();
        if (user.getLockUntil() == null || !user.getLockUntil().isAfter(now) || !"MANUAL_LOCK".equalsIgnoreCase(user.getLockReason())) {
            throw new BadRequestException("Tài khoản không ở trạng thái tự khóa.");
        }

        if (email == null || !email.trim().equalsIgnoreCase(user.getEmail())) {
            throw new BadRequestException("Đây không phải email bạn đăng ký");
        }

        String otp = otpService.generateOtp(user.getEmail());
        emailService.sendOtpEmail(user.getEmail(), otp);
    }

    @Transactional
    public void verifyManualUnlockOtp(String usernameOrEmail, String email, String otp) {
        User user = userRepository.findByUsernameOrEmail(usernameOrEmail, usernameOrEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        LocalDateTime now = LocalDateTime.now();
        if (user.getLockUntil() == null
                || !user.getLockUntil().isAfter(now)
                || !"MANUAL_LOCK".equalsIgnoreCase(user.getLockReason())) {
            throw new BadRequestException("Tai khoan khong o trang thai tu khoa.");
        }

        if (email == null || !email.trim().equalsIgnoreCase(user.getEmail())) {
            throw new BadRequestException("Đây không phải email bạn đăng ký");
        }

        if (!otpService.verifyOtp(user.getEmail(), otp)) {
            throw new BadRequestException("Mã OTP không chính xác hoặc đã hết hạn");
        }

        user.setStatus(UserStatus.OFFLINE);
        user.setLockUntil(null);
        user.setLockReason(null);
        userRepository.save(user);
        otpService.invalidateOtp(user.getEmail());
    }

    /**
     * Request OTP for account deletion
     */
    public void requestDeleteOtp(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        
        String otp = otpService.generateOtp(user.getEmail());
        emailService.sendOtpEmail(user.getEmail(), otp);
    }

    /**
     * Confirm account deletion with OTP
     */
    @Transactional
    public String confirmDeleteAccount(Long userId, String otp) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (!otpService.verifyOtp(user.getEmail(), otp)) {
            throw new BadRequestException("Mã OTP không chính xác hoặc đã hết hạn");
        }

        // Delete avatar from S3 if exists
        if (StringUtils.hasText(user.getAvatarUrl())) {
            try {
                String existingKey = s3StorageService.extractObjectKeyFromUrl(user.getAvatarUrl());
                if (StringUtils.hasText(existingKey)) {
                    s3StorageService.deleteImage(existingKey);
                }
            } catch (Exception e) {
                // Log error but continue deletion
            }
        }

        // Revoke all tokens before deletion
        refreshTokenService.revokeAllByUser(user);

        // Nullify createdBy in conversations to avoid FK constraint error
        if (user.getCreatedConversations() != null) {
            for (iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation conv : user.getCreatedConversations()) {
                conv.setCreatedBy(null);
            }
        }

        // Delete messages in MongoDB
        messageRepository.deleteBySenderInfo_SenderId(user.getId());

        // Permanent delete
        userRepository.delete(user);
        otpService.invalidateOtp(user.getEmail());

        return "Account deleted permanently";
    }

    /**
     * Delete account (permanently - updated from soft delete)
     */
    @Transactional
    public String deleteAccount(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        userRepository.delete(user);

        return "Account deleted successfully";
    }

    private long calculateRemainingMinutes(LocalDateTime lockUntil) {
        long remainingSeconds = Duration.between(LocalDateTime.now(), lockUntil).getSeconds();
        if (remainingSeconds <= 0) {
            return 0;
        }
        return (remainingSeconds + 59) / 60;
    }

    private void bumpAllPlatformTokenVersions(User user) {
        Integer webVersion = user.getWebTokenVersion() == null ? 0 : user.getWebTokenVersion();
        Integer mobileVersion = user.getMobileTokenVersion() == null ? 0 : user.getMobileTokenVersion();
        Integer commonVersion = user.getTokenVersion() == null ? 0 : user.getTokenVersion();

        user.setWebTokenVersion(webVersion + 1);
        user.setMobileTokenVersion(mobileVersion + 1);
        user.setTokenVersion(commonVersion + 1);
    }
}

