package iuh.fit.ConnectionAppBackend.repo;

import iuh.fit.ConnectionAppBackend.domain.common.AuthPlatform;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.RefreshToken;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    List<RefreshToken> findAllByUserOrderByLastUsedAtDesc(User user);
    List<RefreshToken> findAllByUserAndPlatformOrderByLastUsedAtDesc(User user, AuthPlatform platform);

    long deleteAllByUser(User user);
    long deleteAllByUserAndPlatform(User user, AuthPlatform platform);
}
