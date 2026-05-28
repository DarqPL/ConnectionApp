package iuh.fit.ConnectionAppBackend.exception;

import java.time.Instant;

public class AccountTemporarilyLockedException extends RuntimeException {

    private final long remainingMinutes;
    private final Instant lockUntil;

    public AccountTemporarilyLockedException(String message, long remainingMinutes, Instant lockUntil) {
        super(message);
        this.remainingMinutes = remainingMinutes;
        this.lockUntil = lockUntil;
    }

    public long getRemainingMinutes() {
        return remainingMinutes;
    }

    public Instant getLockUntil() {
        return lockUntil;
    }
}
