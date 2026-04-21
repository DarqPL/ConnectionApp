package iuh.fit.ConnectionAppBackend.domain.entity.sql;

import iuh.fit.ConnectionAppBackend.domain.common.CallMediaType;
import iuh.fit.ConnectionAppBackend.domain.common.CallStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "call_sessions")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class CallSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "initiated_by", nullable = false)
    private User initiatedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CallMediaType mediaType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CallStatus status;

    @Column(nullable = false, unique = true, length = 128)
    private String zegoRoomId;

    private LocalDateTime startedAt;

    private LocalDateTime endedAt;

    private Long durationSeconds;

    @Column(length = 128)
    private String endedReason;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "callSession", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CallParticipant> participants = new ArrayList<>();
}
