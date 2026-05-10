package iuh.fit.ConnectionAppBackend.domain.entity.sql;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "conversations")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Conversation {

    @Id
    @EqualsAndHashCode.Include
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String avatarUrl;

    @Column(unique = true, length = 64)
    private String inviteToken;

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

    @Column(columnDefinition = "TEXT")
    private String pinnedMessageIds;

    // Group settings - permissions
    @Builder.Default
    private boolean allowMemberEditInfo = true;

    @Builder.Default
    private boolean allowMemberCreateNotes = true;

    @Builder.Default
    private boolean allowMemberCreatePolls = true;

    @Builder.Default
    private boolean allowMemberSendMessage = true;

    @Builder.Default
    private boolean approvalMode = false;

    @Builder.Default
    private boolean markAdminMessages = false;

    @Builder.Default
    private boolean allowNewMembersReadHistory = true;

    @Builder.Default
    private boolean allowLinkJoin = true;

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ConversationUser> conversationUsers = new ArrayList<>();

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ConversationBlockedUser> blockedUsers = new ArrayList<>();

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ConversationPendingMember> pendingMembers = new ArrayList<>();
}
