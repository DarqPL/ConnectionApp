package iuh.fit.ConnectionAppBackend.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import java.time.LocalDateTime;

@Entity
@Table(name = "friends",
        uniqueConstraints = @UniqueConstraint(columnNames = {"requester_id","receiver_id"})
)
@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Friend {

    @Id
    @EqualsAndHashCode.Include
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FriendStatus status;

    @LastModifiedDate
    private LocalDateTime updateAt;

    @CreatedDate
    private LocalDateTime createdAt;


    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id",nullable = false)
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY,  optional = false)
    @JoinColumn(name = "receiver_id",nullable = false)
    private User receiver;



}
