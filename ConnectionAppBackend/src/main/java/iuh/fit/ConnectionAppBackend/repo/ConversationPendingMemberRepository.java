package iuh.fit.ConnectionAppBackend.repo;

import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationPendingMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationPendingMemberRepository extends JpaRepository<ConversationPendingMember, Long> {

    List<ConversationPendingMember> findByConversationId(Long conversationId);

    Optional<ConversationPendingMember> findByConversationIdAndUserId(Long conversationId, Long userId);

    boolean existsByConversationIdAndUserId(Long conversationId, Long userId);

    void deleteByConversationIdAndUserId(Long conversationId, Long userId);

    @Query("SELECT cpm.user.id FROM ConversationPendingMember cpm WHERE cpm.conversation.id = :conversationId")
    List<Long> findPendingUserIdsByConversationId(@Param("conversationId") Long conversationId);
}
