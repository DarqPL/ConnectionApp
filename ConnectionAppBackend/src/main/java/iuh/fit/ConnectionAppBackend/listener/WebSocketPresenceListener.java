package iuh.fit.ConnectionAppBackend.listener;

import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import iuh.fit.ConnectionAppBackend.service.UserPresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
public class WebSocketPresenceListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketPresenceListener.class);

    @Autowired
    private UserPresenceService userPresenceService;

    @Autowired
    private UserRepository userRepository;

    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        Principal principal = event.getUser();
        if (principal == null) return;

        String username = principal.getName();
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return;

        userPresenceService.setOnline(user.getId());
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        Principal principal = event.getUser();
        if (principal == null) return;

        String username = principal.getName();
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return;

        userPresenceService.setOffline(user.getId());
    }
}
