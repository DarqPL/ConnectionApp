package iuh.fit.ConnectionAppBackend.repo;

import iuh.fit.ConnectionAppBackend.domain.common.CallParticipantStatus;
import iuh.fit.ConnectionAppBackend.domain.common.CallStatus;
import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.time.Instant;
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
                                           @Param("deadline") Instant deadline);

    @Query("SELECT DISTINCT cs FROM CallSession cs " +
            "JOIN FETCH cs.participants cp " +
            "JOIN FETCH cp.user u " +
            "JOIN FETCH cs.conversation c " +
            "WHERE u.username = :username " +
            "AND cs.status = :status " +
            "AND c.type = :type " +
            "AND cp.status = :participantStatus")
    List<CallSession> findOngoingGroupCallsByUsername(
            @Param("username") String username,
            @Param("status") CallStatus status,
            @Param("type") ConversationType type,
            @Param("participantStatus") CallParticipantStatus participantStatus);

    @Query("SELECT cs FROM CallSession cs " +
            "WHERE cs.conversation.id = :conversationId " +
            "AND cs.status = :status " +
            "ORDER BY cs.createdAt DESC")
    Optional<CallSession> findActiveByConversationIdAndStatus(
            @Param("conversationId") Long conversationId,
            @Param("status") CallStatus status);
}
