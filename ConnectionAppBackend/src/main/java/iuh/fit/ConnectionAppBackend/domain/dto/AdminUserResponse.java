package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserResponse {
    private Long id;
    private String username;
    private String displayName;
    private String email;
    private String phone;
    private String avatarUrl;
    private String role;
    private String status;
    private String lockUntil;
    private String lockReason;
    private String createdAt;
}
