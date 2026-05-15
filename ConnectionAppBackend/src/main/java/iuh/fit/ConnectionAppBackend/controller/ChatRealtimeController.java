package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.CallParticipantStateRequest;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import iuh.fit.ConnectionAppBackend.service.CallService;
import iuh.fit.ConnectionAppBackend.service.TypingNotificationService;
import iuh.fit.ConnectionAppBackend.service.UserPresenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatRealtimeController {

    @Autowired
    private TypingNotificationService typingNotificationService;

    @Autowired
    private CallService callService;

    @Autowired
    private UserPresenceService userPresenceService;

    @Autowired
    private UserRepository userRepository;

    @MessageMapping("/presence/heartbeat")
    public void handleHeartbeat(Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }

        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null) return;

        userPresenceService.heartbeat(user.getId());
    }

    @MessageMapping("/chat/{conversationId}/typing")
    public void notifyTyping(@DestinationVariable Long conversationId, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }

        typingNotificationService.notifyTyping(principal.getName(), conversationId);
    }

    @MessageMapping("/chat/{conversationId}/stopped-typing")
    public void notifyStoppedTyping(@DestinationVariable Long conversationId, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }

        typingNotificationService.notifyStoppedTyping(principal.getName(), conversationId);
    }

    @MessageMapping("/calls/{callId}/participants/me")
    public void updateCallParticipantState(@DestinationVariable Long callId,
                                           @Payload CallParticipantStateRequest request,
                                           Principal principal) {
        if (principal == null || principal.getName() == null) {
            return;
        }

        callService.updateParticipantState(principal.getName(), callId, request);
    }
}