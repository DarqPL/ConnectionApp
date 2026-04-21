package iuh.fit.ConnectionAppBackend.repo;

import iuh.fit.ConnectionAppBackend.domain.entity.sql.CallParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CallParticipantRepository extends JpaRepository<CallParticipant, Long> {

    Optional<CallParticipant> findByCallSessionIdAndUserId(Long callSessionId, Long userId);

    boolean existsByCallSessionIdAndUserId(Long callSessionId, Long userId);

    @Query("SELECT cp FROM CallParticipant cp " +
            "JOIN FETCH cp.user " +
            "WHERE cp.callSession.id = :callId")
    List<CallParticipant> findByCallIdWithUser(@Param("callId") Long callId);
}
