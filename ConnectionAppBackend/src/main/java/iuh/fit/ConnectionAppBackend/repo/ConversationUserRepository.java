package iuh.fit.ConnectionAppBackend.repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationUser;

@Repository
public interface ConversationUserRepository extends JpaRepository<ConversationUser, Long> {

    /**
     * Get all users in a conversation
     */
    @Query("SELECT cu FROM ConversationUser cu " +
            "JOIN FETCH cu.user " +
            "WHERE cu.conversation.id = :conversationId")
    List<ConversationUser> findByConversationId(@Param("conversationId") Long conversationId);

    @Query("SELECT cu.user.id FROM ConversationUser cu WHERE cu.conversation.id = :conversationId")
    List<Long> findMemberIdsByConversationId(@Param("conversationId") Long conversationId);

    /**
     * Get user in a specific conversation
     */
    Optional<ConversationUser> findByConversationIdAndUserId(Long conversationId, Long userId);

    /**
     * Check if user is member of conversation
     */
    @Query("SELECT COUNT(cu) > 0 FROM ConversationUser cu " +
            "WHERE cu.conversation.id = :conversationId " +
            "AND cu.user.id = :userId")
    boolean isMember(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    /**
     * Get unread message count for user in conversation
     */
    @Query("SELECT cu.unreadCounts FROM ConversationUser cu " +
            "WHERE cu.conversation.id = :conversationId " +
            "AND cu.user.id = :userId")
    Optional<Long> getUnreadCount(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    /**
     * Update unread count
     */
    @Modifying
    @Query("UPDATE ConversationUser cu " +
            "SET cu.unreadCounts = :unreadCount " +
            "WHERE cu.conversation.id = :conversationId " +
            "AND cu.user.id = :userId")
    void updateUnreadCount(@Param("conversationId") Long conversationId,
                           @Param("userId") Long userId,
                           @Param("unreadCount") Long unreadCount);

    /**
     * Increment unread count for everyone except sender
     */
    @Modifying
    @Query("UPDATE ConversationUser cu " +
            "SET cu.unreadCounts = cu.unreadCounts + 1 " +
            "WHERE cu.conversation.id = :conversationId " +
            "AND cu.user.id != :senderId")
    void incrementUnreadCount(@Param("conversationId") Long conversationId,
                              @Param("senderId") Long senderId);

    /**
     * Reset unread count for a specific user
     */
    @Modifying
    @Query("UPDATE ConversationUser cu " +
            "SET cu.unreadCounts = 0 " +
            "WHERE cu.conversation.id = :conversationId " +
            "AND cu.user.id = :userId")
    void resetUnreadCount(@Param("conversationId") Long conversationId,
                          @Param("userId") Long userId);

    /**
     * Delete user from conversation
     */
    void deleteByConversationIdAndUserId(Long conversationId, Long userId);
}
