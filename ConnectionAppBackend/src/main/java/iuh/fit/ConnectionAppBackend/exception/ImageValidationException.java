package iuh.fit.ConnectionAppBackend.exception;

public class ImageValidationException extends BadRequestException {
    private final String code;

    public ImageValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
