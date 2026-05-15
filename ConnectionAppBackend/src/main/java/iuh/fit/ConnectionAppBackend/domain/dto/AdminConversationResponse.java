package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminConversationResponse {
    private Long id;
    private String name;
    private String type;
    private long participantCount;
    private String creatorName;
    private String createdAt;
    private String status;
    private String lastActivity;
}
