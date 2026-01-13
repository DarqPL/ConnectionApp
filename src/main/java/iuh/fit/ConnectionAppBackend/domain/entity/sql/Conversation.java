package iuh.fit.ConnectionAppBackend.domain.entity.sql;

import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;

@Entity
@Table(name = "conversations")
@Data
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Conversation {

    @Id
    @EqualsAndHashCode.Include
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    private ConversationType type;

    @LastModifiedDate
    private LocalDateTime updateAt;

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime lastMessageAt;

    @Column(columnDefinition = "TEXT")
    private String lastMessageContent;

    private boolean activate = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @OneToMany(mappedBy = "conversation",cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ConversationUser> conversationUsers = new ArrayList<>();
}
