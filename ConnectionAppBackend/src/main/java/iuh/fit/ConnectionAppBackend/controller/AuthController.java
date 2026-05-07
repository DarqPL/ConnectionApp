package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.common.AuthPlatform;
import iuh.fit.ConnectionAppBackend.domain.common.Role;
import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
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
import iuh.fit.ConnectionAppBackend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.Map;
import java.util.Optional;

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
    private UserService userService;

    @Autowired
    private OtpService otpService;

    @Autowired
    private EmailService emailService;

    @Value("${app.auth.cookie.secure:false}")
    private boolean refreshCookieSecure;

    @Value("${app.auth.cookie.same-site:Lax}")
    private String refreshCookieSameSite;
  
    @PostMapping("/signup/send-otp")
    public ResponseEntity<?> sendSignupOtp(@RequestBody Map<String, String> req) {
        String email = req.get("email");
        String username = req.get("username");

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email không được để trống"));
        }
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email đã được sử dụng"));
        }
        // Chỉ kiểm tra username nếu được cung cấp (luồng mới chỉ gửi email ở bước 1)
        if (username != null && !username.isBlank() && userRepository.existsByUsername(username)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Tên đăng nhập đã được sử dụng"));
        }

        String otp = otpService.generateOtp(email);
        try {
            emailService.sendOtpEmail(email, otp);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Không thể gửi email. Vui lòng thử lại sau."));
        }

        return ResponseEntity.ok(Map.of("message", "Mã OTP đã được gửi đến email của bạn"));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest req){
        if(userRepository.existsByUsername(req.getUsername())){
            return ResponseEntity.badRequest().body(Map.of("message", "Tên đăng nhập đã được sử dụng"));
        }
        if(userRepository.existsByEmail(req.getEmail())){
            return ResponseEntity.badRequest().body(Map.of("message", "Email đã được sử dụng"));
        }

        // Kiểm tra trạng thái "đã xác minh email" thay vì OTP (tránh hết hạn khi điền form)
        if (!otpService.isEmailVerified(req.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email chưa được xác minh hoặc phiên xác minh đã hết hạn. Vui lòng xác minh lại."));
        }

        User user = new User();
        user.setUsername(req.getUsername());
        user.setHashPassword(passwordEncoder.encode(req.getPassword()));
        user.setEmail(req.getEmail());
        user.setDisplayName(req.getFirstName() + " " + req.getLastName());
        user.setRole(Role.USER);
        user.setCreatedAt(LocalDateTime.now());
        user.setStatus(UserStatus.OFFLINE);
        user.setWebTokenVersion(0);
        user.setMobileTokenVersion(0);

        userRepository.save(user);
        otpService.invalidateOtp(req.getEmail()); // xóa cả OTP lẫn verified state

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
        Optional<User> candidate = userService.getUserByIdentifier(req.getUsername());
        candidate.ifPresent(userService::assertAccountIsActive);

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );

        CustomerUserDetails  userDetails = (CustomerUserDetails) authentication.getPrincipal();
        User user = userDetails.getUser();
        userService.assertAccountIsActive(user);

        String userAgent = httpRequest.getHeader("User-Agent");
        AuthPlatform platform = resolvePlatform(req.getPlatform(), userAgent);
        String deviceName = resolveDeviceName(userAgent);
        String ipAddress = extractClientIp(httpRequest);

        refreshTokenService.revokeAllByUserAndPlatform(user, platform);
        bumpTokenVersionByPlatform(user, platform);
        userRepository.save(user);

        securityNotificationService.notifySessionRevokedByNewLogin(
            user.getId(),
            platform,
            deviceName,
            ipAddress,
            userAgent
        );

        String accessToken = jwtUtils.generateToken(new CustomerUserDetails(user), platform);
        RefreshToken refreshToken =
                refreshTokenService.createRefreshToken(
                        user,
                platform,
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
        userService.assertAccountIsActive(token.getUser());

        refreshTokenService.touch(token);

        AuthPlatform platform = token.getPlatform() == null ? AuthPlatform.WEB : token.getPlatform();

        String newAccessToken =
                jwtUtils.generateToken(
                new CustomerUserDetails(token.getUser()),
                platform
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

    @PostMapping("/manual-lock/request-otp")
    public ResponseEntity<?> requestManualLockOtp(@RequestBody Map<String, String> req) {
        String usernameOrEmail = req.get("usernameOrEmail");
        String email = req.get("email");

        if (usernameOrEmail == null || usernameOrEmail.isBlank() || email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Thiếu thông tin xác thực", "code", "BAD_REQUEST"));
        }

        userService.requestManualUnlockOtp(usernameOrEmail.trim(), email.trim());
        return ResponseEntity.ok(Map.of("message", "Mã OTP đã được gửi đến email của bạn"));
    }

    @PostMapping("/manual-lock/verify-otp")
    public ResponseEntity<?> verifyManualLockOtp(@RequestBody Map<String, String> req) {
        String usernameOrEmail = req.get("usernameOrEmail");
        String email = req.get("email");
        String otp = req.get("otp");

        if (usernameOrEmail == null || usernameOrEmail.isBlank()
                || email == null || email.isBlank()
                || otp == null || otp.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Thiếu thông tin xác thực", "code", "BAD_REQUEST"));
        }

        userService.verifyManualUnlockOtp(usernameOrEmail.trim(), email.trim(), otp.trim());
        return ResponseEntity.ok(Map.of("message", "Mở khóa tài khoản thành công"));
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

    private AuthPlatform resolvePlatform(String platformFromRequest, String userAgent) {
        if (platformFromRequest != null && !platformFromRequest.isBlank()) {
            return AuthPlatform.fromValue(platformFromRequest);
        }

        if (userAgent != null) {
            String lower = userAgent.toLowerCase();
            if (lower.contains("android") || lower.contains("iphone") || lower.contains("ios")) {
                return AuthPlatform.MOBILE;
            }
        }
        return AuthPlatform.WEB;
    }

    private void bumpTokenVersionByPlatform(User user, AuthPlatform platform) {
        if (platform == AuthPlatform.MOBILE) {
            Integer current = user.getMobileTokenVersion() == null ? 0 : user.getMobileTokenVersion();
            user.setMobileTokenVersion(current + 1);
            return;
        }

        Integer current = user.getWebTokenVersion() == null ? 0 : user.getWebTokenVersion();
        user.setWebTokenVersion(current + 1);
    }

    private ResponseCookie buildRefreshTokenCookie(String token) {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, token)
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite(refreshCookieSameSite)
                .path("/")
                .maxAge(REFRESH_TOKEN_COOKIE_MAX_AGE)
                .build();
    }

    private ResponseCookie buildExpiredRefreshTokenCookie() {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite(refreshCookieSameSite)
                .path("/")
                .maxAge(0)
                .build();
    }

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
        // Đánh dấu email đã xác minh — trạng thái này tồn tại 10 phút
        // để người dùng có đủ thời gian điền thông tin tài khoản
        otpService.markEmailVerified(req.getEmail());
        return ResponseEntity.ok(Map.of("message", "Mã OTP hợp lệ"));
    }

    /**
     * POST /api/auth/reset-password
     * Body: { email, otp, newPassword }
     * Đặt lại mật khẩu mới sau khi xác minh OTP
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest req) {
        // Sử dụng isEmailVerified thay vì verifyOtp — nhất quán với luồng signup
        // và tránh lỗi do OTP đã bị xóa khi markEmailVerified được gọi
        if (!otpService.isEmailVerified(req.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Phiên xác minh đã hết hạn. Vui lòng yêu cầu OTP mới."));
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
