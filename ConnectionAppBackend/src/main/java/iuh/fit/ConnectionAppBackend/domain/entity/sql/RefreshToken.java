package iuh.fit.ConnectionAppBackend.domain.entity.sql;

import iuh.fit.ConnectionAppBackend.domain.common.AuthPlatform;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false,unique = true)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    private AuthPlatform platform;

    private String deviceName;

    @Column(length = 512)
    private String userAgent;

    private String ipAddress;

    private LocalDateTime createdAt;

    private LocalDateTime lastUsedAt;

    private LocalDateTime expiryDate;
}
