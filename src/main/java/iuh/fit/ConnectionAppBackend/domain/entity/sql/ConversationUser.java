package iuh.fit.ConnectionAppBackend.domain.entity.sql;

import iuh.fit.ConnectionAppBackend.domain.common.ConversationRole;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;

@Entity
@Table(name = "conversation_users",
        uniqueConstraints = @UniqueConstraint(columnNames = {"conversation_id","user_id"})
)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class ConversationUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @Enumerated(EnumType.STRING)
    private ConversationRole role;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    @Column(name = "unread_counts")
    private Long unreadCounts;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
}
