package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.Data;

@Data
public class VerifyOtpRequest {
    private String email;
    private String otp;
}
