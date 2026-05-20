package iuh.fit.ConnectionAppBackend.exception;

public class AccountAdminLockedException extends RuntimeException {
    public AccountAdminLockedException(String message) {
        super(message);
    }
}
