package iuh.fit.ConnectionAppBackend.repo;

import iuh.fit.ConnectionAppBackend.domain.common.FriendStatus;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Friend;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRepository extends JpaRepository<Friend, Long> {

    /**
     * Get all friends of a user (accepted status only)
     */
    @Query("SELECT f FROM Friend f " +
            "WHERE (f.requester.id = :userId OR f.receiver.id = :userId) " +
            "AND f.status = 'ACCEPTED'")
    List<Friend> findFriendsByUserId(@Param("userId") Long userId);

    /**
     * Get friend by both users
     */
    @Query("SELECT f FROM Friend f " +
            "WHERE (f.requester.id = :userId1 AND f.receiver.id = :userId2) " +
            "OR (f.requester.id = :userId2 AND f.receiver.id = :userId1)")
    Optional<Friend> findFriendship(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    /**
     * Get pending friend requests sent by user
     */
    @Query("SELECT f FROM Friend f " +
            "WHERE f.requester.id = :userId " +
            "AND f.status = 'PENDING'")
    List<Friend> findPendingRequestsSent(@Param("userId") Long userId);

    /**
     * Get pending friend requests received by user
     */
    @Query("SELECT f FROM Friend f " +
            "WHERE f.receiver.id = :userId " +
            "AND f.status = 'PENDING'")
    List<Friend> findPendingRequestsReceived(@Param("userId") Long userId);

    /**
     * Get blocked users
     */
    @Query("SELECT f FROM Friend f " +
            "WHERE (f.requester.id = :userId OR f.receiver.id = :userId) " +
            "AND f.status = 'BLOCKED'")
    List<Friend> findBlockedUsers(@Param("userId") Long userId);

    /**
     * Check if two users are friends
     */
    @Query("SELECT COUNT(f) > 0 FROM Friend f " +
        "WHERE ((f.requester.id = :userId1 AND f.receiver.id = :userId2) " +
        "OR (f.requester.id = :userId2 AND f.receiver.id = :userId1)) " +
        "AND f.status = 'ACCEPTED'")
        boolean areFriends(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    @Query("SELECT COUNT(f) > 0 FROM Friend f " +
        "WHERE f.requester.id = :userId1 " +
        "AND f.receiver.id = :userId2 " +
        "AND f.status = 'PENDING'")
        boolean isSending(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    @Query("SELECT COUNT(f) > 0 FROM Friend f " +
        "WHERE f.requester.id = :userId2 " +
        "AND f.receiver.id = :userId1 " +
        "AND f.status = 'PENDING'")
    boolean isReceived(@Param("userId1") Long userId1, @Param("userId2") Long userId2);
    /**
     * Check if user is blocked
     */
    @Query("SELECT COUNT(f) > 0 FROM Friend f " +
            "WHERE ((f.requester.id = :userId1 AND f.receiver.id = :userId2) " +
            "OR (f.requester.id = :userId2 AND f.receiver.id = :userId1)) " +
            "AND f.status = 'BLOCKED'")
    boolean isBlocked(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    /**
     * Check if blocker has blocked target (directional)
     */
    @Query("SELECT COUNT(f) > 0 FROM Friend f " +
            "WHERE f.requester.id = :blockerId " +
            "AND f.receiver.id = :targetId " +
            "AND f.status = 'BLOCKED'")
    boolean isBlockedBy(@Param("blockerId") Long blockerId, @Param("targetId") Long targetId);

    /**
     * Get directional blocked relation
     */
    @Query("SELECT f FROM Friend f " +
            "WHERE f.requester.id = :blockerId " +
            "AND f.receiver.id = :targetId " +
            "AND f.status = 'BLOCKED'")
    Optional<Friend> findDirectionalBlocked(@Param("blockerId") Long blockerId, @Param("targetId") Long targetId);

    /**
     * Delete friend relationship
     */
    @Modifying
        @Query("DELETE FROM Friend f " +
        "WHERE ((f.requester.id = :userId1 AND f.receiver.id = :userId2) " +
        "OR (f.requester.id = :userId2 AND f.receiver.id = :userId1)) " +
        "AND f.status = 'ACCEPTED'")
        int unfriend(@Param("userId1") Long userId1,
                @Param("userId2") Long userId2);
@Modifying
@Query("DELETE FROM Friend f " +
       "WHERE f.requester.id = :userId1 " +
       "AND f.receiver.id = :userId2 " +
       "AND f.status = 'PENDING'")
int cancelRequest(@Param("userId1") Long userId1,
                  @Param("userId2") Long userId2);
}
