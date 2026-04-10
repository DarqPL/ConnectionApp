package iuh.fit.ConnectionAppBackend.domain.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationUserResponse {
    private Long id;
    private Long userId;
    private String username;
    private String displayName;
    private String avatarUrl;
    private String role;
    private LocalDateTime joinedAt;
    private Long unreadCounts;
}
