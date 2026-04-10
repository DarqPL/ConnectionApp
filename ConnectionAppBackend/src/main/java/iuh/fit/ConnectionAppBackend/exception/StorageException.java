package iuh.fit.ConnectionAppBackend.exception;

public class StorageException extends RuntimeException {
    private final String code;

    public StorageException(String message) {
        this("STORAGE_ERROR", message, null);
    }

    public StorageException(String message, Throwable cause) {
        this("STORAGE_ERROR", message, cause);
    }

    public StorageException(String code, String message) {
        this(code, message, null);
    }

    public StorageException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
