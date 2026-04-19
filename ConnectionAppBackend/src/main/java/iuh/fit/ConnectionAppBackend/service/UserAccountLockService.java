package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.AccountTemporarilyLockedException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
public class UserAccountLockService {

    @Autowired
    private UserRepository userRepository;

    @Transactional
    public void assertAccountIsActive(User user) {
        LocalDateTime lockUntil = user.getLockUntil();
        LocalDateTime now = LocalDateTime.now();

        if (lockUntil != null && lockUntil.isAfter(now)) {
            throw new AccountTemporarilyLockedException(
                    "Bạn bị khóa tài khoản tạm thời do vi phạm chính sách",
                    calculateRemainingMinutes(lockUntil),
                    lockUntil
            );
        }

        if (user.getStatus() != UserStatus.LOCKED) {
            return;
        }

        if (lockUntil == null) {
            throw new UnauthorizedException("Tài khoản đã bị khóa");
        }

        user.setStatus(UserStatus.OFFLINE);
        user.setLockUntil(null);
        user.setLockReason(null);
        userRepository.save(user);
    }

    private long calculateRemainingMinutes(LocalDateTime lockUntil) {
        long remainingSeconds = Duration.between(LocalDateTime.now(), lockUntil).getSeconds();
        if (remainingSeconds <= 0) {
            return 0;
        }
        return (remainingSeconds + 59) / 60;
    }
}
