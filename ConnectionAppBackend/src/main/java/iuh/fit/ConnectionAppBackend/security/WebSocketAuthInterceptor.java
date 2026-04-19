package iuh.fit.ConnectionAppBackend.security;

import iuh.fit.ConnectionAppBackend.service.CustomUserDetailsService;
import iuh.fit.ConnectionAppBackend.service.CustomerUserDetails;
import iuh.fit.ConnectionAppBackend.service.UserAccountLockService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor  {
    @Autowired
    private JWTUtils jwtUtils;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private UserAccountLockService userAccountLockService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {

            String token = accessor.getFirstNativeHeader("Authorization");

            if (token != null && token.startsWith("Bearer ")) {
                try {
                    token = token.substring(7);

                    String username = jwtUtils.extractUsername(token);

                    UserDetails userDetails =
                            userDetailsService.loadUserByUsername(username);

                    if (jwtUtils.validateToken(token, userDetails)) {
                        if (userDetails instanceof CustomerUserDetails customerUserDetails) {
                            userAccountLockService.assertAccountIsActive(customerUserDetails.getUser());
                        }

                        UsernamePasswordAuthenticationToken auth =
                                new UsernamePasswordAuthenticationToken(
                                        userDetails, null, userDetails.getAuthorities());

                        accessor.setUser(auth);
                        return message;
                    }
                } catch (RuntimeException ex) {
                    return null;
                }
            }

            return null;
        }

        return message;
    }
}
