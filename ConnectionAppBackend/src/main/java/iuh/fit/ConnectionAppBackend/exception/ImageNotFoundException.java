package iuh.fit.ConnectionAppBackend.exception;

public class ImageNotFoundException extends ResourceNotFoundException {
    private final String code;

    public ImageNotFoundException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
