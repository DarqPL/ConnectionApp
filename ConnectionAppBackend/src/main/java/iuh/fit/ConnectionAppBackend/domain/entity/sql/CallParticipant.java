package iuh.fit.ConnectionAppBackend.domain.entity.sql;

import iuh.fit.ConnectionAppBackend.domain.common.CallParticipantStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "call_participants",
        uniqueConstraints = @UniqueConstraint(columnNames = {"call_session_id", "user_id"}))
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class CallParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "call_session_id", nullable = false)
    private CallSession callSession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CallParticipantStatus status;

    @Column(nullable = false)
    private boolean audioMuted;

    @Column(nullable = false)
    private boolean videoMuted;

    private LocalDateTime joinedAt;

    private LocalDateTime leftAt;
}
