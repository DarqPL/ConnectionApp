package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.common.Role;
import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.dto.DeviceSessionResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.ForgotPasswordRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.LoginRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.LoginResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.RegisterRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.ResetPasswordRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.UserResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.VerifyOtpRequest;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.RefreshToken;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import iuh.fit.ConnectionAppBackend.security.JWTUtils;
import iuh.fit.ConnectionAppBackend.service.CustomerUserDetails;
import iuh.fit.ConnectionAppBackend.service.EmailService;
import iuh.fit.ConnectionAppBackend.service.OtpService;
import iuh.fit.ConnectionAppBackend.service.RefreshTokenService;
import iuh.fit.ConnectionAppBackend.service.SecurityNotificationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

        private static final String REFRESH_TOKEN_COOKIE = "refreshToken";
        private static final Duration REFRESH_TOKEN_COOKIE_MAX_AGE = Duration.ofDays(7);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JWTUtils jwtUtils;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private RefreshTokenService  refreshTokenService;

    @Autowired
    private SecurityNotificationService securityNotificationService;

    @Autowired
    private OtpService otpService;

    @Autowired
    private EmailService emailService;

    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest req){
        if(userRepository.existsByUsername(req.getUsername())){
            return ResponseEntity.badRequest().body("Username is already in use");
        }

        User user = new User();
        user.setUsername(req.getUsername());
        user.setHashPassword(passwordEncoder.encode(req.getPassword()));
        user.setEmail(req.getEmail());
        user.setDisplayName(req.getFirstName() + " " + req.getLastName());
        user.setRole(Role.USER);
        user.setCreatedAt(LocalDateTime.now());
        user.setStatus(UserStatus.OFFLINE);
        user.setTokenVersion(0);

        userRepository.save(user);

        UserResponse response = new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole().name(),
                user.getStatus().name()
        );

        return ResponseEntity.ok(response);
    }

        @PostMapping("/signin")
        public ResponseEntity<?> loginUser(@RequestBody LoginRequest req,
                                                                           HttpServletRequest httpRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );

        CustomerUserDetails  userDetails = (CustomerUserDetails) authentication.getPrincipal();
        User user = userDetails.getUser();

        String userAgent = httpRequest.getHeader("User-Agent");
        String deviceName = resolveDeviceName(userAgent);
        String ipAddress = extractClientIp(httpRequest);

        List<RefreshToken> activeSessions = refreshTokenService.getActiveSessions(user);
        boolean knownDevice = isKnownDevice(activeSessions, deviceName, userAgent, ipAddress);
        if (!activeSessions.isEmpty() && !knownDevice) {
            securityNotificationService.notifyUnknownDeviceLogin(
                user.getId(),
                deviceName,
                ipAddress,
                userAgent
            );
        }

        String accessToken = jwtUtils.generateToken(userDetails);
        RefreshToken refreshToken =
                refreshTokenService.createRefreshToken(
                user,
                deviceName,
                userAgent,
                ipAddress
                );

        ResponseCookie refreshCookie = buildRefreshTokenCookie(refreshToken.getToken());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(new LoginResponse(accessToken));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(
            @CookieValue(value = REFRESH_TOKEN_COOKIE, required = false) String refreshToken) {

        if (refreshToken == null || refreshToken.isBlank()) {
            throw new UnauthorizedException("Phiên đã hết hạn");
        }

        RefreshToken token = refreshTokenService.getValidRefreshToken(refreshToken);

        refreshTokenService.touch(token);

        String newAccessToken =
                jwtUtils.generateToken(
                        new CustomerUserDetails(token.getUser())
                );

        return ResponseEntity.ok(Map.of(
                "accessToken", newAccessToken
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @CookieValue(value = REFRESH_TOKEN_COOKIE, required = false) String refreshToken) {

        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenService.revokeByToken(refreshToken);
        }

        ResponseCookie expiredCookie = buildExpiredRefreshTokenCookie();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expiredCookie.toString())
                .body(Map.of("message", "Logged out"));
    }

    @GetMapping("/devices")
    public ResponseEntity<?> getLoggedInDevices(Authentication authentication) {
        User user = extractAuthenticatedUser(authentication);

        List<DeviceSessionResponse> devices = refreshTokenService.getActiveSessions(user)
                .stream()
                .map(this::toDeviceSessionResponse)
                .toList();

        return ResponseEntity.ok(Map.of("devices", devices));
    }

    @PostMapping("/logout-all")
    public ResponseEntity<?> logoutAllDevices(Authentication authentication) {
        User user = extractAuthenticatedUser(authentication);

        Integer currentVersion = user.getTokenVersion() == null ? 0 : user.getTokenVersion();
        user.setTokenVersion(currentVersion + 1);
        userRepository.save(user);

        refreshTokenService.revokeAllByUser(user);

        ResponseCookie expiredCookie = buildExpiredRefreshTokenCookie();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expiredCookie.toString())
                .body(Map.of("message", "Đã đăng xuất tất cả thiết bị"));
    }

    private User extractAuthenticatedUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomerUserDetails userDetails)) {
            throw new UnauthorizedException("Phiên đã hết hạn");
        }
        return userDetails.getUser();
    }

    private DeviceSessionResponse toDeviceSessionResponse(RefreshToken token) {
        return new DeviceSessionResponse(
                token.getId(),
                token.getDeviceName(),
                token.getUserAgent(),
                token.getIpAddress(),
                token.getCreatedAt(),
                token.getLastUsedAt(),
                token.getExpiryDate()
        );
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String resolveDeviceName(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown device";
        }

        String lower = userAgent.toLowerCase();

        if (lower.contains("iphone") || lower.contains("ios")) {
            return "iPhone";
        }
        if (lower.contains("android")) {
            return "Android";
        }
        if (lower.contains("windows")) {
            return "Windows";
        }
        if (lower.contains("mac")) {
            return "Mac";
        }
        if (lower.contains("linux")) {
            return "Linux";
        }
        return "Unknown device";
    }

    private boolean isKnownDevice(List<RefreshToken> activeSessions,
                                  String deviceName,
                                  String userAgent,
                                  String ipAddress) {
        return activeSessions.stream().anyMatch(session ->
                Objects.equals(normalize(session.getDeviceName()), normalize(deviceName))
                        && Objects.equals(normalize(session.getIpAddress()), normalize(ipAddress))
                        && Objects.equals(normalize(session.getUserAgent()), normalize(userAgent))
        );
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private ResponseCookie buildRefreshTokenCookie(String token) {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, token)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(REFRESH_TOKEN_COOKIE_MAX_AGE)
                .build();
    }

    private ResponseCookie buildExpiredRefreshTokenCookie() {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
    /**
     * POST /api/auth/forgot-password
     * Body: { email }
     * Gửi mã OTP đến email để đặt lại mật khẩu
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.getEmail());
        if (userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email không tồn tại trong hệ thống"));
        }

        String otp = otpService.generateOtp(req.getEmail());
        try {
            emailService.sendOtpEmail(req.getEmail(), otp);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Không thể gửi email. Vui lòng thử lại sau."));
        }

        return ResponseEntity.ok(Map.of("message", "Mã OTP đã được gửi đến email của bạn"));
    }

    /**
     * POST /api/auth/verify-otp
     * Body: { email, otp }
     * Xác minh OTP trước khi đặt lại mật khẩu
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody VerifyOtpRequest req) {
        boolean valid = otpService.verifyOtp(req.getEmail(), req.getOtp());
        if (!valid) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mã OTP không hợp lệ hoặc đã hết hạn"));
        }
        return ResponseEntity.ok(Map.of("message", "Mã OTP hợp lệ"));
    }

    /**
     * POST /api/auth/reset-password
     * Body: { email, otp, newPassword }
     * Đặt lại mật khẩu mới sau khi xác minh OTP
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest req) {
        boolean valid = otpService.verifyOtp(req.getEmail(), req.getOtp());
        if (!valid) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mã OTP không hợp lệ hoặc đã hết hạn"));
        }

        Optional<User> userOpt = userRepository.findByEmail(req.getEmail());
        if (userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email không tồn tại trong hệ thống"));
        }

        User user = userOpt.get();
        user.setHashPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
        otpService.invalidateOtp(req.getEmail());

        return ResponseEntity.ok(Map.of("message", "Mật khẩu đã được đặt lại thành công"));
    }
}
