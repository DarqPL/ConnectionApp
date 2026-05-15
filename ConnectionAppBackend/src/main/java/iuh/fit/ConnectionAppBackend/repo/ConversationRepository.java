package iuh.fit.ConnectionAppBackend.repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    /**
     * Get all conversations for a specific user with pagination support
     */
    @Query("SELECT c FROM Conversation c " +
            "JOIN c.conversationUsers cu " +
            "WHERE cu.user.id = :userId " +
            "AND c.activate = true")
    Page<Conversation> findAllByUserId(@Param("userId") Long userId, Pageable pageable);

    /**
     * Get conversation by ID with all participants
     */
    @Query("SELECT c FROM Conversation c " +
            "LEFT JOIN FETCH c.conversationUsers cu " +
            "LEFT JOIN FETCH cu.user " +
            "WHERE c.id = :conversationId")
    Optional<Conversation> findByIdWithUsers(@Param("conversationId") Long conversationId);

    @Query("SELECT c FROM Conversation c " +
            "LEFT JOIN FETCH c.conversationUsers cu " +
            "LEFT JOIN FETCH cu.user " +
            "WHERE c.inviteToken = :inviteToken")
    Optional<Conversation> findByInviteTokenWithUsers(@Param("inviteToken") String inviteToken);

    /**
     * Get private conversation between two users
     */
    @Query("SELECT c FROM Conversation c " +
            "WHERE c.type = 'PRIVATE' " +
            "AND c.activate = true " +
            "AND (SELECT COUNT(cu) FROM c.conversationUsers cu WHERE cu.conversation.id = c.id AND cu.user.id IN (:userId1, :userId2)) = 2")
    List<Conversation> findPrivateConversation(@Param("userId1") Long userId1, @Param("userId2") Long userId2);

    /**
     * Search conversation by name
     */
    @Query("SELECT c FROM Conversation c " +
            "WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "AND c.activate = true")
    List<Conversation> searchByName(@Param("searchTerm") String searchTerm);

    /**
     * Get conversation count for a user
     */
    @Query("SELECT COUNT(c) FROM Conversation c " +
            "JOIN c.conversationUsers cu " +
            "WHERE cu.user.id = :userId " +
            "AND c.activate = true")
    long countByUserId(@Param("userId") Long userId);

    /**
     * Get all conversations for admin (paginated)
     */
    @Query("SELECT c FROM Conversation c ORDER BY c.createdAt DESC")
    Page<Conversation> findAllForAdmin(Pageable pageable);

    /**
     * Get conversations by type for admin
     */
    @Query("SELECT c FROM Conversation c WHERE c.type = :type ORDER BY c.createdAt DESC")
    Page<Conversation> findByTypeForAdmin(@Param("type") iuh.fit.ConnectionAppBackend.domain.common.ConversationType type, Pageable pageable);

    /**
     * Count all conversations
     */
    long countByActivateTrue();

    /**
     * Count conversations by type
     */
    long countByTypeAndActivateTrue(iuh.fit.ConnectionAppBackend.domain.common.ConversationType type);
}
