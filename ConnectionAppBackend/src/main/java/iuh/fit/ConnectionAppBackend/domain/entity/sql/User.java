package iuh.fit.ConnectionAppBackend.domain.entity.sql;

import iuh.fit.ConnectionAppBackend.domain.common.Gender;
import iuh.fit.ConnectionAppBackend.domain.common.Role;
import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;


@Entity
@Table(name = "users")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(name = "hash_password")
    private String hashPassword;

    private String displayName;

    private LocalDateTime dob;

    private String email;

    private String phone;
    
    private String bio;

    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    @Enumerated(EnumType.STRING)
    private Role role;

    @Enumerated(EnumType.STRING)
    private UserStatus status;

    private LocalDateTime lockUntil;

    private String lockReason;

    @Column(nullable = false)
    private Integer tokenVersion = 0;

    @Column(nullable = false)
    private Integer webTokenVersion = 0;

    @Column(nullable = false)
    private Integer mobileTokenVersion = 0;

    @LastModifiedDate
    private LocalDateTime updateAt;

    @CreatedDate
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ConversationUser> conversationUsers = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RefreshToken> refreshTokens = new ArrayList<>();

    @OneToMany(mappedBy = "requester", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Friend> sentFriendRequests = new ArrayList<>();

    @OneToMany(mappedBy = "receiver", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Friend> receivedFriendRequests = new ArrayList<>();

    @OneToMany(mappedBy = "createdBy")
    private List<Conversation> createdConversations = new ArrayList<>();
}
