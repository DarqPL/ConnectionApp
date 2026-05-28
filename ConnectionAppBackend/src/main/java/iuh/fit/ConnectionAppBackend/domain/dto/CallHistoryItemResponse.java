package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallHistoryItemResponse {
    private Long callId;
    private Long conversationId;
    private String mediaType;
    private String status;
    private Instant createdAt;
    private Instant startedAt;
    private Instant endedAt;
    private Long durationSeconds;
    private String counterpartSummary;
}
