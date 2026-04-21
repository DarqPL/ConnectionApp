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
public class CallParticipantResponse {
    private Long userId;
    private String displayName;
    private String avatarUrl;
    private String status;
    private boolean audioMuted;
    private boolean videoMuted;
    private LocalDateTime joinedAt;
    private LocalDateTime leftAt;
}
