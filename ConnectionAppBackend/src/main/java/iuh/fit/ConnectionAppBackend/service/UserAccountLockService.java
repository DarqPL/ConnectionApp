package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.AccountAdminLockedException;
import iuh.fit.ConnectionAppBackend.exception.AccountManualLockedException;
import iuh.fit.ConnectionAppBackend.exception.AccountTemporarilyLockedException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class UserAccountLockService {

    private static final String SELF_LOCK_REASON = "SELF_LOCK";
    private static final String ADMIN_LOCK_REASON = "ADMIN_LOCK";

    @Autowired
    private UserRepository userRepository;

    @Value("${app.admin.contact-email:phantomsolo12@gmail.com}")
    private String adminContactEmail;

    @Transactional
    public void assertAccountIsActive(User user) {
        Instant lockUntil = user.getLockUntil();
        Instant now = Instant.now();

        if (lockUntil != null && lockUntil.isAfter(now)) {
            if (ADMIN_LOCK_REASON.equalsIgnoreCase(user.getLockReason())) {
                throw new AccountAdminLockedException(
                        "Tài khoản của bạn đã bị quản trị viên khoá. Hãy liên hệ quản trị viên với email : " + adminContactEmail
                );
            }

            if (SELF_LOCK_REASON.equalsIgnoreCase(user.getLockReason())) {
                throw new AccountManualLockedException(
                        "Tài khoản của bạn đã bị khóa do yêu cầu của người dùng."
                );
            }

            throw new AccountTemporarilyLockedException(
                    "Tài khoản của bạn đã bị khóa tạm thời do vi phạm chính sách",
                    calculateRemainingMinutes(lockUntil),
                    lockUntil
            );
        }

        if (user.getStatus() != UserStatus.LOCKED) {
            return;
        }

        if (lockUntil == null) {
            throw new UnauthorizedException("Tài khoản của bạn đã bị khóa");
        }

        user.setStatus(UserStatus.OFFLINE);
        user.setLockUntil(null);
        user.setLockReason(null);
        userRepository.save(user);
    }

    private long calculateRemainingMinutes(Instant lockUntil) {
        long remainingSeconds = Duration.between(Instant.now(), lockUntil).getSeconds();
        if (remainingSeconds <= 0) {
            return 0;
        }
        return (remainingSeconds + 59) / 60;
    }
}