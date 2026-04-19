package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TypingNotificationDTO {
    private Long conversationId;
    private Long userId;
    private String displayName;
    private LocalDateTime typedAt;
}