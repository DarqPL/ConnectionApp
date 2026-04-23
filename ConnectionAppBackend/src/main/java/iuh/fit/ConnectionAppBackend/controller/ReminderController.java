package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.ReminderRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.ReminderResponse;
import iuh.fit.ConnectionAppBackend.service.ReminderService;
import iuh.fit.ConnectionAppBackend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reminders")
public class ReminderController {

    @Autowired
    private ReminderService reminderService;

    @Autowired
    private UserService userService;

    @PostMapping
    public ResponseEntity<ReminderResponse> createReminder(
            Authentication authentication,
            @RequestBody ReminderRequest request) {
        
        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        return ResponseEntity.ok(reminderService.createReminder(userId, request));
    }

    @GetMapping("/conversation/{conversationId}")
    public ResponseEntity<List<ReminderResponse>> getRemindersByConversation(
            @PathVariable Long conversationId) {
        return ResponseEntity.ok(reminderService.getRemindersByConversation(conversationId));
    }

    @DeleteMapping("/{reminderId}")
    public ResponseEntity<Void> deleteReminder(
            Authentication authentication,
            @PathVariable String reminderId) {
        
        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
 
        reminderService.deleteReminder(reminderId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{reminderId}/join")
    public ResponseEntity<ReminderResponse> joinReminder(
            Authentication authentication,
            @PathVariable String reminderId) {
        
        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        return ResponseEntity.ok(reminderService.joinReminder(reminderId, userId));
    }

    @PostMapping("/{reminderId}/decline")
    public ResponseEntity<ReminderResponse> declineReminder(
            Authentication authentication,
            @PathVariable String reminderId) {
        
        Long userId = userService.getUserByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();

        return ResponseEntity.ok(reminderService.declineReminder(reminderId, userId));
    }
}
