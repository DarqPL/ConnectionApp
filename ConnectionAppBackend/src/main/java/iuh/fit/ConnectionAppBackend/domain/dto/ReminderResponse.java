package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ReminderResponse {
    private String id;
    private String title;
    private String content;
    private LocalDateTime reminderTime;
    private boolean isNotified;
    private Long conversationId;
    private Long creatorId;
    private String creatorName;
    private List<Long> participantIds;
    private List<Long> declinedIds;
    private LocalDateTime createdAt;
    private String reminderGroupId;
}
