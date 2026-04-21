package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallSessionResponse {
    private Long callId;
    private Long conversationId;
    private Long initiatedBy;
    private String mediaType;
    private String status;
    private String roomId;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private Long durationSeconds;
    private String endedReason;
    private CallTokenResponse token;
    private List<CallParticipantResponse> participants;
}
