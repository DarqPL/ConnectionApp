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
                LocalDateTime.now()
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
            "Phiên đăng nhập đã kết thúc",
            "Tài khoản của bạn vừa đăng nhập trên thiết bị " + targetPlatform.name() + " khác.",
            targetPlatform.name(),
            "NEW_LOGIN_SAME_PLATFORM",
            deviceName,
            ipAddress,
            userAgent,
            LocalDateTime.now()
        );

        messagingTemplate.convertAndSend("/topic/user." + userId + "/security", payload);
        }
}
