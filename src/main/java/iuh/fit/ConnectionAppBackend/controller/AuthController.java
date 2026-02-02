package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.common.Role;
import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.dto.LoginRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.LoginResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.RegisterRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.UserResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import iuh.fit.ConnectionAppBackend.security.JWTUtils;
import iuh.fit.ConnectionAppBackend.service.CustomerUserDetails;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
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

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest req){
        if(userRepository.existsByUsername(req.getUsername())){
            return ResponseEntity.badRequest().body("Username is already in use");
        }

        User user = new User();
        user.setUsername(req.getUsername());
        user.setHashPassword(passwordEncoder.encode(req.getPassword()));
        user.setRole(Role.USER);
        user.setCreatedAt(LocalDateTime.now());
        user.setDisplayName(req.getUsername());
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

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest req){
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );

        UserDetails userDetails =
                (UserDetails) authentication.getPrincipal();

        String accessToken = jwtUtils.generateToken(userDetails);
        String refreshToken = UUID.randomUUID().toString();

        return ResponseEntity.ok(
                new LoginResponse(accessToken, refreshToken)
        );
    }
    @GetMapping("/hello")
    public ResponseEntity<?> hello(){
        return ResponseEntity.ok("hello");
    }


}
