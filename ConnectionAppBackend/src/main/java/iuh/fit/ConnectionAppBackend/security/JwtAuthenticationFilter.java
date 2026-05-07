package iuh.fit.ConnectionAppBackend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.AccountManualLockedException;
import iuh.fit.ConnectionAppBackend.exception.AccountTemporarilyLockedException;
import iuh.fit.ConnectionAppBackend.exception.ErrorResponse;
import iuh.fit.ConnectionAppBackend.service.CustomUserDetailsService;
import iuh.fit.ConnectionAppBackend.service.CustomerUserDetails;
import iuh.fit.ConnectionAppBackend.service.UserAccountLockService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JWTUtils jwtUtils;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

        @Autowired
        private UserAccountLockService userAccountLockService;

        @Autowired
        private ObjectMapper objectMapper;


    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String requestUri = request.getRequestURI();
        if ("/api/auth/manual-lock/request-otp".equals(requestUri)
                || "/api/auth/manual-lock/verify-otp".equals(requestUri)) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        String username = null;
        String jwt = null;

                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        try {
                                jwt = authHeader.substring(7);
                                username = jwtUtils.extractUsername(jwt);
                        } catch (Exception ex) {
                                writeUnauthorized(response, "Phiên đã hết hạn");
                                return;
                        }
        }

        if (username != null &&
                SecurityContextHolder.getContext().getAuthentication() == null) {

            UserDetails userDetails =
                    customUserDetailsService.loadUserByUsername(username);

            if (jwtUtils.validateToken(jwt, userDetails)) {
                                if (userDetails instanceof CustomerUserDetails customerUserDetails) {
                                        User user = customerUserDetails.getUser();
                                        try {
                                                userAccountLockService.assertAccountIsActive(user);
                                        } catch (AccountManualLockedException ex) {
                                                writeManualLockResponse(response, request, ex);
                                                return;
                                        } catch (AccountTemporarilyLockedException ex) {
                                                writeTemporaryLockResponse(response, request, ex);
                                                return;
                                        } catch (RuntimeException ex) {
                                                writeUnauthorized(response, ex.getMessage());
                                                return;
                                        }
                                }

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );

                authToken.setDetails(
                        new WebAuthenticationDetailsSource()
                                .buildDetails(request)
                );

                SecurityContextHolder.getContext()
                        .setAuthentication(authToken);
                        } else {
                                writeUnauthorized(response, "Phiên đã hết hạn");
                                return;
            }
        }

        filterChain.doFilter(request, response);
    }

        private void writeUnauthorized(HttpServletResponse response, String message) throws IOException {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json");
                response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                response.getWriter().write("{\"message\":\"" + message + "\"}");
        }

        private void writeTemporaryLockResponse(HttpServletResponse response,
                                                HttpServletRequest request,
                                                AccountTemporarilyLockedException ex) throws IOException {
                ErrorResponse payload = ErrorResponse.builder()
                        .status(HttpServletResponse.SC_FORBIDDEN)
                        .code("ACCOUNT_TEMP_LOCKED")
                        .message(ex.getMessage())
                        .error("Forbidden")
                        .path(request.getRequestURI())
                        .timestamp(LocalDateTime.now())
                        .remainingMinutes(ex.getRemainingMinutes())
                        .lockUntil(ex.getLockUntil())
                        .build();

                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                response.getWriter().write(objectMapper.writeValueAsString(payload));
        }

        private void writeManualLockResponse(HttpServletResponse response,
                                             HttpServletRequest request,
                                             AccountManualLockedException ex) throws IOException {
                ErrorResponse payload = ErrorResponse.builder()
                        .status(HttpServletResponse.SC_FORBIDDEN)
                        .code("ACCOUNT_MANUAL_LOCKED")
                        .message(ex.getMessage())
                        .error("Forbidden")
                        .path(request.getRequestURI())
                        .timestamp(LocalDateTime.now())
                        .build();

                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                response.getWriter().write(objectMapper.writeValueAsString(payload));
        }

}
