package iuh.fit.ConnectionAppBackend.repo;

import iuh.fit.ConnectionAppBackend.domain.common.CallStatus;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CallSessionRepository extends JpaRepository<CallSession, Long> {

    @Query("SELECT cs FROM CallSession cs " +
            "WHERE cs.conversation.id = :conversationId " +
            "AND cs.status IN :statuses " +
            "ORDER BY cs.createdAt DESC")
    List<CallSession> findActiveByConversationId(@Param("conversationId") Long conversationId,
                                                 @Param("statuses") Collection<CallStatus> statuses,
                                                 Pageable pageable);

    @Query("SELECT DISTINCT cs FROM CallSession cs " +
            "JOIN cs.participants p " +
            "WHERE p.user.id = :userId")
    Page<CallSession> findHistoryByUserId(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT cs FROM CallSession cs " +
            "LEFT JOIN FETCH cs.conversation c " +
            "LEFT JOIN FETCH cs.initiatedBy i " +
            "WHERE cs.id = :callId")
    Optional<CallSession> findByIdWithContext(@Param("callId") Long callId);

    @Query("SELECT cs FROM CallSession cs " +
            "LEFT JOIN FETCH cs.conversation c " +
            "LEFT JOIN FETCH cs.initiatedBy i " +
            "WHERE cs.status = :status " +
            "AND cs.createdAt <= :deadline")
    List<CallSession> findByStatusTimedOut(@Param("status") CallStatus status,
                                           @Param("deadline") LocalDateTime deadline);
}
