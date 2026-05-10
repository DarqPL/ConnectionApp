package iuh.fit.ConnectionAppBackend.repo;

import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationBlockedUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationBlockedUserRepository extends JpaRepository<ConversationBlockedUser, Long> {

    List<ConversationBlockedUser> findByConversationId(Long conversationId);

    Optional<ConversationBlockedUser> findByConversationIdAndUserId(Long conversationId, Long userId);

    boolean existsByConversationIdAndUserId(Long conversationId, Long userId);

    void deleteByConversationIdAndUserId(Long conversationId, Long userId);

    @Query("SELECT cbu.user.id FROM ConversationBlockedUser cbu WHERE cbu.conversation.id = :conversationId")
    List<Long> findBlockedUserIdsByConversationId(@Param("conversationId") Long conversationId);
}
