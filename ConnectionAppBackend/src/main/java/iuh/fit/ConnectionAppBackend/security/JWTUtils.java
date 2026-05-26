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
        return parseClaims(token).getSubject();
    }

    public boolean validateToken(String token, UserDetails userDetails) {
        Claims claims = parseClaims(token);

        String tokenIssuer = claims.getIssuer();
        String tokenAudience = claims.getAudience();

        if (tokenIssuer == null || !tokenIssuer.equals(jwtConfig.getIssuer())) {
            return false;
        }
        if (tokenAudience == null || !tokenAudience.equals(jwtConfig.getAudience())) {
            return false;
        }

        String username = claims.getSubject();
        AuthPlatform platform = extractPlatformFromClaims(claims);
        int tokenVersion = extractTokenVersionFromClaims(claims);
        Date expiration = claims.getExpiration();

        return username.equals(userDetails.getUsername())
            && tokenVersion == extractCurrentTokenVersion(userDetails, platform)
            && !expiration.before(new Date());
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignKey()).build()
                .parseClaimsJws(token)
                .getBody();
    }

    private int extractTokenVersion(String token) {
        return extractTokenVersionFromClaims(parseClaims(token));
    }

    private int extractTokenVersionFromClaims(Claims claims) {
        Number tokenVersion = claims.get("tv", Number.class);
        return tokenVersion == null ? 0 : tokenVersion.intValue();
    }

    private AuthPlatform extractPlatform(String token) {
        return extractPlatformFromClaims(parseClaims(token));
    }

    private AuthPlatform extractPlatformFromClaims(Claims claims) {
        String platform = claims.get("pf", String.class);
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

}
