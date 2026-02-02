package iuh.fit.ConnectionAppBackend.security;

import iuh.fit.ConnectionAppBackend.service.CustomUserDetailsService;
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

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JWTUtils jwtUtils;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;


    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {


        String authHeader = request.getHeader("Authorization");
        String username = null;
        String jwt = null;

        //Kiem tra ma authHeader
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwt = authHeader.substring(7);
            username = jwtUtils.extractUsername(jwt);
        }

        if (username != null &&
                SecurityContextHolder.getContext().getAuthentication() == null) {

            UserDetails userDetails =
                    customUserDetailsService.loadUserByUsername(username);

            // 👉 BƯỚC 4: VALIDATE TOKEN
            if (jwtUtils.validateToken(jwt, userDetails)) {

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

                // 👉 BƯỚC 5: SET AUTH VÀO CONTEXT
                SecurityContextHolder.getContext()
                        .setAuthentication(authToken);
            }
        }

        // 👉 CHO REQUEST ĐI TIẾP
        filterChain.doFilter(request, response);
    }

}
