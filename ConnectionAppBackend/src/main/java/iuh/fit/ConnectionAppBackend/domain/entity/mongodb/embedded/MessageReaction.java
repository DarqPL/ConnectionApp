package iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageReaction {
    private Long userId;
    private String reactionCode;
    private LocalDateTime reactedAt;
}