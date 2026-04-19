package iuh.fit.ConnectionAppBackend.exception;

import java.time.LocalDateTime;

public class AccountTemporarilyLockedException extends RuntimeException {

    private final long remainingMinutes;
    private final LocalDateTime lockUntil;

    public AccountTemporarilyLockedException(String message, long remainingMinutes, LocalDateTime lockUntil) {
        super(message);
        this.remainingMinutes = remainingMinutes;
        this.lockUntil = lockUntil;
    }

    public long getRemainingMinutes() {
        return remainingMinutes;
    }

    public LocalDateTime getLockUntil() {
        return lockUntil;
    }
}
