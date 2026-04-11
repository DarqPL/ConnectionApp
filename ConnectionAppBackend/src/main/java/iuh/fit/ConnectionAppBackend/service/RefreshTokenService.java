package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.AuthPlatform;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.RefreshToken;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class RefreshTokenService {

    @Autowired
    private RefreshTokenRepository refreshTokenRepo;

    public RefreshToken createRefreshToken(User user,
                                           AuthPlatform platform,
                                           String deviceName,
                                           String userAgent,
                                           String ipAddress) {
        RefreshToken refreshToken = new RefreshToken();

        refreshToken.setUser(user);
        refreshToken.setPlatform(platform);
        refreshToken.setDeviceName(deviceName);
        refreshToken.setUserAgent(userAgent);
        refreshToken.setIpAddress(ipAddress);
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setCreatedAt(LocalDateTime.now());
        refreshToken.setLastUsedAt(LocalDateTime.now());
        refreshToken.setExpiryDate(LocalDateTime.now().plusDays(7));

        return refreshTokenRepo.save(refreshToken);
    }

    @Transactional
    public RefreshToken touch(RefreshToken token) {
        token.setLastUsedAt(LocalDateTime.now());
        return refreshTokenRepo.save(token);
    }

    @Transactional(readOnly = true)
    public List<RefreshToken> getActiveSessions(User user) {
        LocalDateTime now = LocalDateTime.now();
        return refreshTokenRepo.findAllByUserOrderByLastUsedAtDesc(user)
                .stream()
                .filter(token -> token.getExpiryDate() != null && token.getExpiryDate().isAfter(now))
                .toList();
    }

    @Transactional
    public void revokeByToken(String refreshToken) {
        refreshTokenRepo.findByToken(refreshToken)
                .ifPresent(refreshTokenRepo::delete);
    }

    @Transactional
    public RefreshToken getValidRefreshToken(String refreshToken) {
        return refreshTokenRepo.findByToken(refreshToken)
                .map(this::verifyExpiration)
                .orElseThrow(() -> new UnauthorizedException("Phiên đã hết hạn"));
    }

    @Transactional
    public long revokeAllByUser(User user) {
        return refreshTokenRepo.deleteAllByUser(user);
    }

    @Transactional(readOnly = true)
    public List<RefreshToken> getActiveSessionsByPlatform(User user, AuthPlatform platform) {
        LocalDateTime now = LocalDateTime.now();
        return refreshTokenRepo.findAllByUserAndPlatformOrderByLastUsedAtDesc(user, platform)
                .stream()
                .filter(token -> token.getExpiryDate() != null && token.getExpiryDate().isAfter(now))
                .toList();
    }

    @Transactional
    public long revokeAllByUserAndPlatform(User user, AuthPlatform platform) {
        return refreshTokenRepo.deleteAllByUserAndPlatform(user, platform);
    }

    @Transactional
    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.getExpiryDate().isBefore(LocalDateTime.now())) {
            refreshTokenRepo.delete(token);
            throw new RuntimeException("Refresh token expired");
        }
        return token;
    }
}
