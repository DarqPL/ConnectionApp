package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.AuthPlatform;
import iuh.fit.ConnectionAppBackend.domain.dto.SecurityNotificationDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class SecurityNotificationService {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public void notifyUnknownDeviceLogin(Long userId,
                                         String deviceName,
                                         String ipAddress,
                                         String userAgent) {
        SecurityNotificationDTO payload = new SecurityNotificationDTO(
                "UNKNOWN_DEVICE_LOGIN",
                "Cảnh báo bảo mật",
                "Có thiết bị đang đăng nhập vào tài khoản của bạn",
            null,
            null,
                deviceName,
                ipAddress,
                userAgent,
            LocalDateTime.now(),
            null,
            null
        );

        messagingTemplate.convertAndSend("/topic/user." + userId + "/security", payload);
    }

        public void notifySessionRevokedByNewLogin(Long userId,
                               AuthPlatform targetPlatform,
                               String deviceName,
                               String ipAddress,
                               String userAgent) {
        SecurityNotificationDTO payload = new SecurityNotificationDTO(
            "SESSION_REVOKED_NEW_LOGIN",
            "Thông báo đăng nhập",
            "Tài khoản của bạn vừa đăng nhập trên thiết bị " + targetPlatform.name() + " khác.",
            targetPlatform.name(),
            "NEW_LOGIN_SAME_PLATFORM",
            deviceName,
            ipAddress,
            userAgent,
            LocalDateTime.now(),
            null,
            null
        );

        messagingTemplate.convertAndSend("/topic/user." + userId + "/security", payload);
        }

    public void notifyAccountTemporarilyLocked(Long userId,
                                               LocalDateTime lockUntil,
                                               long remainingMinutes,
                                               String reason) {
        SecurityNotificationDTO payload = new SecurityNotificationDTO(
                "ACCOUNT_TEMP_LOCKED",
                "Tài khoản bị khóa tạm thời",
                "Bạn bị khóa tài khoản " + remainingMinutes + " phút do vi phạm chính sách.",
                null,
                reason,
                null,
                null,
                null,
                LocalDateTime.now(),
                remainingMinutes,
                lockUntil
        );

        messagingTemplate.convertAndSend("/topic/user." + userId + "/security", payload);
    }
}
