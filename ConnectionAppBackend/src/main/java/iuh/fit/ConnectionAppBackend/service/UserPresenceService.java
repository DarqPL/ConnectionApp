package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.UserStatus;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserPresenceService {

    private static final Logger log = LoggerFactory.getLogger(UserPresenceService.class);

    private static final long HEARTBEAT_TIMEOUT_SECONDS = 90;

    private final ConcurrentHashMap<Long, LocalDateTime> lastSeenMap = new ConcurrentHashMap<>();

    @Autowired
    private UserRepository userRepository;

    public void setOnline(Long userId) {
        lastSeenMap.put(userId, LocalDateTime.now());
        updateUserStatusInDb(userId, UserStatus.ONLINE);
        log.info("User {} is now ONLINE", userId);
    }

    public void setOffline(Long userId) {
        lastSeenMap.remove(userId);
        updateUserStatusInDb(userId, UserStatus.OFFLINE);
        log.info("User {} is now OFFLINE", userId);
    }

    public void heartbeat(Long userId) {
        lastSeenMap.put(userId, LocalDateTime.now());
    }

    public boolean isOnline(Long userId) {
        return lastSeenMap.containsKey(userId);
    }

    public Set<Long> getOnlineUserIds() {
        return lastSeenMap.keySet();
    }

    @Scheduled(fixedRate = 60000)
    public void cleanupStaleConnections() {
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(HEARTBEAT_TIMEOUT_SECONDS);
        int cleanedCount = 0;

        for (var entry : lastSeenMap.entrySet()) {
            if (entry.getValue().isBefore(cutoff)) {
                Long userId = entry.getKey();
                lastSeenMap.remove(userId);
                updateUserStatusInDb(userId, UserStatus.OFFLINE);
                cleanedCount++;
                log.warn("User {} marked OFFLINE due to stale heartbeat", userId);
            }
        }

        if (cleanedCount > 0) {
            log.info("Cleaned {} stale online connections", cleanedCount);
        }
    }

    @Transactional
    private void updateUserStatusInDb(Long userId, UserStatus status) {
        try {
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) return;

            if (user.getStatus() == UserStatus.DELETED) return;

            if (user.getLockUntil() != null && user.getLockUntil().isAfter(LocalDateTime.now())) {
                return;
            }

            if (user.getStatus() != status) {
                user.setStatus(status);
                userRepository.save(user);
            }
        } catch (Exception e) {
            log.error("Failed to update status for user {}: {}", userId, e.getMessage());
        }
    }
}
