package iuh.fit.ConnectionAppBackend.domain.dto;

import java.time.Instant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FriendResponse {
    private Long id;
    private Long friendId;
    private String username;
    private String displayName;
    private String avatarUrl;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
    private boolean isRequester;
}
