package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SecurityNotificationDTO {
    private String type;
    private String title;
    private String message;
    private String targetPlatform;
    private String reason;
    private String deviceName;
    private String ipAddress;
    private String userAgent;
    private LocalDateTime loginAt;
    private Long remainingMinutes;
    private LocalDateTime lockUntil;
}
