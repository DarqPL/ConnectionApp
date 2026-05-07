package iuh.fit.ConnectionAppBackend.exception;

public class AccountManualLockedException extends RuntimeException {
    public AccountManualLockedException(String message) {
        super(message);
    }
}
