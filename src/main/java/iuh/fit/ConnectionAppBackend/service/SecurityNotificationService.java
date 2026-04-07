package iuh.fit.ConnectionAppBackend.service;

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
                "Canh bao bao mat",
                "Co thiet bi la dang nhap vao tai khoan cua ban",
                deviceName,
                ipAddress,
                userAgent,
                LocalDateTime.now()
        );

        messagingTemplate.convertAndSend("/topic/user." + userId + "/security", payload);
    }
}
