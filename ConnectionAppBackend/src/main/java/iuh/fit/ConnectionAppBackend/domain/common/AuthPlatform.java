package iuh.fit.ConnectionAppBackend.domain.common;

public enum AuthPlatform {
    WEB,
    MOBILE;

    public static AuthPlatform fromValue(String value) {
        if (value == null || value.isBlank()) {
            return WEB;
        }

        try {
            return AuthPlatform.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return WEB;
        }
    }
}
