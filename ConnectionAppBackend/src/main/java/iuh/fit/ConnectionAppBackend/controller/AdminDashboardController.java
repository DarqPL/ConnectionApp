package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.*;
import iuh.fit.ConnectionAppBackend.security.AdminOnly;
import iuh.fit.ConnectionAppBackend.service.AdminService;
import iuh.fit.ConnectionAppBackend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@AdminOnly
public class AdminDashboardController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private UserService userService;

    @GetMapping("/stats")
    public ResponseEntity<AdminStatsResponse> getDashboardStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> getUsers(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AdminUserResponse> result = adminService.getAllUsers(status, search, pageable);

        return ResponseEntity.ok(Map.of(
                "users", result.getContent(),
                "total", result.getTotalElements(),
                "page", result.getNumber(),
                "size", result.getSize()
        ));
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<Map<String, String>> updateUserRole(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody RoleChangeRequest request) {

        String username = authentication.getName();
        Long adminId = userService.getUserByUsername(username)
                .orElseThrow(() -> new RuntimeException("Admin user not found"))
                .getId();

        String message = adminService.updateUserRole(adminId, id, request.getRole());
        return ResponseEntity.ok(Map.of("message", message));
    }

    @GetMapping("/conversations")
    public ResponseEntity<Map<String, Object>> getConversations(
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AdminConversationResponse> result = adminService.getAllConversations(type, pageable);

        return ResponseEntity.ok(Map.of(
                "conversations", result.getContent(),
                "total", result.getTotalElements(),
                "page", result.getNumber(),
                "size", result.getSize()
        ));
    }

    @PutMapping("/conversations/{id}/lock")
    public ResponseEntity<Map<String, String>> lockConversation(@PathVariable Long id) {
        String message = adminService.lockConversation(id);
        return ResponseEntity.ok(Map.of("message", message));
    }

    @PutMapping("/conversations/{id}/unlock")
    public ResponseEntity<Map<String, String>> unlockConversation(@PathVariable Long id) {
        String message = adminService.unlockConversation(id);
        return ResponseEntity.ok(Map.of("message", message));
    }

    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<Map<String, String>> deleteConversation(@PathVariable Long id) {
        String message = adminService.softDeleteConversation(id);
        return ResponseEntity.ok(Map.of("message", message));
    }
}
