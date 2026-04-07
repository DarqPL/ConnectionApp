package iuh.fit.ConnectionAppBackend.controller;

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
import iuh.fit.ConnectionAppBackend.repo.RefreshTokenRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import iuh.fit.ConnectionAppBackend.security.JWTUtils;
import iuh.fit.ConnectionAppBackend.service.CustomerUserDetails;
import iuh.fit.ConnectionAppBackend.service.EmailService;
import iuh.fit.ConnectionAppBackend.service.OtpService;
import iuh.fit.ConnectionAppBackend.service.RefreshTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

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
    private RefreshTokenRepository refreshTokenRepository;

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
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest req){
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );

        CustomerUserDetails  userDetails = (CustomerUserDetails) authentication.getPrincipal();

        String accessToken = jwtUtils.generateToken(userDetails);
        RefreshToken refreshToken =
                refreshTokenService.createRefreshToken(
                        userDetails.getUser()
                );

        return ResponseEntity.ok(
                new LoginResponse(accessToken, refreshToken.getToken())
        );
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(
            @RequestBody Map<String, String> request) {

        String refreshToken = request.get("refreshToken");

        RefreshToken token = refreshTokenRepository.findByToken(refreshToken)
                .map(refreshTokenService::verifyExpiration)
                .orElseThrow(() ->
                        new RuntimeException("Invalid refresh token"));

        String newAccessToken =
                jwtUtils.generateToken(
                        new CustomerUserDetails(token.getUser())
                );

        return ResponseEntity.ok(Map.of(
                "accessToken", newAccessToken
        ));
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
