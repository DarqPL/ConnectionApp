package iuh.fit.ConnectionAppBackend.domain.entity.sql;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "conversation_blocked_users", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"conversation_id", "user_id"})
})
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ConversationBlockedUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocked_by")
    private User blockedBy;

    @CreatedDate
    private LocalDateTime blockedAt;
}
