package iuh.fit.ConnectionAppBackend.exception;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ErrorResponse {
    private int status;
    private String code;
    private String message;
    private String error;
    private String path;
    private Instant timestamp;
    private Long remainingMinutes;
    private Instant lockUntil;
    private String trace;
}
