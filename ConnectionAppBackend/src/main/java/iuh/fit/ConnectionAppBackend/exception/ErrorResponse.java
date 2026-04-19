package iuh.fit.ConnectionAppBackend.exception;

import java.time.LocalDateTime;

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
    private LocalDateTime timestamp;
    private Long remainingMinutes;
    private LocalDateTime lockUntil;
    private String trace;
}
