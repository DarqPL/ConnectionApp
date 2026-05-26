package iuh.fit.ConnectionAppBackend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import iuh.fit.ConnectionAppBackend.config.JwtConfig;
import iuh.fit.ConnectionAppBackend.domain.common.AuthPlatform;
import iuh.fit.ConnectionAppBackend.service.CustomerUserDetails;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.UUID;

@Component
public class JWTUtils {

    @Autowired
    private JwtConfig jwtConfig;

    private Key getSignKey() {
        return Keys.hmacShaKeyFor(
                jwtConfig.getSecret().getBytes(StandardCharsets.UTF_8)
        );
    }

        public String generateToken(UserDetails user, AuthPlatform platform) {
        AuthPlatform normalizedPlatform = platform == null ? AuthPlatform.WEB : platform;
        int tokenVersion = extractCurrentTokenVersion(user, normalizedPlatform);
        return Jwts.builder()
                .setSubject(user.getUsername())
                .setIssuer(jwtConfig.getIssuer())
                .setAudience(jwtConfig.getAudience())
                .setId(UUID.randomUUID().toString())
                .claim("tv", tokenVersion)
            .claim("pf", normalizedPlatform.name())
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
        AuthPlatform platform = extractPlatform(token);
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(getSignKey()).build()
                .parseClaimsJws(token)
                .getBody();

        String tokenIssuer = claims.getIssuer();
        String tokenAudience = claims.getAudience();

        if (tokenIssuer != null && !tokenIssuer.equals(jwtConfig.getIssuer())) {
            return false;
        }
        if (tokenAudience != null && !tokenAudience.equals(jwtConfig.getAudience())) {
            return false;
        }

        return username.equals(userDetails.getUsername())
            && extractTokenVersion(token) == extractCurrentTokenVersion(userDetails, platform)
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

    private AuthPlatform extractPlatform(String token) {
        String platform = Jwts.parserBuilder()
                .setSigningKey(getSignKey()).build()
                .parseClaimsJws(token)
                .getBody()
                .get("pf", String.class);

        return AuthPlatform.fromValue(platform);
    }

    private int extractCurrentTokenVersion(UserDetails userDetails, AuthPlatform platform) {
        if (userDetails instanceof CustomerUserDetails customerUserDetails
                && customerUserDetails.getUser() != null) {
            if (platform == AuthPlatform.MOBILE) {
                Integer version = customerUserDetails.getUser().getMobileTokenVersion();
                return version == null ? 0 : version;
            }

            Integer version = customerUserDetails.getUser().getWebTokenVersion();
            return version == null ? 0 : version;
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
