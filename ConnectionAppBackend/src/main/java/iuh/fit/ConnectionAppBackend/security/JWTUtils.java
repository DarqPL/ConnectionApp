package iuh.fit.ConnectionAppBackend.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import iuh.fit.ConnectionAppBackend.config.JwtConfig;
import iuh.fit.ConnectionAppBackend.service.CustomerUserDetails;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JWTUtils {

    @Autowired
    private JwtConfig jwtConfig;

    private Key getSignKey() {
        return Keys.hmacShaKeyFor(
                jwtConfig.getSecret().getBytes(StandardCharsets.UTF_8)
        );
    }
    public String generateToken(UserDetails user) {
        int tokenVersion = extractCurrentTokenVersion(user);
        return Jwts.builder()
                .setSubject(user.getUsername())
                .claim("tv", tokenVersion)
                .setIssuedAt(new Date())
                .setExpiration(
                        new Date(System.currentTimeMillis()
                                + jwtConfig.getExpiration())
                )
                .signWith(
                        getSignKey(),SignatureAlgorithm.HS256)
                .compact();
    }
    public String extractUsername(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignKey()).build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    public boolean validateToken(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername())
                && extractTokenVersion(token) == extractCurrentTokenVersion(userDetails)
                && !isTokenExpired(token);
    }

    private int extractTokenVersion(String token) {
        Number tokenVersion = Jwts.parserBuilder()
                .setSigningKey(getSignKey()).build()
                .parseClaimsJws(token)
                .getBody()
                .get("tv", Number.class);

        return tokenVersion == null ? 0 : tokenVersion.intValue();
    }

    private int extractCurrentTokenVersion(UserDetails userDetails) {
        if (userDetails instanceof CustomerUserDetails customerUserDetails
                && customerUserDetails.getUser().getTokenVersion() != null) {
            return customerUserDetails.getUser().getTokenVersion();
        }
        return 0;
    }

    private boolean isTokenExpired(String token) {
        Date expiration = Jwts.parserBuilder()
                .setSigningKey(getSignKey()).build()
                .parseClaimsJws(token)
                .getBody()
                .getExpiration();
        return expiration.before(new Date());
    }

}
