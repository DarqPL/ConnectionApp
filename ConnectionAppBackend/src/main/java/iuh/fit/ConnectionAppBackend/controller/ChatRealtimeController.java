package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.service.TypingNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class ChatRealtimeController {

    @Autowired
    private TypingNotificationService typingNotificationService;

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
}