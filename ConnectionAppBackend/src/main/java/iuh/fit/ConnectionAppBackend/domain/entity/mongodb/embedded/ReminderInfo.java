package iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded;

import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReminderInfo {
    private String title;
    private String content;
    private LocalDateTime reminderTime;

    @Builder.Default
    private List<Long> participantIds = new ArrayList<>();

    @Builder.Default
    private List<Long> declinedIds = new ArrayList<>();

    @Builder.Default
    private boolean notified = false;

    private Long creatorId;
    private String creatorName;
    private String reminderGroupId;
}
